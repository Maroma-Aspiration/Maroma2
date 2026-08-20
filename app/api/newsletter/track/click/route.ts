import { NextResponse } from "next/server";
import { recordNewsletterClick } from "../../../../../lib/newsletter-audience-storage";
import { verifyTrackingToken } from "../../../../../lib/newsletter-tracking";

export const dynamic = "force-dynamic";

function safeRedirectTarget(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return null;
    }
    return u.toString();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const secret = process.env.NEWSLETTER_TRACKING_SECRET?.trim();
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  const targetRaw = url.searchParams.get("u") ?? "";

  let target = safeRedirectTarget(targetRaw);

  if (secret && token) {
    const payload = verifyTrackingToken(token, secret);
    if (payload?.typ === "c") {
      await recordNewsletterClick(payload.cid, payload.sid);
    }
  }

  if (!target) {
    target = "/blog";
  }

  return NextResponse.redirect(target, 302);
}
