import { NextResponse } from "next/server";
import { importStoriesFromUrls } from "../../../../lib/story-import";
import { revalidateStoryConsumerRoutes } from "../../../../lib/revalidate-story-pages";
import { mergeStoryById, readStoriesState, writeStoriesState } from "../../../../lib/story-storage";
import { discoverUrlsForQuery } from "../../../../lib/story-web-search";

const DEFAULT_QUERY = "Maroma Auroville";

/**
 * Search the web for URLs matching the query, then draft stories via OG/metadata fetch (same as paste-import).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: string; maxResults?: number };
    const query = typeof body.query === "string" && body.query.trim() ? body.query.trim() : DEFAULT_QUERY;
    const maxResults = typeof body.maxResults === "number" ? body.maxResults : 12;

    const discovery = await discoverUrlsForQuery(query, maxResults);
    if (discovery.urls.length === 0) {
      return NextResponse.json({
        importedCount: 0,
        discoveredCount: 0,
        provider: discovery.provider,
        hint: discovery.hint,
        state: await readStoriesState()
      });
    }

    const imported = await importStoriesFromUrls(discovery.urls);
    const state = await readStoriesState();
    const nextState = {
      ...state,
      stories: mergeStoryById(state.stories, imported)
    };
    await writeStoriesState(nextState);
    revalidateStoryConsumerRoutes();

    return NextResponse.json({
      importedCount: imported.length,
      discoveredCount: discovery.urls.length,
      provider: discovery.provider,
      urls: discovery.urls,
      hint: discovery.hint,
      state: nextState
    });
  } catch {
    return NextResponse.json({ error: "Unable to search and import stories." }, { status: 500 });
  }
}
