import { parseInrPriceNumber } from "./format-price";
import { getDisplayImageUrl } from "./product-image";
import { isProductPublished, readCatalogEdits } from "./product-catalog-edits";
import { getRitualSet } from "./commerce-ritual-sets";
import { parseGiftSetProductId, resolveGiftSetCommerceProduct } from "./gift-builder";
import { getAvailableStock, readStockStore } from "./commerce-stock";
import { DEFAULT_STOCK } from "./commerce-config";
import type { CommerceProduct } from "./commerce-types";
import type { ProductRecord } from "./product-types";

let catalogCache: { at: number; products: ProductRecord[] } | null = null;
const CATALOG_TTL_MS = 30_000;

export function invalidateCatalogCache(): void {
  catalogCache = null;
}

async function loadCatalog(): Promise<ProductRecord[]> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.at < CATALOG_TTL_MS) {
    return catalogCache.products;
  }
  const { readMergedCatalog } = await import("./product-catalog-admin");
  const { products } = await readMergedCatalog();
  catalogCache = { at: now, products };
  return products;
}

function stockFor(productId: string, stockMap: Record<string, number>, ritualDefault?: number): number {
  if (Object.prototype.hasOwnProperty.call(stockMap, productId)) {
    return stockMap[productId];
  }
  if (typeof ritualDefault === "number") return ritualDefault;
  return DEFAULT_STOCK;
}

export async function resolveCommerceProduct(productId: string): Promise<CommerceProduct | null> {
  const id = productId.trim();
  if (!id) return null;

  const ritual = getRitualSet(id);
  if (ritual) {
    const stock = await getAvailableStock(id);
    return {
      id: ritual.id,
      sku: ritual.sku,
      name: ritual.name,
      price: ritual.price,
      image: ritual.image,
      active: ritual.active && stock > 0,
      stock,
      virtual: true,
    };
  }

  if (parseGiftSetProductId(id)) {
    return resolveGiftSetCommerceProduct(id);
  }

  const catalog = await loadCatalog();
  const product = catalog.find((entry) => entry.id === id);
  if (!product) return null;

  const price = parseInrPriceNumber(product.price);
  if (price === null) return null;

  const stock = await getAvailableStock(id);
  const catalogEdits = await readCatalogEdits();
  const published = isProductPublished(catalogEdits.edits[id]);
  return {
    id: product.id,
    sku: product.sku || product.id,
    name: product.name,
    price,
    image: getDisplayImageUrl(product) ?? product.imageUrl ?? "",
    active: published && stock > 0,
    stock,
  };
}

/** Resolve many products with one catalogue + stock read. */
export async function resolveCommerceProducts(
  productIds: string[]
): Promise<Map<string, CommerceProduct>> {
  const ids = Array.from(new Set(productIds.map((id) => id.trim()).filter(Boolean)));
  const out = new Map<string, CommerceProduct>();
  if (ids.length === 0) return out;

  const [catalog, stockStore, catalogEdits] = await Promise.all([
    loadCatalog(),
    readStockStore(),
    readCatalogEdits(),
  ]);
  const byId = new Map(catalog.map((product) => [product.id, product]));

  for (const id of ids) {
    const ritual = getRitualSet(id);
    if (ritual) {
      const stock = stockFor(id, stockStore.stock, ritual.stock);
      out.set(id, {
        id: ritual.id,
        sku: ritual.sku,
        name: ritual.name,
        price: ritual.price,
        image: ritual.image,
        active: ritual.active && stock > 0,
        stock,
        virtual: true,
      });
      continue;
    }

    if (parseGiftSetProductId(id)) {
      const giftSet = await resolveGiftSetCommerceProduct(id);
      if (giftSet) {
        out.set(id, giftSet);
      }
      continue;
    }

    const product = byId.get(id);
    if (!product) continue;
    const price = parseInrPriceNumber(product.price);
    if (price === null) continue;
    const stock = stockFor(id, stockStore.stock);
    const published = isProductPublished(catalogEdits.edits[id]);
    out.set(id, {
      id: product.id,
      sku: product.sku || product.id,
      name: product.name,
      price,
      image: getDisplayImageUrl(product) ?? product.imageUrl ?? "",
      active: published && stock > 0,
      stock,
    });
  }

  return out;
}
