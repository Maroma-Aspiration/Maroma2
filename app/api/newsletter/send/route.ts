import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { canEditNewsletter } from "../../../../lib/auth-roles";
import {
  appendCampaign,
  getMailingListRecipients,
  readNewsletterAudience
} from "../../../../lib/newsletter-audience-storage";
import {
  buildTrackedNewsletterUrls,
  resolveFromEmail,
  sendEmail,
  siteOriginFromRequest
} from "../../../../lib/newsletter-send";
import { appendArchiveIssue } from "../../../../lib/newsletter-archive-storage";
import { appendTestSnapshot } from "../../../../lib/newsletter-test-snapshot-storage";
import {
  buildArchiveRenderMeta,
  buildArchiveSlug,
  pickThumbnailFromCanvas,
} from "../../../../lib/newsletter-archive-utils";
import { readStoriesState, writeStoriesState } from "../../../../lib/story-storage";
import { ensureCanvasPublicImageUrlsDetailed } from "../../../../lib/canvas-email-images";
import { parseStorySpacingGaps, type StorySpacingGaps } from "../../../../lib/story-spacing-gaps";
import { canvasToEmailHtml, canvasEmailOptionsFromState } from "../../../../lib/canvas-to-email";
import type { NewsletterCanvas, StoriesState } from "../../../../lib/story-types";

