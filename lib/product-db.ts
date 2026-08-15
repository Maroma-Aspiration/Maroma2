import { promises as fs } from "fs";
import path from "path";
import { hasDisplayImage } from "./product-image";
import type { ProductRecord } from "./product-types";
import { kv } from "@vercel/kv";
import { normalizeProductInciFields } from "./product-inci-extract";

export type { ProductRecord } from "./product-types";

export type ProductOverride = {
  imageUrl?: string;
  images?: string[];
  updatedAt: string;
};

type ProductOverrideStore = {
  overrides: Record<string, ProductOverride>;
};

const productDataPath = path.join(process.cwd(), "data", "maroma-products.json");
const overrideDataPath = path.join(process.cwd(), "data", "product-overrides.json");
const overrideKvKey = "maroma:product-image-overrides";
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const readJson = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const cleanText = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .replace(/\\n\s*KEY INGREDIENTS\s*\\n/gi, "")
    .replace(/\n\s*KEY INGREDIENTS\s*\n/gi, "")
    .replace(/KEY INGREDIENTS/gi, "")
    .trim();
};

export const readProducts = async (): Promise<ProductRecord[]> => {
  const products = await readJson<ProductRecord[]>(productDataPath, []);
  return products.map((product) => {
    // Promote INCI before description cleanup so formula text is not lost.
    const normalized = normalizeProductInciFields(product).product;
    return {
      ...normalized,
      shortDescription: cleanText(normalized.shortDescription),
      description: cleanText(normalized.description),
    };
  });
};

export const readOverrides = async (): Promise<ProductOverrideStore> => {
  if (hasKvConfig) {
    try {
      const stored = await kv.get<ProductOverrideStore>(overrideKvKey);
      if (stored?.overrides) return stored;
    } catch {}
  }
  return readJson<ProductOverrideStore>(overrideDataPath, { overrides: {} });
};

export const writeOverrides = async (store: ProductOverrideStore): Promise<void> => {
  if (hasKvConfig) {
    await kv.set(overrideKvKey, store);
    return;
  }
  await fs.mkdir(path.dirname(overrideDataPath), { recursive: true });
  await fs.writeFile(overrideDataPath, JSON.stringify(store, null, 2), "utf8");
};

const normalize = (value: string): string => value.toLowerCase().trim();

export const withOverrides = (
  products: ProductRecord[],
  store: ProductOverrideStore
): ProductRecord[] => {
  return products.map((product) => {
    const override = store.overrides[product.id];
    if (!override) {
      return product;
    }
    return {
      ...product,
      imageUrl: override.imageUrl ?? product.imageUrl,
      images: override.images && override.images.length > 0 ? override.images : product.images
    };
  });
};

type ProductQuery = {
  q?: string;
  category?: string;
  limit?: number;
  onlyWithImages?: boolean;
  excludeGiftSets?: boolean;
};

export const filterProducts = (
  products: ProductRecord[],
  query: ProductQuery
): ProductRecord[] => {
  const q = normalize(query.q ?? "");
  const category = normalize(query.category ?? "");
  const limit = query.limit && query.limit > 0 ? query.limit : undefined;
  const onlyWithImages = query.onlyWithImages === true;
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenRe = q ? new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(q)}(?:[^a-z0-9]|$)`) : null;

  const filtered = products.filter((product) => {
    if (onlyWithImages && !hasDisplayImage(product)) {
      return false;
    }

    if (query.excludeGiftSets) {
      const nameLower = product.name.toLowerCase();
      const isGiftSet = 
        product.categories.some(c => normalize(c).includes("gifting")) ||
        nameLower.includes("gift set") ||
        nameLower.includes("giftset") ||
        nameLower.includes("nurture set"); // Specifically seen in screenshot
      
      if (isGiftSet) {
        return false;
      }
    }

    const matchesCategory =
      !category ||
      product.categories.some((entry) => normalize(entry).includes(category));

    if (!matchesCategory) {
      return false;
    }

    if (!q) {
      return true;
    }

    // Catalog fields only — skip descriptions/ingredients ("coconut oil" etc.).
    // Whole-token match so "oil" does not hit "Olibanum".
    const fields = [
      normalize(product.name),
      ...product.categories.map((entry) => normalize(entry)),
      ...product.tags.map((entry) => normalize(entry)),
      normalize(product.sku),
      normalize(product.brand),
    ];

    return fields.some((field) => (field ? tokenRe!.test(field) : false));
  });

  if (q) {
    filtered.sort((a, b) => {
      const aName = normalize(a.name);
      const bName = normalize(b.name);
      const aNameHit = aName.includes(q);
      const bNameHit = bName.includes(q);
      if (aNameHit !== bNameHit) return aNameHit ? -1 : 1;
      const aStarts = aName.startsWith(q) || aName.includes(` ${q}`);
      const bStarts = bName.startsWith(q) || bName.includes(` ${q}`);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return aName.localeCompare(bName);
    });
  }

  if (limit) {
    return filtered.slice(0, limit);
  }

  return filtered;
};
