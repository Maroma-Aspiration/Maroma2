import { NextResponse } from "next/server";
import { revalidateStoryConsumerRoutes } from "../../../lib/revalidate-story-pages";
import { readStoriesState, writeStoriesState } from "../../../lib/story-storage";
import type { StoriesState } from "../../../lib/story-types";

export async function GET() {
  const state = await readStoriesState();
  return NextResponse.json({ state });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { state?: StoriesState };
    const next = await writeStoriesState(body.state ?? (body as StoriesState));
    revalidateStoryConsumerRoutes();
    return NextResponse.json({ state: next });
  } catch {
    return NextResponse.json({ error: "Unable to save stories." }, { status: 500 });
  }
}
