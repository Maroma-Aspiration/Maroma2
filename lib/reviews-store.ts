import { readJsonKv, writeJsonKv } from "./json-kv-store";
import type { ProductReview, ReviewSource, ReviewStatus } from "./reviews-types";

export type { ProductReview, ReviewSource, ReviewStatus } from "./reviews-types";
export { averageRating } from "./reviews-types";

type ReviewStore = { reviews: ProductReview[] };

const KEY = "maroma:product-reviews";
const FILE = "product-reviews.json";

const empty = (): ReviewStore => ({ reviews: [] });

function clampRating(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 5;
  return Math.min(5, Math.max(1, n));
}

function parseReview(raw: unknown): ProductReview | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const productId = typeof row.productId === "string" ? row.productId.trim() : "";
  const body = typeof row.body === "string" ? row.body.trim() : "";
  if (!id || !productId || !body) return null;
  const status: ReviewStatus =
    row.status === "published" || row.status === "hidden" || row.status === "pending"
      ? row.status
      : "pending";
  return {
    id,
    productId,
    author: typeof row.author === "string" && row.author.trim() ? row.author.trim().slice(0, 80) : "Guest",
    rating: clampRating(row.rating),
    body: body.slice(0, 2000),
    source: row.source === "google" ? "google" : "site",
    status,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
  };
}

export async function readReviewStore(): Promise<ReviewStore> {
  const stored = await readJsonKv<ReviewStore>(KEY, FILE, empty());
  return { reviews: (stored.reviews ?? []).map(parseReview).filter((r): r is ProductReview => Boolean(r)) };
}

export async function writeReviewStore(store: ReviewStore): Promise<void> {
  await writeJsonKv(KEY, FILE, store);
}

export async function listPublishedReviews(productId: string): Promise<ProductReview[]> {
  const store = await readReviewStore();
  return store.reviews
    .filter((review) => review.productId === productId && review.status === "published")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addProductReview(input: {
  productId: string;
  author: string;
  rating: number;
  body: string;
  source?: ReviewSource;
  status?: ReviewStatus;
}): Promise<ProductReview> {
  const store = await readReviewStore();
  const review: ProductReview = {
    id: crypto.randomUUID(),
    productId: input.productId.trim(),
    author: input.author.trim().slice(0, 80) || "Guest",
    rating: clampRating(input.rating),
    body: input.body.trim().slice(0, 2000),
    source: input.source === "google" ? "google" : "site",
    status: input.status ?? "pending",
    createdAt: new Date().toISOString(),
  };
  store.reviews = [review, ...store.reviews].slice(0, 5000);
  await writeReviewStore(store);
  return review;
}

export async function setReviewStatus(id: string, status: ReviewStatus): Promise<ProductReview | null> {
  const store = await readReviewStore();
  const existing = store.reviews.find((review) => review.id === id);
  if (!existing) return null;
  const updated = { ...existing, status };
  store.reviews = store.reviews.map((review) => (review.id === id ? updated : review));
  await writeReviewStore(store);
  return updated;
}

export async function listAllReviews(): Promise<ProductReview[]> {
  const store = await readReviewStore();
  return store.reviews;
}
