import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import type { ProductRecord } from "./product-types";

type CreatedProductStore = { products: ProductRecord[]; updatedAt: string };

const kvKey = "maroma:admin-created-products";
const storagePath = path.join(process.cwd(), "data", "admin-created-products.json");
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const emptyStore = (): CreatedProductStore => ({ products: [], updatedAt: new Date().toISOString() });

function parseStore(value: unknown): CreatedProductStore {
  if (!value || typeof value !== "object") return emptyStore();
  const raw = value as Partial<CreatedProductStore>;
  return {
    products: Array.isArray(raw.products) ? raw.products : [],
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

export async function readCreatedProducts(): Promise<ProductRecord[]> {
  if (hasKvConfig) {
    try {
      const stored = await kv.get(kvKey);
      if (stored) return parseStore(stored).products;
    } catch {}
  }
  try {
    return parseStore(JSON.parse(await fs.readFile(storagePath, "utf8"))).products;
  } catch {
    return [];
  }
}

export async function addCreatedProduct(product: ProductRecord): Promise<void> {
  const products = await readCreatedProducts();
  const store = { products: [...products, product], updatedAt: new Date().toISOString() };
  if (hasKvConfig) {
    try {
      await kv.set(kvKey, store);
      return;
    } catch {}
  }
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(store, null, 2), "utf8");
}
