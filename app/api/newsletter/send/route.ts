import { NextResponse } from "next/server";
import {
  appendCampaign,
  countActiveSubscribers,
  readNewsletterAudience
} from "../../../../lib/newsletter-audience-storage";
import {
  buildNewsletterEmailHtml,
  buildTrackedNewsletterUrls,
  sendEmailViaResend,
  siteOriginFromRequest
} from "../../../../lib/newsletter-send";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.NEWSLETTER_TRACKING_SECRET?.trim();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.NEWSLETTER_FROM_EMAIL?.trim() ?? "Maroma Newsletter <onboarding@resend.dev>";

  if (!secret) {
    return NextResponse.json(
      { error: "Set NEWSLETTER_TRACKING_SECRET for signed open/click/unsubscribe links." },
      { status: 400 }
    );
  }
  if (!apiKey) {
    return NextResponse.json({ error: "Set RESEND_API_KEY to send email." }, { status: 400 });
  }

  let subject = "Maroma newsletter";
  try {
    const body = (await request.json()) as { subject?: string };
    if (typeof body.subject === "string" && body.subject.trim()) {
      subject = body.subject.trim().slice(0, 200);
    }
  } catch {
    // default subject
  }

  const audience = await readNewsletterAudience();
  const recipients = audience.subscribers.filter((s) => !s.unsubscribedAt);
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No active subscribers to send to." }, { status: 400 });
  }

  const origin = siteOriginFromRequest(request);
  const campaignId = crypto.randomUUID();
  const sentAt = new Date().toISOString();

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
        const urls = buildTrackedNewsletterUrls(origin, r.id, campaignId, secret);
        const html = buildNewsletterEmailHtml({
          greetingName: r.name || "friend",
          readOnlineTrackUrl: urls.readOnlineTrackUrl,
          pixelUrl: urls.pixelUrl,
          unsubUrl: urls.unsubUrl
        });
        const result = await sendEmailViaResend({
          apiKey,
          from,
          to: r.email,
          subject,
          html
        });
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
    attempted: recipients.length,
    sentOk: ok,
    failures,
    activeSubscribers: countActiveSubscribers(audience.subscribers)
  });
}
