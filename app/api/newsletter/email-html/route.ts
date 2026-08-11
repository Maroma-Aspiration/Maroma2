import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { readStoriesState } from "../../../../lib/story-storage";
import { ensureCanvasPublicImageUrls } from "../../../../lib/canvas-email-images";
import { canvasToEmailHtml, canvasEmailOptionsFromState } from "../../../../lib/canvas-to-email";

export async function GET(request: Request) {
  // Auth guard — admin only
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const state = await readStoriesState();

  if (!state.newsletterCanvas?.enabled || !state.newsletterCanvas.elements?.length) {
    return NextResponse.json({ error: "No canvas content to export." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("subject") || `Maroma Newsletter`;
  const previewText = searchParams.get("preview") || "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://maroma-staging-isolated.vercel.app";

  const html = canvasToEmailHtml(
    await ensureCanvasPublicImageUrls(state.newsletterCanvas, siteUrl),
    canvasEmailOptionsFromState(state, {
      subject,
      previewText,
      siteUrl,
      allowDataUrls: false,
    })
  );

  // Return as plain HTML so it can be opened in a browser or pasted into a send tool
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="newsletter-email.html"`,
      "Cache-Control": "no-store",
    },
  });
}
