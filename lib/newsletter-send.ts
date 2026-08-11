import { signTrackingPayload, trackingTtlMs } from "./newsletter-tracking";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function normalizeSiteOrigin(raw: string): string {
  return raw.replace(/\/$/, "");
}

/** Prefer `NEXT_PUBLIC_SITE_URL`; otherwise infer from request headers (tracking links must be absolute). */
export function siteOriginFromRequest(request: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) {
    return normalizeSiteOrigin(env);
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  if (!host) {
    return "http://localhost:3003";
  }
  return normalizeSiteOrigin(`${proto}://${host}`);
}

/** Absolute URL to the web newsletter (read-online link target). */
export function newsletterReadOnlineUrl(origin: string, path = "/newsletter"): string {
  const base = normalizeSiteOrigin(origin);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export function buildTrackedNewsletterUrls(
  origin: string,
  subscriberId: string,
  campaignId: string,
  secret: string,
  newsletterPath = "/newsletter"
): { pixelUrl: string; readOnlineTrackUrl: string; unsubUrl: string } {
  const base = normalizeSiteOrigin(origin);
  const readTarget = newsletterReadOnlineUrl(origin, newsletterPath);
  const openExp = trackingTtlMs(90);
  const unsubExp = trackingTtlMs(365);
  const openTok = signTrackingPayload({ sid: subscriberId, cid: campaignId, typ: "o", exp: openExp }, secret);
  const clickTok = signTrackingPayload({ sid: subscriberId, cid: campaignId, typ: "c", exp: openExp }, secret);
  const unsubTok = signTrackingPayload({ sid: subscriberId, cid: campaignId, typ: "u", exp: unsubExp }, secret);
  return {
    pixelUrl: `${base}/api/newsletter/track/open?t=${encodeURIComponent(openTok)}`,
    readOnlineTrackUrl: `${base}/api/newsletter/track/click?t=${encodeURIComponent(
      clickTok
    )}&u=${encodeURIComponent(readTarget)}`,
    unsubUrl: `${base}/newsletter/unsubscribe?t=${encodeURIComponent(unsubTok)}`
  };
}

export function buildNewsletterEmailHtml(opts: {
  greetingName: string;
  readOnlineTrackUrl: string;
  pixelUrl: string;
  unsubUrl: string;
}): string {
  const name = escapeHtml(opts.greetingName.trim() || "there");
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;background:#fafafa">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td>
    <p style="margin:0 0 12px">Hello ${name},</p>
    <p style="margin:0 0 16px"><a href="${escapeHtml(opts.readOnlineTrackUrl)}" style="color:#1a6b5c">Read this issue online</a></p>
    <p style="margin:0;font-size:13px;color:#555">Thank you for reading.<br/>Maroma</p>
    <img src="${escapeHtml(opts.pixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />
    <p style="margin:24px 0 0;font-size:12px;color:#888"><a href="${escapeHtml(
      opts.unsubUrl
    )}" style="color:#888">Unsubscribe</a></p>
  </td></tr></table>
</body></html>`;
}

export async function sendEmailViaResend(opts: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: opts.from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html
      })
    });
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, message: text || response.statusText };
    }
    return { ok: true, provider: "resend" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    return { ok: false, message };
  }
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type SendEmailResult =
  | { ok: true; messageId?: string; provider: "postmark" | "resend" }
  | { ok: false; message: string };

export async function sendEmailViaPostmark(opts: {
  serverToken: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  textBody?: string;
  forTest?: boolean;
}): Promise<SendEmailResult> {
  try {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "X-Postmark-Server-Token": opts.serverToken,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        From: opts.from,
        To: opts.to,
        Subject: opts.subject,
        HtmlBody: opts.html,
        TextBody: opts.textBody ?? htmlToPlainText(opts.html),
        MessageStream: postmarkMessageStream(opts.forTest)
      })
    });
    const text = await response.text();
    if (!response.ok) {
      try {
        const j = JSON.parse(text) as { Message?: string };
        if (j.Message) return { ok: false, message: j.Message };
      } catch {
        /* plain text */
      }
      return { ok: false, message: text || response.statusText };
    }
    try {
      const j = JSON.parse(text) as { MessageID?: string; Message?: string };
      if (j.Message && j.Message !== "OK") {
        return { ok: false, message: j.Message };
      }
      return { ok: true, messageId: j.MessageID, provider: "postmark" };
    } catch {
      return { ok: true, provider: "postmark" };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    return { ok: false, message };
  }
}

function postmarkMessageStream(forTest = false): string {
  if (forTest) {
    return process.env.POSTMARK_TEST_MESSAGE_STREAM?.trim() || "outbound";
  }
  return process.env.POSTMARK_MESSAGE_STREAM?.trim() || "broadcast";
}

const FROM_EMAIL_RE = /[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/;

/** Strip accidental quotes from Vercel env values. */
export function normalizeFromEmail(raw: string): string {
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** Normalized sender from env, or empty if unset/invalid (e.g. `""` on Vercel). */
export function resolveFromEmail(raw = process.env.NEWSLETTER_FROM_EMAIL): string {
  if (!raw?.trim()) return "";
  const normalized = normalizeFromEmail(raw);
  if (!normalized) return "";
  return FROM_EMAIL_RE.test(normalized) ? normalized : "";
}

/** Send via whichever provider is configured (Postmark takes priority over Resend). */
export async function sendEmail(opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
  forTest?: boolean;
}): Promise<SendEmailResult> {
  const postmarkToken = process.env.POSTMARK_SERVER_TOKEN?.trim();
  if (postmarkToken) {
    return sendEmailViaPostmark({ serverToken: postmarkToken, ...opts });
  }
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    return sendEmailViaResend({ apiKey: resendKey, ...opts });
  }
  return { ok: false, message: "No email provider configured. Set POSTMARK_SERVER_TOKEN or RESEND_API_KEY." };
}
