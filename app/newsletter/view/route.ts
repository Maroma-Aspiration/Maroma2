import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { canEditNewsletter } from "../../../lib/auth-roles";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../lib/auth-session";
import { readStoriesState } from "../../../lib/story-storage";
import { ensureCanvasPublicImageUrls } from "../../../lib/canvas-email-images";
import { canvasToEmailHtml, canvasEmailOptionsFromState } from "../../../lib/canvas-to-email";
import { signNewsletterImageUrls } from "../../../lib/newsletter-image-proxy";
import { optimizeMastheadImagesInEmailHtml } from "../../../lib/canvas-display-image";

export const dynamic = "force-dynamic";

/** Public "view in browser" — same HTML as the sent email. Admins see the editor. */
export async function GET(request: Request) {
  noStore();
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (canEditNewsletter(session?.role)) {
    return NextResponse.redirect(new URL("/newsletter", request.url));
  }

  const state = await readStoriesState();
  const canvas = state.newsletterCanvas;
  if (!canvas?.enabled || !canvas.elements?.length) {
    return new Response("<p>No newsletter issue is available yet.</p>", {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://maroma-staging-isolated.vercel.app").replace(
    /\/$/,
    "",
  );
  const publicCanvas = await ensureCanvasPublicImageUrls(canvas, siteUrl);
  const unsignedHtml = canvasToEmailHtml(publicCanvas, {
    ...canvasEmailOptionsFromState(state, {
      siteUrl,
      allowDataUrls: false,
    }),
    tracking: {
      pixelUrl: "",
      unsubUrl: `${siteUrl}/newsletter/unsubscribe`,
      viewOnlineUrl: `${siteUrl}/newsletter/view`,
    },
  });
  const trackingSecret = process.env.NEWSLETTER_TRACKING_SECRET?.trim();
  const signedHtml = trackingSecret ? signNewsletterImageUrls(unsignedHtml, trackingSecret) : unsignedHtml;
  const html = optimizeMastheadImagesInEmailHtml(signedHtml, publicCanvas.elements);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
