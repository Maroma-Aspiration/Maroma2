import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { migrateCanvasImagesToFirebase } from "../../../../lib/canvas-migrate-to-firebase";
import { revalidateStoryConsumerRoutes } from "../../../../lib/revalidate-story-pages";
import { readStoriesState, writeStoriesState } from "../../../../lib/story-storage";

export async function POST() {
  const secret = getSessionSecret();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }

  try {
    const state = await readStoriesState();
    const result = await migrateCanvasImagesToFirebase(state);
    if (!result.configured) {
      return NextResponse.json(
        {
          error:
            "No public image storage configured. Set FIREBASE_* env vars and/or BLOB_READ_WRITE_TOKEN.",
        },
        { status: 503 }
      );
    }

    const changed = result.migrated > 0;
    if (changed) {
      await writeStoriesState(result.state);
      revalidateStoryConsumerRoutes();
    }

    return NextResponse.json({
      urlsFound: result.urlsFound,
      migrated: result.migrated,
      skipped: result.skipped,
      failed: result.failed,
      saved: changed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Migration failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
