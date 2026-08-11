import { unstable_noStore as noStore } from "next/cache";
import { readStoriesState } from "../../../lib/story-storage";
import { ensureCanvasPublicImageUrls } from "../../../lib/canvas-email-images";
import { canvasToEmailHtml, canvasEmailOptionsFromState } from "../../../lib/canvas-to-email";

export const dynamic = "force-dynamic";

/** Public "view in browser" — same HTML as the sent email. */
export async function GET() {
  noStore();
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
  const html = canvasToEmailHtml(publicCanvas, {
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

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