async function prepareCanvasForEmail(
  state: StoriesState,
  origin: string
): Promise<NewsletterCanvas> {
  const prepared = await ensureCanvasPublicImageUrlsDetailed(state.newsletterCanvas, origin);
  if (prepared.remainingDataUrls > 0) {
    throw new Error(
      `${prepared.remainingDataUrls} newsletter image(s) are still stored inline and could not be uploaded to Firebase or Vercel Blob. Check FIREBASE_* credentials or BLOB_READ_WRITE_TOKEN, then re-upload the images and try again.`
    );
  }
  if (prepared.changed) {
    await writeStoriesState({
      ...state,
      newsletterCanvas: prepared.canvas,
    });
  }
  return prepared.canvas;
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function parseTestRecipients(body: {
  testEmail?: string;
  testEmails?: string | string[];
}): string[] {
  const raw: string[] = [];
  if (typeof body.testEmail === "string" && body.testEmail.trim()) {
    raw.push(body.testEmail);
  }
  if (typeof body.testEmails === "string" && body.testEmails.trim()) {
    raw.push(body.testEmails);
  }
  if (Array.isArray(body.testEmails)) {
    for (const item of body.testEmails) {
      if (typeof item === "string" && item.trim()) raw.push(item);
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const chunk of raw) {
    for (const part of chunk.split(/[,;\n]+/)) {
      const email = part.trim().toLowerCase();
      if (!email || !EMAIL_RE.test(email) || seen.has(email)) continue;
      seen.add(email);
      out.push(email);
    }
  }
  return out;
}

export async function POST(request: Request) {
  // ── Auth guard ───────────────────────────────────────────────────────────
  const sessionSecret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = sessionSecret && token ? await verifySessionPayload(token, sessionSecret) : null;
  if (!session || !canEditNewsletter(session.role)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  // ── Env checks ───────────────────────────────────────────────────────────
  const trackingSecret = process.env.NEWSLETTER_TRACKING_SECRET?.trim();
  const from = resolveFromEmail();
  const hasProvider = !!(process.env.POSTMARK_SERVER_TOKEN?.trim() || process.env.RESEND_API_KEY?.trim());

  if (!trackingSecret) {
    return NextResponse.json(
      {
        error:
          "Set NEWSLETTER_TRACKING_SECRET on Vercel (long random string). Required before any send.",
      },
      { status: 400 }
    );
  }
  if (!hasProvider) {
    return NextResponse.json(
      { error: "Set POSTMARK_SERVER_TOKEN on Vercel to send email." },
      { status: 400 }
    );
  }
  if (!from) {
    return NextResponse.json(
      {
        error:
          "NEWSLETTER_FROM_EMAIL is missing or invalid on Vercel. Set it to your verified Postmark sender (e.g. production@miraculousmedia.in), not empty quotes.",
      },
      { status: 400 }
    );
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let subject = "Maroma newsletter";
  let previewText = "";
  let testOnly = false;
  let plainTest = false;
  let testRecipients: string[] = [];
  let storySpacingGaps: StorySpacingGaps | undefined;
  let mailingListId: string | undefined;
  try {
    const body = (await request.json()) as {
      subject?: string;
      previewText?: string;
      testOnly?: boolean;
      plainTest?: boolean;
      testEmail?: string;
      testEmails?: string | string[];
      storySpacingGaps?: unknown;
      mailingListId?: string;
    };
    if (typeof body.subject === "string" && body.subject.trim()) {
      subject = body.subject.trim().slice(0, 200);
    }
    if (typeof body.previewText === "string") {
      previewText = body.previewText.trim().slice(0, 300);
    }
    testOnly = body.testOnly === true;
    plainTest = body.plainTest === true;
    testRecipients = parseTestRecipients(body);
    storySpacingGaps = parseStorySpacingGaps(body.storySpacingGaps);
    if (typeof body.mailingListId === "string" && body.mailingListId.trim()) {
      mailingListId = body.mailingListId.trim();
    }
  } catch {
    // use defaults
  }

  const origin = siteOriginFromRequest(request);

  // ── Test send (one or more addresses) ────────────────────────────────────
  if (testOnly) {
    if (testRecipients.length === 0) {
      return NextResponse.json(
        { error: "Enter at least one valid email address for the test send." },
        { status: 400 }
      );
    }

    let html: string;
    let canvasForEmail: NewsletterCanvas | null = null;
    let stateForMeta: StoriesState | null = null;
    if (plainTest) {
      html = "<p><strong>Maroma newsletter plain test</strong>: same as Postmark curl, sent from the app.</p>";
    } else {
      const state = await readStoriesState();
      const hasCanvas = state.newsletterCanvas?.enabled && (state.newsletterCanvas?.elements?.length ?? 0) > 0;
      if (!hasCanvas) {
        return NextResponse.json({ error: "No canvas content to send. Build the newsletter first." }, { status: 400 });
      }
      const fakeId = "test-subscriber";
      const urls = buildTrackedNewsletterUrls(origin, fakeId, "test-campaign", trackingSecret);
      try {
        const preparedCanvas = await prepareCanvasForEmail(state, origin);
        canvasForEmail = preparedCanvas;
        stateForMeta = state;
        html = canvasToEmailHtml(
          preparedCanvas,
          canvasEmailOptionsFromState(state, {
            subject,
            previewText,
            siteUrl: origin,
            allowDataUrls: false,
            storySpacingGaps,
            tracking: {
              pixelUrl: urls.pixelUrl,
              unsubUrl: urls.unsubUrl,
              viewOnlineUrl: `${origin}/newsletter/view`,
            },
          })
        );
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Could not prepare newsletter images." },
          { status: 400 }
        );
      }
    }

    const sentTo: string[] = [];
    const messageIds: { email: string; messageId?: string }[] = [];
    const failures: { email: string; message: string }[] = [];
    for (const to of testRecipients) {
      const result = await sendEmail({
        from,
        to,
        subject: `[TEST] ${subject}`,
        html,
        forTest: true,
      });
      if (result.ok) {
        sentTo.push(to);
        messageIds.push({ email: to, messageId: result.messageId });
      } else {
        failures.push({ email: to, message: result.message });
      }
    }

    if (sentTo.length === 0) {
      return NextResponse.json(
        { error: failures[0]?.message ?? "Test send failed.", failures },
        { status: 500 }
      );
    }

    if (!plainTest && canvasForEmail && stateForMeta) {
      try {
        await appendTestSnapshot({
          id: crypto.randomUUID(),
          subject,
          previewText,
          sentAt: new Date().toISOString(),
          thumbnailUrl: pickThumbnailFromCanvas(canvasForEmail),
          canvas: canvasForEmail,
          renderMeta: buildArchiveRenderMeta(stateForMeta, storySpacingGaps),
          sentTo,
        });
      } catch (err) {
        console.error("newsletter test snapshot failed", err);
      }
    }

    return NextResponse.json({
      ok: true,
      testOnly: true,
      plainTest,
      sentTo,
      messageIds,
      htmlBytes: html.length,
      from,
      failures: failures.length ? failures : undefined,
      messageStream: process.env.POSTMARK_TEST_MESSAGE_STREAM?.trim() || "outbound",
      hint:
        "Postmark accepted the message (test uses the outbound stream). In Postmark → Activity, open the MessageID: Delivered = check Spam/Promotions; Bounced = fix DNS/sender; Suppression = remove the address in Postmark → Suppressions.",
    });
  }

  // ── Canvas HTML (full campaign) ────────────────────────────────────────────
  const state = await readStoriesState();
  const hasCanvas = state.newsletterCanvas?.enabled && (state.newsletterCanvas?.elements?.length ?? 0) > 0;
  if (!hasCanvas) {
    return NextResponse.json({ error: "No canvas content to send. Build the newsletter first." }, { status: 400 });
  }

  // ── Full list send ───────────────────────────────────────────────────────
  const audience = await readNewsletterAudience();
  const listId = mailingListId ?? audience.selectedListId;
  const recipients = getMailingListRecipients(audience, listId);
  const listName = audience.mailingLists.find((list) => list.id === listId)?.name ?? "selected list";
  if (recipients.length === 0) {
    return NextResponse.json(
      { error: `No active subscribers in "${listName}". Upload a CSV or choose another list.` },
      { status: 400 }
    );
  }

  const campaignId = crypto.randomUUID();
  const sentAt = new Date().toISOString();
  let canvasForEmail: NewsletterCanvas;
  try {
    canvasForEmail = await prepareCanvasForEmail(state, origin);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not prepare newsletter images." },
      { status: 400 }
    );
  }
  const archiveSlug = buildArchiveSlug(subject, sentAt, campaignId);
  const archived = await appendArchiveIssue({
    id: campaignId,
    slug: archiveSlug,
    subject,
    previewText,
    sentAt,
    thumbnailUrl: pickThumbnailFromCanvas(canvasForEmail),
    canvas: canvasForEmail,
    renderMeta: buildArchiveRenderMeta(state, storySpacingGaps),
    recipientCount: recipients.length,
  });
  const viewOnlineUrl = `${origin}/newsletter/archive/${archived.slug}`;

  await appendCampaign({
    id: campaignId,
    subject,
    sentAt,
    recipientCount: recipients.length,
    openSubscriberIds: [],
    clickCount: 0,
    clickSubscriberIds: [],
    unsubscribeSubscriberIds: []
  });

  const chunkSize = 5;
  let ok = 0;
  const failures: { email: string; message: string }[] = [];

  for (let i = 0; i < recipients.length; i += chunkSize) {
    const slice = recipients.slice(i, i + chunkSize);
    await Promise.all(
      slice.map(async (r) => {
        const urls = buildTrackedNewsletterUrls(origin, r.id, campaignId, trackingSecret);
        const html = canvasToEmailHtml(
          canvasForEmail,
          canvasEmailOptionsFromState(state, {
            subject,
            previewText,
            siteUrl: origin,
            allowDataUrls: false,
            storySpacingGaps,
            tracking: {
              pixelUrl: urls.pixelUrl,
              unsubUrl: urls.unsubUrl,
              viewOnlineUrl,
            },
          })
        );
        const result = await sendEmail({ from, to: r.email, subject, html });
        if (result.ok) {
          ok += 1;
        } else {
          failures.push({ email: r.email, message: result.message });
        }
      })
    );
  }

  return NextResponse.json({
    campaignId,
    subject,
    archiveSlug,
    archiveUrl: viewOnlineUrl,
    attempted: recipients.length,
    sentOk: ok,
    failures,
    mailingListId: listId,
    mailingListName: listName,
    activeSubscribers: recipients.length,
  });
}
