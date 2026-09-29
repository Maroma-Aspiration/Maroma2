"use client";

import { useEffect, useMemo, useState } from "react";
import { averageRating, type ProductReview } from "../../lib/reviews-types";

type SortKey = "newest" | "highest" | "lowest" | "helpful";
type StarFilter = 0 | 1 | 2 | 3 | 4 | 5;

function formatReviewDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function Stars({ rating, label }: { rating: number; label?: string }) {
  const rounded = Math.max(1, Math.min(5, Math.round(rating)));
  return (
    <span className="product-reviews-stars" aria-label={label || `${rounded} out of 5 stars`}>
      {"★".repeat(rounded)}
      {"☆".repeat(5 - rounded)}
    </span>
  );
}

export function ProductReviews({ productId, productName = "" }: { productId: string; productName?: string }) {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [author, setAuthor] = useState("");
  const [title, setTitle] = useState("");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [verifiedPurchase, setVerifiedPurchase] = useState(false);
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [starFilter, setStarFilter] = useState<StarFilter>(0);
  const [helpfulBusy, setHelpfulBusy] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch(`/api/reviews?productId=${encodeURIComponent(productId)}`, { cache: "no-store" });
    const data = (await res.json()) as { reviews?: ProductReview[] };
    setReviews(data.reviews ?? []);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const summary = averageRating(reviews);
  const distribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const review of reviews) counts[review.rating] += 1;
    return [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: counts[star],
      pct: reviews.length ? Math.round((counts[star] / reviews.length) * 100) : 0,
    }));
  }, [reviews]);

  const visibleReviews = useMemo(() => {
    const filtered = starFilter ? reviews.filter((review) => review.rating === starFilter) : reviews;
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortBy === "highest") return b.rating - a.rating || b.createdAt.localeCompare(a.createdAt);
      if (sortBy === "lowest") return a.rating - b.rating || b.createdAt.localeCompare(a.createdAt);
      if (sortBy === "helpful") return (b.helpfulCount || 0) - (a.helpfulCount || 0) || b.createdAt.localeCompare(a.createdAt);
      return b.createdAt.localeCompare(a.createdAt);
    });
    return sorted;
  }, [reviews, sortBy, starFilter]);

  const submit = async () => {
    setStatus("");
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, author, rating, body, title, verifiedPurchase }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setStatus(data.error || "Could not send review.");
      return;
    }
    setBody("");
    setTitle("");
    setVerifiedPurchase(false);
    setStatus("Thank you. Your review will appear after Maroma approves it.");
  };

  const markHelpful = async (id: string) => {
    const storageKey = `maroma-review-helpful:${id}`;
    if (window.localStorage.getItem(storageKey) === "1") return;
    setHelpfulBusy(id);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ helpfulId: id }),
    });
    if (res.ok) {
      window.localStorage.setItem(storageKey, "1");
      await load();
    }
    setHelpfulBusy(null);
  };

  return (
    <section className="product-reviews" aria-labelledby="pdp-reviews">
      <div className="product-reviews-inner">
        <header className="product-reviews-heading">
          <span className="product-reviews-eyebrow">Amazon reviews</span>
          <h2 id="pdp-reviews" className="product-reviews-title">
            Ratings & reviews
          </h2>
          <p className="product-reviews-intro">
            Customer reviews from Amazon stores, shown only for this product.
          </p>
        </header>

        <div className="product-reviews-overview">
          <div className="product-reviews-score">
            {summary.count > 0 ? (
              <>
                <p className="product-reviews-score-value">{summary.average}</p>
                <Stars rating={summary.average} label={`${summary.average} out of 5`} />
                <p>
                  {summary.count} review{summary.count === 1 ? "" : "s"}
                </p>
              </>
            ) : (
              <p className="product-reviews-summary">No published reviews yet.</p>
            )}
          </div>
          <ul className="product-reviews-distribution">
            {distribution.map((row) => (
              <li key={row.star}>
                <button
                  type="button"
                  className={starFilter === row.star ? "is-active" : ""}
                  onClick={() => setStarFilter((current) => (current === row.star ? 0 : (row.star as StarFilter)))}
                >
                  <span>{row.star} star</span>
                  <span className="product-reviews-distribution-bar" aria-hidden="true">
                    <span style={{ width: `${row.pct}%` }} />
                  </span>
                  <span>{row.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {reviews.length > 0 ? (
          <div className="product-reviews-toolbar">
            <label>
              Sort
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortKey)}>
                <option value="newest">Most recent</option>
                <option value="highest">Highest rating</option>
                <option value="lowest">Lowest rating</option>
                <option value="helpful">Most helpful</option>
              </select>
            </label>
            {starFilter ? (
              <button type="button" onClick={() => setStarFilter(0)}>
                Clear {starFilter}-star filter
              </button>
            ) : null}
          </div>
        ) : null}

        {visibleReviews.length > 0 ? (
          <ul className="product-reviews-list">
            {visibleReviews.map((review) => (
              <li key={review.id} className="product-reviews-item">
                <div className="product-reviews-item-head">
                  <Stars rating={review.rating} />
                  <strong className="product-reviews-author">{review.author}</strong>
                </div>
                <p className="product-reviews-meta">
                  <time dateTime={review.createdAt}>{formatReviewDate(review.createdAt)}</time>
                  {review.verifiedPurchase ? <span className="product-reviews-verified">Verified purchase</span> : null}
                </p>
                {review.title ? <h3 className="product-reviews-item-title">{review.title}</h3> : null}
                <p className="product-reviews-body">{review.body}</p>
                {productName ? <p className="product-reviews-product-ref">Reviewed: {productName}</p> : null}
                {review.source === "amazon" ? (
                  <small className="product-reviews-source">
                    From {review.marketplace || "Amazon"}
                    {review.translated ? " · Translated into English" : ""}
                  </small>
                ) : review.source === "google" ? (
                  <small className="product-reviews-source">From Google</small>
                ) : null}
                <button
                  type="button"
                  className="product-reviews-helpful"
                  disabled={helpfulBusy === review.id}
                  onClick={() => void markHelpful(review.id)}
                >
                  Helpful{review.helpfulCount ? ` (${review.helpfulCount})` : ""}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <form
          className="product-reviews-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <h3 className="product-reviews-form-title">Write a review</h3>
          <label className="product-reviews-field">
            <span>Your name</span>
            <input type="text" placeholder="Optional" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
          <label className="product-reviews-field">
            <span>Review title</span>
            <input type="text" placeholder="A short headline" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="product-reviews-field">
            <span>Rating</span>
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} star{value === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
          <label className="product-reviews-field">
            <span>Your review</span>
            <textarea
              required
              rows={4}
              placeholder="How did this product feel, smell, or last?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <label className="product-reviews-verified-field">
            <input
              type="checkbox"
              checked={verifiedPurchase}
              onChange={(event) => setVerifiedPurchase(event.target.checked)}
            />
            <span>I purchased this product</span>
          </label>
          <button type="submit" className="button primary button-sage product-reviews-submit">
            Submit review
          </button>
          {status ? <p className="product-reviews-status">{status}</p> : null}
        </form>
      </div>
    </section>
  );
}
