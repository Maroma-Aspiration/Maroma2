import { DEFAULT_STOCK } from "./commerce-config";
import { parseInrPriceNumber } from "./format-price";
import { getDisplayImageUrl, hasDisplayImage } from "./product-image";
import { readCatalogEdits, isProductPublished, type ProductCatalogEdit } from "./product-catalog-edits";
import { filterProducts, readOverrides, readProducts, withOverrides } from "./product-db";
import { readStockStore } from "./commerce-stock";
import type { ProductRecord } from "./product-types";

export type AdminProductStatus = "active" | "draft" | "out_of_stock" | "no_image";

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
  status: AdminProductStatus;
  hasCatalogEdit: boolean;
  hasImageOverride: boolean;
  updatedAt?: string;
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
  const [base, imageStore, catalogStore] = await Promise.all([
    readProducts(),
    readOverrides(),
    readCatalogEdits(),
  ]);
  const withImages = withOverrides(base, imageStore);
  const products = withImages.map((product) =>
    applyCatalogEdit(product, catalogStore.edits[product.id])
  );
  return {
    products,
    catalogEdits: catalogStore.edits,
    imageOverrideIds: new Set(Object.keys(imageStore.overrides)),
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
  return "active";
}

export function toAdminProductSummary(
  product: ProductRecord,
  stock: number,
  catalogEdit?: ProductCatalogEdit,
  hasImageOverride = false
): AdminProductSummary {
  const published = isProductPublished(catalogEdit);
  const primaryCategory = product.categories[0] ?? "Uncategorised";
  return {
    id: product.id,
    name: product.name,
    sku: product.sku || product.id,
    price: product.price,
    priceNumber: parseInrPriceNumber(product.price),
    imageUrl: getDisplayImageUrl(product),
    primaryCategory,
    categories: product.categories,
    stock,
    published,
    status: deriveAdminProductStatus(product, stock, published),
    hasCatalogEdit: Boolean(catalogEdit),
    hasImageOverride,
    updatedAt: catalogEdit?.updatedAt,
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

export type AdminProductListQuery = {
  q?: string;
  category?: string;
  status?: "all" | AdminProductStatus | "low_stock";
  page?: number;
  limit?: number;
};

export async function listAdminProducts(query: AdminProductListQuery): Promise<{
  products: AdminProductSummary[];
  total: number;
  page: number;
  limit: number;
  categories: string[];
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(10, query.limit ?? 25));
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

  if (query.status && query.status !== "all") {
    filtered = filtered.filter((product) => {
      const stock = stockForProduct(product.id, stockStore.stock);
      const published = isProductPublished(catalogEdits[product.id]);
      const status = deriveAdminProductStatus(product, stock, published);
      if (query.status === "low_stock") {
        return published && stock > 0 && stock <= 5;
      }
      return status === query.status;
    });
  }

  const total = filtered.length;
  const start = (page - 1) * limit;
  const pageItems = filtered.slice(start, start + limit);

  const summaries = pageItems.map((product) =>
    toAdminProductSummary(
      product,
      stockForProduct(product.id, stockStore.stock),
      catalogEdits[product.id],
      imageOverrideIds.has(product.id)
    )
  );

  return {
    products: summaries,
    total,
    page,
    limit,
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
