import { readJsonKv, writeJsonKv } from "./json-kv-store";
import { isCanvasFirebaseConfigured, uploadCanvasBuffer } from "./canvas-firebase-storage";
import { catalogCategories } from "./catalog-categories";
import type { CategoryBannerOverride, CategoryBannerStore } from "./category-banner-types";
import { SITE_URL } from "./newsletter-archive-seo";
import { isFirebasePublicMediaUrl, isLegacyBlobMediaUrl } from "./usable-media-url";
import path from "path";

const CATEGORY_KV_KEY = "maroma:category-banner-overrides";
const CATEGORY_FILE = "category-banner-overrides.json";
export const STOREFRONT_FIREBASE_MEDIA_VERSION = "storefront-categories-v3";

export type StorefrontFirebaseMigrateResult = {
  skipped: boolean;
  reason?: string;
  configured: boolean;
  uploaded: number;
  rewritten: number;
  failed: string[];
  banners: Record<string, { imageUrl?: string; cardImageUrl?: string }>;
};

let inflight: Promise<StorefrontFirebaseMigrateResult> | null = null;
let lastErrorAt = 0;

function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  return "image/jpeg";
}

function extFromPath(filePath: string): string {
  const ext = path.extname(filePath).replace(".", "").toLowerCase();
  if (ext === "jpeg") return "jpg";
  return ext || "png";
}

function publicRelPath(value: string): string {
  return value.replace(/^\/+/, "");
}

function candidateOrigins(): string[] {
  return [SITE_URL];
}

function hasImageMagic(buffer: Buffer): boolean {
  if (buffer.byteLength < 12) return false;
  if (buffer[0] === 0x3c) return false;
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return true;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return true;
  const head = buffer.toString("ascii", 0, 4);
  return head === "RIFF" || head === "GIF8";
}

function looksLikeImage(buffer: Buffer, contentType: string): boolean {
  if (!/^image\//i.test(contentType.split(";")[0].trim())) return false;
  return hasImageMagic(buffer);
}

async function firebaseUrlIsRealImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Range: "bytes=0-31" },
    });
    if (!res.ok) return false;
    return hasImageMagic(Buffer.from(await res.arrayBuffer()));
  } catch {
    return false;
  }
}

async function shouldReplaceMedia(url: string | undefined, force: boolean): Promise<boolean> {
  if (force) return true;
  const trimmed = (url ?? "").trim();
  if (!trimmed || isLegacyBlobMediaUrl(trimmed)) return true;
  if (isFirebasePublicMediaUrl(trimmed)) return !(await firebaseUrlIsRealImage(trimmed));
  return true;
}

async function readLocalPublicFile(
  publicPath: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const rel = publicRelPath(publicPath);
  if (!rel.startsWith("staging-media/")) return null;

  for (const origin of candidateOrigins()) {
    try {
      const res = await fetch(`${origin}/${rel}`, { cache: "no-store" });
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") || mimeFromPath(rel);
      if (looksLikeImage(buffer, contentType)) {
        return { buffer, contentType: mimeFromPath(rel) };
      }
    } catch {
      /* try next origin */
    }
  }
  return null;
}

async function uploadPublicFallback(objectPath: string, publicPath: string): Promise<string> {
  const file = await readLocalPublicFile(publicPath);
  if (!file) {
    throw new Error(`Missing local media ${publicPath}`);
  }
  return uploadCanvasBuffer(objectPath, file.buffer, file.contentType);
}

const skipped = (
  reason: string,
  configured: boolean
): StorefrontFirebaseMigrateResult => ({
  skipped: true,
  reason,
  configured,
  uploaded: 0,
  rewritten: 0,
  failed: [],
  banners: {},
});

export async function migrateStorefrontMediaToFirebase(
  force = false
): Promise<StorefrontFirebaseMigrateResult> {
  if (!isCanvasFirebaseConfigured()) {
    return skipped("firebase-unconfigured", false);
  }

  if (!force && lastErrorAt && Date.now() - lastErrorAt < 60_000) {
    return skipped("backoff", true);
  }

  const stored = await readJsonKv<CategoryBannerStore>(CATEGORY_KV_KEY, CATEGORY_FILE, {
    banners: {},
  });
  if (!force && stored.firebaseMediaVersion === STOREFRONT_FIREBASE_MEDIA_VERSION) {
    return skipped("already-migrated", true);
  }

  let uploaded = 0;
  let rewritten = 0;
  const failed: string[] = [];
  const banners: StorefrontFirebaseMigrateResult["banners"] = {};
  const next: CategoryBannerStore = {
    banners: { ...(stored.banners ?? {}) },
  };

  for (const category of catalogCategories) {
    const prev: CategoryBannerOverride = { ...(next.banners[category.slug] ?? {}) };
    const fallback = category.bannerImage?.trim() || "";
    if (!fallback) {
      failed.push(`${category.slug}:no-fallback`);
      continue;
    }

    const ext = extFromPath(fallback);
    const objectPath = `storefront/category/${category.slug}/image.${ext}`;
    let imageUrl = (prev.imageUrl ?? "").trim();
    let cardImageUrl = (prev.cardImageUrl ?? "").trim();

    try {
      if (await shouldReplaceMedia(imageUrl, force)) {
        imageUrl = await uploadPublicFallback(objectPath, fallback);
        uploaded += 1;
        rewritten += 1;
      }
    } catch (err) {
      failed.push(`${category.slug}:image:${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      if (await shouldReplaceMedia(cardImageUrl, force)) {
        cardImageUrl = isFirebasePublicMediaUrl(imageUrl)
          ? imageUrl
          : await uploadPublicFallback(`storefront/category/${category.slug}/card.${ext}`, fallback);
        if (cardImageUrl !== (prev.cardImageUrl ?? "").trim()) rewritten += 1;
      }
    } catch (err) {
      failed.push(`${category.slug}:card:${err instanceof Error ? err.message : String(err)}`);
    }

    next.banners[category.slug] = {
      ...prev,
      ...(imageUrl ? { imageUrl } : {}),
      ...(cardImageUrl ? { cardImageUrl } : {}),
      updatedAt: new Date().toISOString(),
    };
    banners[category.slug] = {
      ...(imageUrl ? { imageUrl } : {}),
      ...(cardImageUrl ? { cardImageUrl } : {}),
    };
  }

  if (failed.length === 0) {
    lastErrorAt = 0;
    next.firebaseMediaVersion = STOREFRONT_FIREBASE_MEDIA_VERSION;
  } else {
    lastErrorAt = Date.now();
  }

  try {
    await writeJsonKv(CATEGORY_KV_KEY, CATEGORY_FILE, next);
  } catch (err) {
    lastErrorAt = Date.now();
    throw err;
  }

  console.info("[storefront-firebase-media]", {
    uploaded,
    rewritten,
    failed: failed.length,
  });

  return {
    skipped: false,
    configured: true,
    uploaded,
    rewritten,
    failed,
    banners,
  };
}

export function ensureStorefrontMediaOnFirebase(
  force = false
): Promise<StorefrontFirebaseMigrateResult> {
  if (!force && inflight) return inflight;
  const run = migrateStorefrontMediaToFirebase(force).finally(() => {
    if (inflight === run) inflight = null;
  });
  inflight = run;
  return run;
}
