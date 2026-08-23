import { readJsonKv, writeJsonKv } from "./json-kv-store";
import type { SiteMediaGalleryStore, SiteMediaItem } from "./site-media-gallery-types";

export type { SiteMediaItem, SiteMediaGalleryStore } from "./site-media-gallery-types";

const KV_KEY = "maroma:site-media-gallery";
const FILE_NAME = "site-media-gallery.json";

const emptyStore = (): SiteMediaGalleryStore => ({ items: [] });

export async function readSiteMediaGallery(): Promise<SiteMediaGalleryStore> {
  const store = await readJsonKv<SiteMediaGalleryStore>(KV_KEY, FILE_NAME, emptyStore());
  if (!Array.isArray(store.items)) {
    return emptyStore();
  }
  return {
    items: store.items.filter(
      (item): item is SiteMediaItem =>
        Boolean(item && typeof item.id === "string" && typeof item.url === "string")
    ),
  };
}

export async function writeSiteMediaGallery(store: SiteMediaGalleryStore): Promise<void> {
  await writeJsonKv(KV_KEY, FILE_NAME, store);
}

export async function registerSiteMediaItem(
  item: Omit<SiteMediaItem, "id" | "uploadedAt"> & { id?: string; uploadedAt?: string }
): Promise<SiteMediaItem> {
  const store = await readSiteMediaGallery();
  const existing = store.items.find((entry) => entry.url === item.url);
  if (existing) {
    return existing;
  }
  const next: SiteMediaItem = {
    id: item.id ?? `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: item.url,
    filename: item.filename,
    label: item.label?.trim() || undefined,
    alt: item.alt?.trim() || undefined,
    tags: item.tags?.length ? item.tags : undefined,
    uploadedAt: item.uploadedAt ?? new Date().toISOString(),
  };
  store.items.unshift(next);
  await writeSiteMediaGallery(store);
  return next;
}

export async function deleteSiteMediaItem(id: string): Promise<boolean> {
  const store = await readSiteMediaGallery();
  const before = store.items.length;
  store.items = store.items.filter((item) => item.id !== id);
  if (store.items.length === before) {
    return false;
  }
  await writeSiteMediaGallery(store);
  return true;
}

export async function updateSiteMediaItem(
  id: string,
  patch: Partial<Pick<SiteMediaItem, "label" | "alt" | "tags">>
): Promise<SiteMediaItem | null> {
  const store = await readSiteMediaGallery();
  const index = store.items.findIndex((item) => item.id === id);
  if (index < 0) {
    return null;
  }
  const prev = store.items[index];
  const next: SiteMediaItem = {
    ...prev,
    label: patch.label !== undefined ? patch.label.trim() || undefined : prev.label,
    alt: patch.alt !== undefined ? patch.alt.trim() || undefined : prev.alt,
    tags: patch.tags !== undefined ? (patch.tags.length ? patch.tags : undefined) : prev.tags,
  };
  store.items[index] = next;
  await writeSiteMediaGallery(store);
  return next;
}
