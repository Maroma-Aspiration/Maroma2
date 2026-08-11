import { NextResponse } from "next/server";
import {
  parseHeroVisualState,
  readPersistedHeroVisualState,
  writePersistedHeroVisualState,
  type HeroVisualState
} from "../../../lib/hero-media-layout-state";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
};

export async function GET() {
  const state = await readPersistedHeroVisualState();
  return NextResponse.json({ ...state, layout: state.layout }, { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const existing = await readPersistedHeroVisualState();
    const patch =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const merged = {
      ...existing,
      ...patch,
      ...(patch.mobile && typeof patch.mobile === "object"
        ? { mobile: { ...(existing.mobile ?? {}), ...(patch.mobile as object) } }
        : {}),
      ...(patch.primarySettings && typeof patch.primarySettings === "object"
        ? {
            primarySettings: {
              ...existing.primarySettings,
              ...(patch.primarySettings as object),
            },
          }
        : {}),
      ...(patch.overlayLayer && typeof patch.overlayLayer === "object"
        ? {
            overlayLayer: {
              ...existing.overlayLayer,
              ...(patch.overlayLayer as object),
              layout:
                (patch.overlayLayer as { layout?: unknown }).layout ??
                existing.overlayLayer.layout,
            },
          }
        : {}),
    };
    const next = parseHeroVisualState(merged, existing);

    await writePersistedHeroVisualState(next);
    return NextResponse.json({ ...next, layout: next.layout }, { headers: noStoreHeaders });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save hero media layout.";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
