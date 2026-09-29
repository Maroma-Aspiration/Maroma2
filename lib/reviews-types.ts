export type ReviewSource = "site" | "google" | "amazon";
export type ReviewStatus = "pending" | "published" | "hidden";

export type ProductReview = {
  id: string;
  productId: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  source: ReviewSource;
  marketplace?: string;
  translated?: boolean;
  status: ReviewStatus;
  createdAt: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
};

export function averageRating(reviews: ProductReview[]): { average: number; count: number } {
  if (reviews.length === 0) return { average: 0, count: 0 };
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return { average: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
}
