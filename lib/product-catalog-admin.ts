import { DEFAULT_STOCK } from "./commerce-config";
import { decodeBasicHtmlEntities } from "./decode-html-entities";
import { parseInrPriceNumber } from "./format-price";
import { getDisplayImageUrl, hasDisplayImage } from "./product-image";
import { readCatalogEdits, isProductPublished, type ProductCatalogEdit } from "./product-catalog-edits";
import { filterProducts, readOverrides, readProducts, withOverrides } from "./product-db";
import { readStockStore } from "./commerce-stock";
import type { ProductRecord } from "./product-types";
import { readCreatedProducts } from "./admin-created-products";
import { deriveProductInciStatus, productMissingRelevantInci, type ProductInciStatus } from "./product-inci";
import liveProductIds from "../data/maroma-live-product-ids.json";

const liveMaromaProductIdSet = new Set<string>(liveProductIds.map(String));

function isAdminCreatedProduct(product: ProductRecord): boolean {
  return String(product.id).startsWith("admin-");
}

function isVisibleOnStorefront(
  product: ProductRecord,
  catalogEdit?: ProductCatalogEdit
): boolean {
  if (catalogEdit?.deleted || catalogEdit?.published === false) return false;
  return liveMaromaProductIdSet.has(String(product.id)) ||
    (isAdminCreatedProduct(product) && isProductPublished(catalogEdit));
}

export type AdminProductStatus = "live" | "not_live" | "draft" | "out_of_stock" | "no_image";

export type AdminProductSummary = {
  id: string;
  name: string;
  sku: string;
  price: string;
  priceNumber: number | null;
  imageUrl: string | null;
  primaryCategory: string;
  categories: string[];
  stock: number;
  published: boolean;
  liveStatus: "live" | "not_live" | "draft";
  hasImage: boolean;
  status: AdminProductStatus;
  hasCatalogEdit: boolean;
  hasImageOverride: boolean;
  updatedAt?: string;
  /** Full INCI / ingredient list status for personal-care style products. */
  inciStatus: ProductInciStatus;
};

export type AdminProductDetail = AdminProductSummary & {
  shortDescription: string;
  description: string;
  tags: string[];
  brand: string;
  images: string[];
  attributes: Record<string, string[]>;
};

export function applyCatalogEdit(
  product: ProductRecord,
  edit?: ProductCatalogEdit
): ProductRecord {
  if (!edit) return product;
  return {
    ...product,
    name: edit.name ?? product.name,
    sku: edit.sku ?? product.sku,
    price: edit.price ?? product.price,
    shortDescription: edit.shortDescription ?? product.shortDescription,
    description: edit.description ?? product.description,
    categories: edit.categories ?? product.categories,
    tags: edit.tags ?? product.tags,
    brand: edit.brand ?? product.brand,
  };
}

export async function readMergedCatalog(): Promise<{
  products: ProductRecord[];
  catalogEdits: Record<string, ProductCatalogEdit>;
  imageOverrideIds: Set<string>;
}> {
  const [base, created, imageStore, catalogStore] = await Promise.all([
    readProducts(),
    readCreatedProducts(),
    readOverrides(),
    readCatalogEdits(),
  ]);
  const withImages = withOverrides([...created, ...base], imageStore);
  const products = withImages
    .filter((product) => !catalogStore.edits[product.id]?.deleted)
    .map((product) => applyCatalogEdit(product, catalogStore.edits[product.id]));
  return {
    products,
    catalogEdits: catalogStore.edits,
    imageOverrideIds: new Set(Object.keys(imageStore.overrides)),
  };
}

/**
 * The public shop is intentionally restricted to products verified as published
 * by maroma.com's WooCommerce Store API. The complete recovered catalogue stays
 * available to Commerce admin for reconciliation and editing.
 */
export async function readLiveStorefrontCatalog(): Promise<{
  products: ProductRecord[];
  catalogEdits: Record<string, ProductCatalogEdit>;
  imageOverrideIds: Set<string>;
}> {
  const catalog = await readMergedCatalog();
  return {
    ...catalog,
    products: catalog.products.filter((product) =>
      isVisibleOnStorefront(product, catalog.catalogEdits[product.id])
    ),
  };
}

export function deriveAdminProductStatus(
  product: ProductRecord,
  stock: number,
  published: boolean
): AdminProductStatus {
  if (!published) return "draft";
  if (!hasDisplayImage(product)) return "no_image";
  if (stock <= 0) return "out_of_stock";
  if (isVisibleOnStorefront(product)) return "live";
  return "not_live";
}

export function toAdminProductSummary(
  product: ProductRecord,
  stock: number,
  catalogEdit?: ProductCatalogEdit,
  hasImageOverride = false
): AdminProductSummary {
  const published = isProductPublished(catalogEdit);
  const hasImage = hasDisplayImage(product);
  const primaryCategory = product.categories[0] ?? "Uncategorised";
  return {
    id: product.id,
    name: decodeBasicHtmlEntities(product.name),
    sku: product.sku || product.id,
    price: product.price,
    priceNumber: parseInrPriceNumber(product.price),
    imageUrl: getDisplayImageUrl(product),
    primaryCategory,
    categories: product.categories,
    stock,
    published,
    liveStatus: !published ? "draft" : isVisibleOnStorefront(product) ? "live" : "not_live",
    hasImage,
    status: deriveAdminProductStatus(product, stock, published),
    hasCatalogEdit: Boolean(catalogEdit),
    hasImageOverride,
    updatedAt: catalogEdit?.updatedAt,
    inciStatus: deriveProductInciStatus(product),
  };
}

