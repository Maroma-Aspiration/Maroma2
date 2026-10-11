import { NextResponse } from "next/server";
import { refreshStorySnapshotsInBlocks } from "../../../../lib/newsletter-migrate-legacy-blocks";
import { revalidateStoryConsumerRoutes } from "../../../../lib/revalidate-story-pages";
import {
  importInstagramStories,
  instagramConfigStatus,
} from "../../../../lib/story-instagram";
import { mergeStoryById, readStoriesState, writeStoriesState } from "../../../../lib/story-storage";
import type { StoryRecord } from "../../../../lib/story-types";

export const maxDuration = 60;

export async function GET() {
  return NextResponse.json(instagramConfigStatus());
}

function applyImportedStories(
  existing: StoryRecord[],
  incoming: StoryRecord[],
  replace: boolean,
): StoryRecord[] {
  if (!replace) return mergeStoryById(existing, incoming);
  const kept = existing.filter((story) => story.kind === "divider" || story.kind === "text");
  return mergeStoryById(kept, incoming);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      days?: number;
      replaceStories?: boolean;
    };
    const imported = await importInstagramStories({
      days: body.days,
      replaceStories: body.replaceStories,
    });
    const state = await readStoriesState();
    const stories = applyImportedStories(
      state.stories,
      imported.stories,
      body.replaceStories !== false,
    );
    const nextState = refreshStorySnapshotsInBlocks({ ...state, stories });
    await writeStoriesState(nextState);
    revalidateStoryConsumerRoutes();
    return NextResponse.json({
      importedCount: imported.stories.length,
      withImages: imported.withImages,
      scanned: imported.scanned,
      username: imported.username,
      state: nextState,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to import Instagram posts.";
    const status = /not set|Could not find/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
