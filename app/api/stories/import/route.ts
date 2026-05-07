import { NextResponse } from "next/server";
import { importStoriesFromUrls } from "../../../../lib/story-import";
import { revalidateStoryConsumerRoutes } from "../../../../lib/revalidate-story-pages";
import { mergeStoryById, readStoriesState, writeStoriesState } from "../../../../lib/story-storage";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { urls?: string[] };
    const urls = Array.isArray(body.urls) ? body.urls : [];
    const imported = await importStoriesFromUrls(urls);
    const state = await readStoriesState();
    const nextState = {
      ...state,
      stories: mergeStoryById(state.stories, imported)
    };
    await writeStoriesState(nextState);
    revalidateStoryConsumerRoutes();
    return NextResponse.json({ importedCount: imported.length, state: nextState });
  } catch {
    return NextResponse.json({ error: "Unable to import stories." }, { status: 500 });
  }
}