export function toAdminProductDetail(
  product: ProductRecord,
  stock: number,
  catalogEdit?: ProductCatalogEdit,
  hasImageOverride = false
): AdminProductDetail {
  return {
    ...toAdminProductSummary(product, stock, catalogEdit, hasImageOverride),
    shortDescription: product.shortDescription,
    description: product.description,
    tags: product.tags,
    brand: product.brand,
    images: product.images,
    attributes: product.attributes,
  };
}

export function stockForProduct(productId: string, stockMap: Record<string, number>): number {
  if (Object.prototype.hasOwnProperty.call(stockMap, productId)) {
    return stockMap[productId];
  }
  return DEFAULT_STOCK;
}

export type AdminProductFilter =
  | AdminProductStatus
  | "low_stock"
  | "missing_inci";

export type AdminProductListQuery = {
  q?: string;
  category?: string;
  /** @deprecated Prefer `statuses` for multi-select AND filters. */
  status?: "all" | AdminProductFilter;
  /** Active filters combined with AND. Empty / omitted means no status filter. */
  statuses?: AdminProductFilter[];
  page?: number;
  limit?: number;
  sortBy?: "product" | "status" | "inventory" | "category" | "price";
  sortDirection?: "asc" | "desc";
  /** When true, return every matching row (capped) for export. */
  all?: boolean;
};

function normalizeAdminFilters(query: AdminProductListQuery): AdminProductFilter[] {
  const fromList = (query.statuses ?? []).filter(Boolean);
  if (fromList.length > 0) return Array.from(new Set(fromList));
  if (query.status && query.status !== "all") return [query.status];
  return [];
}

function productMatchesAdminFilter(
  product: ProductRecord,
  filter: AdminProductFilter,
  stock: number,
  published: boolean
): boolean {
  if (filter === "missing_inci") return productMissingRelevantInci(product);
  if (filter === "low_stock") return published && stock > 0 && stock <= 5;
  return deriveAdminProductStatus(product, stock, published) === filter;
}

export async function listAdminProducts(query: AdminProductListQuery): Promise<{
  products: AdminProductSummary[];
  total: number;
  page: number;
  limit: number;
  categories: string[];
}> {
  const filters = normalizeAdminFilters(query);
  const page = Math.max(1, query.page ?? 1);
  const limit = query.all
    ? Math.min(5000, Math.max(1, query.limit ?? 5000))
    : Math.min(100, Math.max(10, query.limit ?? 25));
  const [{ products, catalogEdits, imageOverrideIds }, stockStore] = await Promise.all([
    readMergedCatalog(),
    readStockStore(),
  ]);

  const categorySet = new Set<string>();
  products.forEach((product) => {
    product.categories.forEach((category) => categorySet.add(category));
  });

  let filtered = filterProducts(products, {
    q: query.q,
    category: query.category,
  });

  if (filters.length > 0) {
    filtered = filtered.filter((product) => {
      const stock = stockForProduct(product.id, stockStore.stock);
      const published = isProductPublished(catalogEdits[product.id]);
      return filters.every((filter) => productMatchesAdminFilter(product, filter, stock, published));
    });
  }

  const summaries = filtered.map((product) =>
    toAdminProductSummary(
      product,
      stockForProduct(product.id, stockStore.stock),
      catalogEdits[product.id],
      imageOverrideIds.has(product.id)
    )
  );

  const sortBy = query.sortBy ?? "product";
  const direction = query.sortDirection === "desc" ? -1 : 1;
  const textCompare = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  summaries.sort((a, b) => {
    let result = 0;
    if (sortBy === "product") result = textCompare(a.name, b.name);
    if (sortBy === "status") result = textCompare(a.liveStatus, b.liveStatus);
    if (sortBy === "inventory") result = a.stock - b.stock;
    if (sortBy === "category") result = textCompare(a.primaryCategory, b.primaryCategory);
    if (sortBy === "price") result = (a.priceNumber ?? -1) - (b.priceNumber ?? -1);
    return (result || textCompare(a.name, b.name)) * direction;
  });

  const total = summaries.length;
  const pageItems = query.all ? summaries.slice(0, limit) : summaries.slice((page - 1) * limit, (page - 1) * limit + limit);

  return {
    products: pageItems,
    total,
    page: query.all ? 1 : page,
    limit: query.all ? pageItems.length : limit,
    categories: Array.from(categorySet).sort((a, b) => a.localeCompare(b)),
  };
}

export async function getAdminProduct(productId: string): Promise<AdminProductDetail | null> {
  const [{ products, catalogEdits, imageOverrideIds }, stockStore] = await Promise.all([
    readMergedCatalog(),
    readStockStore(),
  ]);
  const product = products.find((entry) => entry.id === productId);
  if (!product) return null;
  return toAdminProductDetail(
    product,
    stockForProduct(product.id, stockStore.stock),
    catalogEdits[product.id],
    imageOverrideIds.has(product.id)
  );
}

export type ProductCatalogPatch = {
  name?: string;
  sku?: string;
  price?: string;
  shortDescription?: string;
  description?: string;
  categories?: string[];
  tags?: string[];
  brand?: string;
  published?: boolean;
  stock?: number;
};

export function validateProductCatalogPatch(patch: ProductCatalogPatch): string | null {
  if (patch.name !== undefined && !patch.name.trim()) {
    return "Product name cannot be empty.";
  }
  if (patch.price !== undefined) {
    const price = parseInrPriceNumber(patch.price);
    if (price === null) return "Enter a valid price.";
  }
  if (patch.stock !== undefined) {
    if (!Number.isFinite(patch.stock) || patch.stock < 0) {
      return "Stock must be zero or greater.";
    }
  }
  return null;
}
