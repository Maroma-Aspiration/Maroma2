import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import {
  defaultHeroVisualState,
  parseHeroVisualState,
} from "./hero-visual-state-parse";
import { RITUAL_CAROUSEL_STACK_REV } from "./hero-layer-depth";
import { getVisualStateUpdatedAt } from "./hero-visual-state-merge";
import {
  type HeroMediaLayout,
  type XY,
  type HeroLayerSettings,
  type HeroOverlayLayer,
  type HeroVisualState,
  VISUAL_STATE_STORAGE_KEY,
} from "./hero-media-layout-types";

export {
  type HeroMediaLayout,
  type XY,
  type HeroLayerSettings,
  type HeroOverlayLayer,
  type HeroVisualState,
  VISUAL_STATE_STORAGE_KEY,
  defaultHeroVisualState,
  parseHeroVisualState,
};

const storageDir = path.join(process.cwd(), "data");
const storagePath = path.join(storageDir, "hero-media-layout.json");
const heroLayoutKvKey = "maroma:hero-media-layout";
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

function readStackRev(raw: unknown): number {
  if (!raw || typeof raw !== "object") {
    return 0;
  }
  const rev = (raw as { ritualCarouselStackRev?: number }).ritualCarouselStackRev;
  return typeof rev === "number" && Number.isFinite(rev) ? Math.round(rev) : 0;
}

export async function readHeroVisualStateFromDisk(): Promise<HeroVisualState> {
  try {
    const raw = await fs.readFile(storagePath, "utf8");
    return parseHeroVisualState(JSON.parse(raw));
  } catch {
    return defaultHeroVisualState;
  }
}

/** Production KV + disk fallback — use for SSR and API reads. */
export async function readPersistedHeroVisualState(): Promise<HeroVisualState> {
  let raw: unknown = null;

  if (hasKvConfig) {
    try {
      raw = await kv.get<HeroVisualState>(heroLayoutKvKey);
    } catch {
      // Fall back to file when KV is unavailable.
    }
  }

  if (!raw || typeof raw !== "object") {
    try {
      raw = JSON.parse(await fs.readFile(storagePath, "utf8"));
    } catch {
      return defaultHeroVisualState;
    }
  }

  const beforeRev = readStackRev(raw);
  const state = parseHeroVisualState(raw);

  if (beforeRev < RITUAL_CAROUSEL_STACK_REV) {
    try {
      await writePersistedHeroVisualState(state);
    } catch {
      // Serve migrated in-memory state even if write fails.
    }
  }

  return state;
}

export async function writePersistedHeroVisualState(next: HeroVisualState): Promise<void> {
  const parsed = parseHeroVisualState({
    ...next,
    updatedAt: getVisualStateUpdatedAt(next) || Date.now(),
  });
  if (hasKvConfig) {
    try {
      await kv.set(heroLayoutKvKey, parsed);
      return;
    } catch {
      if (process.env.VERCEL) {
        throw new Error("Unable to save hero layout to Vercel KV.");
      }
    }
  }
  if (process.env.VERCEL) {
    throw new Error(
      "Hero layout persistence requires KV_REST_API_URL and KV_REST_API_TOKEN on Vercel."
    );
  }
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(parsed, null, 2), "utf8");
}

/** @deprecated Use readPersistedHeroVisualState for SSR. */
export async function readHeroVisualState(): Promise<HeroVisualState> {
  return readPersistedHeroVisualState();
}
