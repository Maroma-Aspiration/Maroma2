import { NextResponse } from "next/server";
import { importStoriesFromRssFeeds } from "../../../../lib/story-rss";
import { revalidateStoryConsumerRoutes } from "../../../../lib/revalidate-story-pages";
import { mergeStoryById, readStoriesState, writeStoriesState } from "../../../../lib/story-storage";

/**
 * Pull latest items from configured RSS/Atom feeds and merge into stories.
 * Does not require Meta — use any feed your aggregator / terms allow.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { feedUrls?: string[] };
    const feedUrls = Array.isArray(body.feedUrls) ? body.feedUrls : [];
    const cleanedFeeds = Array.from(new Set(feedUrls.map((u) => u.trim()).filter(Boolean)));
    const imported = await importStoriesFromRssFeeds(cleanedFeeds);
    const state = await readStoriesState();
    const nextState = {
      ...state,
      rssFeedUrls: cleanedFeeds.length > 0 ? cleanedFeeds : state.rssFeedUrls,
      stories: mergeStoryById(state.stories, imported)
    };
    await writeStoriesState(nextState);
    revalidateStoryConsumerRoutes();
    return NextResponse.json({
      importedCount: imported.length,
      state: nextState
    });
  } catch {
    return NextResponse.json({ error: "Unable to import from RSS feeds." }, { status: 500 });
  }
}
