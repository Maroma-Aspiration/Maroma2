import { promises as fs } from "fs";
import path from "path";
import { hasDisplayImage } from "./product-image";
import type { ProductRecord } from "./product-types";
import { kv } from "@vercel/kv";
import { normalizeProductInciFields } from "./product-inci-extract";
import packagedProductOverrides from "../data/product-overrides.json";
import packagedVideoBlobMap from "../data/product-video-blob-map.json";
import { firstUsablePublicMediaUrl, isUsablePublicMediaUrl } from "./usable-media-url";

export type { ProductRecord } from "./product-types";

export type ProductOverride = {
  imageUrl?: string;
  images?: string[];
  videos?: string[];
  updatedAt: string;
};

type ProductOverrideStore = {
  overrides: Record<string, ProductOverride>;
};

const productDataPath = path.join(process.cwd(), "data", "maroma-products.json");
const overrideDataPath = path.join(process.cwd(), "data", "product-overrides.json");
const overrideKvKey = "maroma:product-image-overrides";
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

function overrideHasVideos(row?: ProductOverride): boolean {
  return Boolean(row?.videos?.some((url) => String(url || "").trim()));
}

function isUsableMappedVideoUrl(url: string): boolean {
  return isUsablePublicMediaUrl(url);
}

function resolveVideoUrl(url: string): string {
  const trimmed = String(url || "").trim();
  if (!trimmed) return trimmed;
  if (isUsableMappedVideoUrl(trimmed) && !trimmed.startsWith("/staging-media/product-videos/")) {
    return trimmed;
  }
  const mapped = (packagedVideoBlobMap as Record<string, string>)[trimmed];
  if (mapped && isUsableMappedVideoUrl(mapped)) return mapped;
  return trimmed;
}

function resolveVideoUrls(urls?: string[]): string[] | undefined {
  if (!urls?.length) return urls;
  return urls.map(resolveVideoUrl);
}

function usableImageList(overrideImages: string[] | undefined, fallback: string[]): string[] {
  const fromOverride = (overrideImages ?? []).filter((url) => isUsablePublicMediaUrl(url));
  if (fromOverride.length > 0) return fromOverride;
  return fallback;
}

function packagedOverrideStore(): ProductOverrideStore {
  const raw = packagedProductOverrides as ProductOverrideStore;
  return { overrides: raw?.overrides ?? {} };
}

/** Keep admin KV image edits, and fill empty video slots from the packaged how-to mappings. */
function mergeDiskVideoOverrides(
  primary: ProductOverrideStore,
  disk: ProductOverrideStore
): ProductOverrideStore {
  const overrides = { ...primary.overrides };
  for (const [id, diskRow] of Object.entries(disk.overrides ?? {})) {
    if (!overrideHasVideos(diskRow)) continue;
    const existing = overrides[id];
    if (!existing) {
      overrides[id] = diskRow;
      continue;
    }
    if (!overrideHasVideos(existing)) {
      overrides[id] = { ...existing, videos: diskRow.videos };
    }
  }
  return { overrides };
}

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
    // Legacy short descriptions append a heading followed by ingredient-only
    // lines. Keep that information in the dedicated PDP ingredient sections.
    .replace(/(?:^|\n)\s*KEY\s+INGREDIENTS\b[\s\S]*$/gi, "")
    .replace(/\\n\s*KEY INGREDIENTS\s*\\n/gi, "")
    .replace(/\n\s*KEY INGREDIENTS\s*\n/gi, "")
    .replace(/KEY INGREDIENTS/gi, "")
    .replace(/\s*not\s+for\s+sale\s+in\s+the\s+uk\s+and\s+channel\s+islands\.?\s*/gi, " ")
    .trim();
};

export const readProducts = async (): Promise<ProductRecord[]> => {
  const products = await readJson<ProductRecord[]>(productDataPath, []);
  return products.map((product) => {
    // Promote INCI before description cleanup so formula text is not lost.
    const normalized = normalizeProductInciFields(product).product;
    return {
      ...normalized,
      ukAndChannelIslandsRestricted: /not\s+for\s+sale\s+in\s+the\s+uk\s+and\s+channel\s+islands/i.test(`${normalized.shortDescription}\n${normalized.description}`),
      shortDescription: cleanText(normalized.shortDescription),
      description: cleanText(normalized.description),
    };
  });
};

