import { NextResponse } from "next/server";
import { recordNewsletterOpen } from "../../../../../lib/newsletter-audience-storage";
import { verifyTrackingToken } from "../../../../../lib/newsletter-tracking";

export const dynamic = "force-dynamic";

/** Transparent 1×1 GIF */
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(request: Request) {
  const secret = process.env.NEWSLETTER_TRACKING_SECRET?.trim();
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";

  if (secret && token) {
    const payload = verifyTrackingToken(token, secret);
    if (payload?.typ === "o") {
      await recordNewsletterOpen(payload.cid, payload.sid);
    }
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}
