import type { ProductRecord } from "./product-types";

export type ProductSizeAudit = {
  status: "clear" | "unclear" | "mismatch" | "pricing_review";
  reason: string;
  expected: string[];
  imageSizes: string[];
};

const SIZE_RE = /(\d+(?:\.\d+)?)\s*(ml|cl|l|ltr|g|gm|gms|kg|oz)\b/gi;

function normalizeSize(amount: string, unit: string): string {
  const normalizedUnit = unit.toLowerCase().replace(/s$/, "").replace("ltr", "l").replace("gm", "g");
  return `${Number(amount)} ${normalizedUnit}`;
}

function sizesIn(text: string): string[] {
  const found: string[] = [];
  SIZE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SIZE_RE.exec(text)) !== null) {
    const size = normalizeSize(match[1], match[2]);
    if (!found.includes(size)) found.push(size);
  }
  return found;
}

export function auditProductImageSizes(product: ProductRecord): ProductSizeAudit {
  const attributes = Object.entries(product.attributes ?? {})
    .filter(([key]) => /^(size|volume|net volume|net weight|weight|pack size)$/i.test(key))
    .flatMap(([, values]) => values);
  const expected = [...new Set([...attributes.flatMap(sizesIn), ...sizesIn(product.name)])];
  const images = [...(product.images ?? []), product.imageUrl ?? ""].filter(Boolean);
  const imageSizes = [...new Set(images.flatMap((image) => sizesIn(image.split("/").pop() ?? image)))];
  const primaryImageSizes = sizesIn(images[0]?.split("/").pop() ?? "");

  if (!images.length) {
    return { status: "unclear", reason: "No product image is attached.", expected, imageSizes };
  }
  if (!expected.length) {
    return { status: "unclear", reason: "No catalogue size is recorded to compare with the image.", expected, imageSizes };
  }
  if (!primaryImageSizes.length) {
    return { status: "unclear", reason: "The primary image filename does not identify a size; check the packaging visually.", expected, imageSizes };
  }
  if (expected.length > 1 && primaryImageSizes.every((size) => !expected.includes(size))) {
    return { status: "mismatch", reason: "The primary image size does not match any recorded catalogue size.", expected, imageSizes };
  }
  if (expected.length > 1 && primaryImageSizes.length === 1 && imageSizes.length < expected.length) {
    return { status: "unclear", reason: "Multiple catalogue sizes exist, but the gallery does not identify every size.", expected, imageSizes };
  }
  return { status: "clear", reason: "Primary image size matches the catalogue data.", expected, imageSizes };
}

function productFamilyKey(product: ProductRecord): string {
  return product.name
    .replace(/^copy\s+of\s+/i, "")
    .replace(SIZE_RE, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function priceKey(price: string): string {
  const numeric = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? String(numeric) : price.trim();
}

function displayPrice(price: string): string {
  const numeric = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? `₹${numeric.toLocaleString("en-IN")}` : price;
}

/**
 * Reviews the whole catalogue so separate 100 ml / 300 ml listings can pass
 * image-size checks independently, while identical prices are highlighted for
 * human review rather than treated as an automatic error.
 */
export function auditCatalogProductSizes(products: ProductRecord[]): Map<string, ProductSizeAudit> {
  const audits = new Map(products.map((product) => [product.id, auditProductImageSizes(product)]));
  const groups = new Map<string, ProductRecord[]>();
  for (const product of products) {
    const key = productFamilyKey(product);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }

  for (const siblings of groups.values()) {
    // Price review is independent from image recognition. A listing can still
    // need an image correction, but matching single quantities at the same
    // price must be visible immediately rather than waiting for that fix.
    const singleSizeListings = siblings
      .map((product) => ({ product, audit: audits.get(product.id)! }))
      .filter(({ audit }) => audit.expected.length === 1);
    if (singleSizeListings.length < 2) continue;

    const byPrice = new Map<string, typeof singleSizeListings>();
    for (const listing of singleSizeListings) {
      const key = priceKey(listing.product.price);
      byPrice.set(key, [...(byPrice.get(key) ?? []), listing]);
    }
    for (const samePriceListings of byPrice.values()) {
      const sizes = [...new Set(samePriceListings.map(({ audit }) => audit.expected[0]))];
      if (sizes.length < 2) continue;
      const reason = `Review pricing: separate ${sizes.join(" and ")} listings use the same price (${displayPrice(samePriceListings[0].product.price)}).`;
      for (const { product, audit } of samePriceListings) {
        audits.set(product.id, { ...audit, status: "pricing_review", reason });
      }
    }
  }
  return audits;
}
