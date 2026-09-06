import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";

export type ProductCatalogEdit = {
  name?: string;
  sku?: string;
  price?: string;
  salePrice?: string;
  shortDescription?: string;
  description?: string;
  categories?: string[];
  tags?: string[];
  brand?: string;
  /** When false, product is hidden from storefront regardless of stock. */
  published?: boolean;
  /** Admin deletion marker. The source catalogue remains untouched. */
  deleted?: boolean;
  updatedAt: string;
};

export type ProductCatalogEditStore = {
  edits: Record<string, ProductCatalogEdit>;
  updatedAt: string;
};

const catalogEditsKvKey = "maroma:product-catalog-edits";
const storagePath = path.join(process.cwd(), "data", "product-catalog-edits.json");
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const emptyStore = (): ProductCatalogEditStore => ({
  edits: {},
  updatedAt: new Date().toISOString(),
});

function parseStore(value: unknown): ProductCatalogEditStore {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const editsRaw =
    raw.edits && typeof raw.edits === "object" ? (raw.edits as Record<string, unknown>) : {};
  const edits: Record<string, ProductCatalogEdit> = {};

  for (const [id, entry] of Object.entries(editsRaw)) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const patch: ProductCatalogEdit = {
      updatedAt:
        typeof row.updatedAt === "string" && row.updatedAt
          ? row.updatedAt
          : new Date().toISOString(),
    };
    if (typeof row.name === "string") patch.name = row.name.trim().slice(0, 200);
    if (typeof row.sku === "string") patch.sku = row.sku.trim().slice(0, 80);
    if (typeof row.price === "string") patch.price = row.price.trim().slice(0, 24);
    if (typeof row.salePrice === "string") patch.salePrice = row.salePrice.trim().slice(0, 24);
    if (typeof row.shortDescription === "string") {
      patch.shortDescription = row.shortDescription.trim().slice(0, 600);
    }
    if (typeof row.description === "string") {
      patch.description = row.description.trim().slice(0, 12000);
    }
    if (Array.isArray(row.categories)) {
      patch.categories = row.categories
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 12);
    }
    if (Array.isArray(row.tags)) {
      patch.tags = row.tags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 24);
    }
    if (typeof row.brand === "string") patch.brand = row.brand.trim().slice(0, 80);
    if (typeof row.published === "boolean") patch.published = row.published;
    if (typeof row.deleted === "boolean") patch.deleted = row.deleted;
    edits[id] = patch;
  }

  return {
    edits,
    updatedAt:
      typeof raw.updatedAt === "string" && raw.updatedAt ? raw.updatedAt : new Date().toISOString(),
  };
}

export async function readCatalogEdits(): Promise<ProductCatalogEditStore> {
  if (hasKvConfig) {
    try {
      const stored = await kv.get(catalogEditsKvKey);
      if (stored) return parseStore(stored);
    } catch {
      // fall through
    }
  }
  try {
    const raw = await fs.readFile(storagePath, "utf8");
    return parseStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

export async function writeCatalogEdits(store: ProductCatalogEditStore): Promise<ProductCatalogEditStore> {
  const next = parseStore(store);
  next.updatedAt = new Date().toISOString();
  if (hasKvConfig) {
    try {
      await kv.set(catalogEditsKvKey, next);
      return next;
    } catch {
      // fall through
    }
  }
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function upsertCatalogEdit(
  productId: string,
  patch: Omit<ProductCatalogEdit, "updatedAt">
): Promise<ProductCatalogEdit> {
  const store = await readCatalogEdits();
  const existing = store.edits[productId] ?? { updatedAt: new Date().toISOString() };
  const next: ProductCatalogEdit = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store.edits[productId] = next;
  await writeCatalogEdits(store);
  return next;
}

export function isProductPublished(edit?: ProductCatalogEdit): boolean {
  return edit?.published !== false;
}
