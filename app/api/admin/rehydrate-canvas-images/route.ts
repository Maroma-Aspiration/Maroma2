import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { canEditNewsletter } from "../../../../lib/auth-roles";
import { rehydrateCanvasBlobUrls } from "../../../../lib/canvas-blob-rehydrate";
import { revalidateStoryConsumerRoutes } from "../../../../lib/revalidate-story-pages";
import { readStoriesState, writeStoriesState } from "../../../../lib/story-storage";
import { cookies } from "next/headers";

export async function POST() {
  const secret = getSessionSecret();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (!session || !canEditNewsletter(session.role)) {
    return NextResponse.json({ error: "Newsletter editor sign-in required." }, { status: 401 });
  }

  try {
    const state = await readStoriesState();
    const result = await rehydrateCanvasBlobUrls(state);
    if (result.replaced > 0) {
      await writeStoriesState(result.state);
      revalidateStoryConsumerRoutes();
    }
    return NextResponse.json({
      blobUrlsFound: result.blobUrlsFound,
      replaced: result.replaced,
      stillBlocked: result.stillBlocked,
      saved: result.replaced > 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Rehydrate failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