export const readOverrides = async (): Promise<ProductOverrideStore> => {
  const disk = packagedOverrideStore();
  if (hasKvConfig) {
    try {
      const stored = await kv.get<ProductOverrideStore>(overrideKvKey);
      if (stored?.overrides) return mergeDiskVideoOverrides(stored, disk);
    } catch {}
  }
  return disk;
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
      return {
        ...product,
        videos: resolveVideoUrls(product.videos),
      };
    }
    return {
      ...product,
      imageUrl: firstUsablePublicMediaUrl(override.imageUrl, product.imageUrl) || product.imageUrl,
      images: usableImageList(override.images, product.images),
      videos: resolveVideoUrls(overrideHasVideos(override) ? override.videos : product.videos),
    };
  });
};

/** Common shopper typos → catalog spelling. Applied per search token. */
const SEARCH_TOKEN_ALIASES: Record<string, string> = {
  lavendar: "lavender",
  lavander: "lavender",
  lavendarer: "lavender",
  cedre: "cedar",
  cedarwoord: "cedarwood",
  shampo: "shampoo",
  shampoe: "shampoo",
  incence: "incense",
  inscense: "incense",
  deoderant: "deodorant",
  deoderent: "deodorant",
  moisturiser: "moisturizer",
  fragrancee: "fragrance",
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-token match so short queries like "oil" do not hit "Olibanum". */
function fieldHasExactToken(field: string, token: string): boolean {
  if (!field || !token) return false;
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(token)}(?:[^a-z0-9]|$)`).test(field);
}

/** Word-prefix match for progressive typing ("lave" → "lavender"). */
function fieldHasPrefixToken(field: string, token: string): boolean {
  if (!field || !token) return false;
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(token)}[a-z0-9]*`).test(field);
}

function fieldHasToken(field: string, token: string, allowPrefix: boolean): boolean {
  if (allowPrefix && token.length >= 3) {
    return fieldHasPrefixToken(field, token);
  }
  return fieldHasExactToken(field, token);
}

function searchTokensFromQuery(raw: string): string[] {
  const q = normalize(raw);
  if (!q) return [];
  return q
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => SEARCH_TOKEN_ALIASES[token] ?? token);
}

function productMatchesSearchTokens(
  fields: string[],
  tokens: string[]
): boolean {
  if (tokens.length === 0) return true;
  return tokens.every((token, index) => {
    // Allow prefix on the last token so typing "cedar lave" still finds lavender.
    // Single short tokens stay exact ("oil" must not match "olibanum").
    const allowPrefix = tokens.length > 1 ? index === tokens.length - 1 : token.length >= 4;
    return fields.some((field) => fieldHasToken(field, token, allowPrefix));
  });
}

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
  const tokens = searchTokensFromQuery(q);
  const category = normalize(query.category ?? "");
  const limit = query.limit && query.limit > 0 ? query.limit : undefined;
  const onlyWithImages = query.onlyWithImages === true;

  const filtered = products.filter((product) => {
    if (onlyWithImages && !hasDisplayImage(product)) {
      return false;
    }

    if (query.excludeGiftSets) {
      const nameLower = product.name.toLowerCase();
      const isGiftSet =
        product.categories.some((c) => normalize(c).includes("gifting")) ||
        nameLower.includes("gift set") ||
        nameLower.includes("giftset") ||
        nameLower.includes("nurture set");

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

    if (tokens.length === 0) {
      return true;
    }

    const attributeText = Object.entries(product.attributes ?? {}).flatMap(([key, values]) => [
      key,
      ...(Array.isArray(values) ? values : []),
    ]);
    const fields = [
      normalize(product.name),
      normalize(product.shortDescription),
      normalize(product.description),
      ...product.categories.map((entry) => normalize(entry)),
      ...product.tags.map((entry) => normalize(entry)),
      ...attributeText.map((entry) => normalize(String(entry))),
      normalize(product.sku),
      normalize(product.brand),
    ];

    // Every search word must appear (order-independent). Last word may be a prefix while typing.
    return productMatchesSearchTokens(fields, tokens);
  });

  if (tokens.length > 0) {
    const phrase = tokens.join(" ");
    filtered.sort((a, b) => {
      const aName = normalize(a.name);
      const bName = normalize(b.name);
      const aNameHit = tokens.every((token) => fieldHasExactToken(aName, token));
      const bNameHit = tokens.every((token) => fieldHasExactToken(bName, token));
      if (aNameHit !== bNameHit) return aNameHit ? -1 : 1;
      const aPhrase = aName.includes(phrase);
      const bPhrase = bName.includes(phrase);
      if (aPhrase !== bPhrase) return aPhrase ? -1 : 1;
      const aStarts = aName.startsWith(tokens[0]) || aName.includes(` ${tokens[0]}`);
      const bStarts = bName.startsWith(tokens[0]) || bName.includes(` ${tokens[0]}`);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return aName.localeCompare(bName);
    });
  }

  if (limit) {
    return filtered.slice(0, limit);
  }

  return filtered;
};
