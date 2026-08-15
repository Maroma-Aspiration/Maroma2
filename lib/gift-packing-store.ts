import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import { GIFT_BOXES, GIFT_ELEMENT_DEFS } from "./gift-builder-catalog";
import type { GiftBox, GiftElement, GiftElementCategory, GiftSizeGroup } from "./gift-builder-types";

export type CustomGiftProduct = {
  id: string;
  productId: string;
  description: string;
  category: GiftElementCategory;
};

export type GiftPackingStore = {
  boxes: GiftBox[];
  elementDimensions: Record<string, Pick<GiftElement, "lengthCm" | "widthCm" | "heightCm" | "sizeGroup">>;
  customProducts: CustomGiftProduct[];
  updatedAt: string;
};

const key = "maroma:gift-packing";
const filePath = path.join(process.cwd(), "data", "gift-packing.json");
const hasKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const positive = (value: unknown, fallback: number) => Math.max(0.5, Number(value) || fallback);
const group = (value: unknown): GiftSizeGroup => value === "large" || value === "medium" ? value : "small";

export function defaultGiftPackingStore(): GiftPackingStore {
  return {
    boxes: GIFT_BOXES,
    elementDimensions: Object.fromEntries(GIFT_ELEMENT_DEFS.map((item) => [item.id, {
      lengthCm: item.lengthCm ?? (item.category === "candle" ? 8 : item.category === "soap" ? 10 : 5),
      widthCm: item.widthCm ?? (item.category === "candle" ? 8 : item.category === "soap" ? 7 : 5),
      heightCm: item.heightCm ?? (item.category === "candle" ? 7 : item.category === "soap" ? 4 : 14),
      sizeGroup: item.sizeGroup ?? (item.category === "candle" ? "large" : item.category === "soap" ? "medium" : "small"),
    }])),
    customProducts: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalize(raw: unknown): GiftPackingStore {
  const fallback = defaultGiftPackingStore();
  if (!raw || typeof raw !== "object") return fallback;
  const value = raw as Partial<GiftPackingStore>;
  const savedBoxes = new Map((Array.isArray(value.boxes) ? value.boxes : []).map((box) => [box.id, box]));
  return {
    boxes: GIFT_BOXES.map((box) => {
      const saved = savedBoxes.get(box.id);
      return { ...box, ...saved, lengthCm: positive(saved?.lengthCm, box.lengthCm), widthCm: positive(saved?.widthCm, box.widthCm), heightCm: positive(saved?.heightCm, box.heightCm) };
    }),
    elementDimensions: Object.fromEntries(Object.entries({ ...fallback.elementDimensions, ...(value.elementDimensions ?? {}) }).map(([id, dims]) => {
      const saved = value.elementDimensions?.[id];
      return [id, { lengthCm: positive(saved?.lengthCm, dims.lengthCm), widthCm: positive(saved?.widthCm, dims.widthCm), heightCm: positive(saved?.heightCm, dims.heightCm), sizeGroup: group(saved?.sizeGroup ?? dims.sizeGroup) }];
    })),
    customProducts: (Array.isArray(value.customProducts) ? value.customProducts : []).filter((item) => item && typeof item.id === "string" && typeof item.productId === "string").map((item) => ({ id: item.id, productId: item.productId, description: typeof item.description === "string" ? item.description : "", category: (["scent", "soap", "candle", "wellness", "accent"].includes(item.category) ? item.category : "accent") as GiftElementCategory })),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : fallback.updatedAt,
  };
}

export async function readGiftPackingStore(): Promise<GiftPackingStore> {
  if (hasKv) try { const saved = await kv.get(key); if (saved) return normalize(saved); } catch {}
  try { return normalize(JSON.parse(await fs.readFile(filePath, "utf8"))); } catch { return defaultGiftPackingStore(); }
}

export async function writeGiftPackingStore(value: GiftPackingStore): Promise<GiftPackingStore> {
  const next = normalize({ ...value, updatedAt: new Date().toISOString() });
  if (hasKv) try { await kv.set(key, next); return next; } catch {}
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}
