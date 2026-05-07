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
}): Promise<{ ok: true } | { ok: false; message: string }> {
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
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    return { ok: false, message };
  }
}
