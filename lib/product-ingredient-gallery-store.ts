import { promises as fs } from "fs";
import path from "path";
import { readJsonKv, writeJsonKv } from "./json-kv-store";
import { resolveKeyIngredientImage } from "./key-ingredient-media";

export type IngredientImage = { name: string; imageUrl: string; scale: number; x: number; y: number };
export type IngredientGalleryStore = { products: Record<string, IngredientImage[]> };

const KEY = "maroma:product-ingredient-galleries";
const FILE = "product-ingredient-galleries.json";
const empty = (): IngredientGalleryStore => ({ products: {} });

function normalizeScale(value: unknown): number {
  const scale = Number(value);
  if (!Number.isFinite(scale) || scale <= 3) return 100;
  return Math.max(50, Math.min(220, scale));
}

function normalizeItem(item: Partial<IngredientImage> | null | undefined): IngredientImage | null {
  const name = String(item?.name || "").trim();
  if (!name) return null;
  return {
    name,
    imageUrl: String(item?.imageUrl || "").trim() || resolveKeyIngredientImage(name),
    scale: normalizeScale(item?.scale),
    x: Math.max(0, Math.min(100, Number(item?.x) || 50)),
    y: Math.max(0, Math.min(100, Number(item?.y) || 50)),
  };
}

function normalizeStore(raw: unknown): IngredientGalleryStore {
  if (!raw || typeof raw !== "object") return empty();
  const obj = raw as Record<string, unknown>;
  const source =
    obj.products && typeof obj.products === "object" && !Array.isArray(obj.products)
      ? (obj.products as Record<string, unknown>)
      : obj;
  const products: Record<string, IngredientImage[]> = {};
  for (const [id, value] of Object.entries(source)) {
    if (id === "products" || !Array.isArray(value)) continue;
    const items = value.map((item) => normalizeItem(item as Partial<IngredientImage>)).filter((item): item is IngredientImage => Boolean(item));
    if (items.length) products[id] = items;
  }
  return { products };
}

async function readFileStore(): Promise<IngredientGalleryStore> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", FILE), "utf8");
    return normalizeStore(JSON.parse(raw));
  } catch {
    return empty();
  }
}

export async function readIngredientGalleryStore(): Promise<IngredientGalleryStore> {
  const fileStore = await readFileStore();
  const stored = normalizeStore(await readJsonKv<unknown>(KEY, FILE, empty()));
  const products = { ...fileStore.products };
  for (const [id, items] of Object.entries(stored.products)) {
    if (items.length) products[id] = items;
  }
  return { products };
}

export const writeIngredientGalleryStore = (value: IngredientGalleryStore) => writeJsonKv(KEY, FILE, value);

export function galleryItemsForProduct(store: IngredientGalleryStore, productId: string): IngredientImage[] {
  return store.products[productId] ?? [];
}
