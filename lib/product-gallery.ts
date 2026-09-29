import type { ProductRecord } from "./product-types";
import { getDisplayImageUrl, isPlaceholderImageUrl } from "./product-image";

/** Unique, non-placeholder image URLs for PDP gallery (main + thumbnails). */
export function getGalleryImageUrls(product: ProductRecord): string[] {
  const raw = [product.imageUrl, ...product.images].map((url) => (url || "").trim()).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of raw) {
    if (isPlaceholderImageUrl(url)) {
      continue;
    }
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** Front and optional rear photos for listing cards. */
export function getProductCardImages(product: ProductRecord): { front: string; rear: string } {
  const gallery = getGalleryImageUrls(product);
  const front = gallery[0] || getDisplayImageUrl(product);
  const rear = gallery.find((url) => url !== front) || "";
  return { front, rear };
}
