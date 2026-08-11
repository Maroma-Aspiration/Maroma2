import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { mergeWithDefaults, parseSiteContent } from "../../../lib/site-content-api";
import type { SiteContent } from "../../../app/content";

const storageDir = path.join(process.cwd(), "data");
const storagePath = path.join(storageDir, "site-content.json");
const siteContentKvKey = "maroma:site-content";
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const legacyCarouselSubtitles = new Set([
  "Our bestsellers bring balance and well-being.",
  "Check out what people are loving right now",
  "See what people are loving right now",
  "See what people are\nloving right now",
]);
const carouselSubtitle = "See what people\nAre loving right now";
const shopCareCtaPrimary = "Shop by Care";

const readSiteContent = async () => {
  if (hasKvConfig) {
    try {
      const stored = await kv.get(siteContentKvKey);
      const parsed = parseSiteContent(stored);
      if (parsed) {
        return parsed;
      }
    } catch {
      // Fall back to file-based state when KV is unavailable.
    }
  }
  try {
    const raw = await fs.readFile(storagePath, "utf8");
    return parseSiteContent(JSON.parse(raw));
  } catch {
    return null;
  }
};

const writeSiteContent = async (next: unknown) => {
  if (hasKvConfig) {
    try {
      await kv.set(siteContentKvKey, next);
      return;
    } catch {
      // Fall back to file-based state when KV write fails.
    }
  }
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(next, null, 2), "utf8");
};

const maybeMigrateCarouselSubtitle = async (content: SiteContent) => {
  if (!legacyCarouselSubtitles.has(content.carousel.subtitle)) {
    return content;
  }
  const next = mergeWithDefaults({
    ...content,
    carousel: { ...content.carousel, subtitle: carouselSubtitle },
  });
  await writeSiteContent(next);
  return next;
};

const maybeMigrateShopCareCta = async (content: SiteContent) => {
  if (content.hero.ctaPrimary !== "Shop Luxury") {
    return content;
  }
  const next = mergeWithDefaults({
    ...content,
    hero: { ...content.hero, ctaPrimary: shopCareCtaPrimary },
  });
  await writeSiteContent(next);
  return next;
};

export async function GET() {
  const content = await readSiteContent();
  if (!content) {
    return NextResponse.json({ content: mergeWithDefaults(null) });
  }
  let migrated = mergeWithDefaults(content);
  migrated = await maybeMigrateCarouselSubtitle(migrated);
  migrated = await maybeMigrateShopCareCta(migrated);
  return NextResponse.json({ content: migrated });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const next = mergeWithDefaults(record.content ?? body);
    await writeSiteContent(next);
    return NextResponse.json({ content: next });
  } catch {
    return NextResponse.json({ error: "Unable to save site content." }, { status: 500 });
  }
}

export async function DELETE() {
  if (hasKvConfig) {
    try {
      await kv.del(siteContentKvKey);
    } catch {
      // Keep behavior best-effort.
    }
  }
  try {
    await fs.unlink(storagePath);
  } catch {
    // noop for missing file
  }
  return NextResponse.json({ content: null });
}
