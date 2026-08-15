import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import { DEFAULT_STOCK } from "./commerce-config";
import { getRitualSet } from "./commerce-ritual-sets";
import type { StockStore } from "./commerce-types";

const stockKvKey = "maroma:commerce-stock";
const storagePath = path.join(process.cwd(), "data", "commerce-stock.json");
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const emptyStore = (): StockStore => ({
  stock: {},
  updatedAt: new Date().toISOString(),
});

function parseStore(value: unknown): StockStore {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const stockRaw = raw.stock && typeof raw.stock === "object" ? (raw.stock as Record<string, unknown>) : {};
  const stock: Record<string, number> = {};
  for (const [id, qty] of Object.entries(stockRaw)) {
    if (typeof qty === "number" && Number.isFinite(qty) && qty >= 0) {
      stock[id] = Math.floor(qty);
    }
  }
  return {
    stock,
    updatedAt:
      typeof raw.updatedAt === "string" && raw.updatedAt ? raw.updatedAt : new Date().toISOString(),
  };
}

export async function readStockStore(): Promise<StockStore> {
  if (hasKvConfig) {
    try {
      const stored = await kv.get(stockKvKey);
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

export async function writeStockStore(store: StockStore): Promise<StockStore> {
  const next = parseStore(store);
  next.updatedAt = new Date().toISOString();
  if (hasKvConfig) {
    try {
      await kv.set(stockKvKey, next);
      return next;
    } catch {
      // fall through
    }
  }
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function getAvailableStock(productId: string): Promise<number> {
  const ritual = getRitualSet(productId);
  const store = await readStockStore();
  if (Object.prototype.hasOwnProperty.call(store.stock, productId)) {
    return store.stock[productId];
  }
  if (ritual) return ritual.stock;
  return DEFAULT_STOCK;
}

export async function setProductStock(productId: string, quantity: number): Promise<StockStore> {
  const store = await readStockStore();
  store.stock[productId] = Math.max(0, Math.floor(quantity));
  return writeStockStore(store);
}

export async function setProductsStock(productIds: string[], quantity: number): Promise<StockStore> {
  const store = await readStockStore();
  const normalized = Math.max(0, Math.floor(quantity));
  for (const productId of productIds) store.stock[productId] = normalized;
  return writeStockStore(store);
}

/** Decrement stock for each order line. Skips virtual ritual bundles. */
export async function decrementStockForOrder(
  lines: Array<{ productId: string; quantity: number }>
): Promise<StockStore> {
  const store = await readStockStore();
  for (const line of lines) {
    if (getRitualSet(line.productId)) continue;
    const current = Object.prototype.hasOwnProperty.call(store.stock, line.productId)
      ? store.stock[line.productId]
      : DEFAULT_STOCK;
    store.stock[line.productId] = Math.max(0, current - line.quantity);
  }
  return writeStockStore(store);
}
