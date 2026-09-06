"use client";

import { useEffect, useState } from "react";
import { averageRating, type ProductReview } from "../../lib/reviews-types";

export function ProductReviews({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [author, setAuthor] = useState("");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");

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

  const submit = async () => {
    setStatus("");
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, author, rating, body }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setStatus(data.error || "Could not send review.");
      return;
    }
    setBody("");
    setStatus("Thank you. Your review will appear after Maroma approves it.");
  };

  return (
    <section className="product-reviews" aria-labelledby="pdp-reviews">
      <h2 id="pdp-reviews" className="product-reviews-title">
        Ratings & reviews
      </h2>
      {summary.count > 0 ? (
        <p className="product-reviews-summary">
          <span className="product-reviews-stars" aria-hidden="true">
            {"★".repeat(Math.round(summary.average))}
            {"☆".repeat(5 - Math.round(summary.average))}
          </span>
          <span>
            {summary.average} / 5 · {summary.count} review{summary.count === 1 ? "" : "s"}
          </span>
        </p>
      ) : (
        <p className="product-reviews-summary">No published reviews yet.</p>
      )}
      {reviews.length > 0 ? (
        <ul className="product-reviews-list">
          {reviews.map((review) => (
            <li key={review.id} className="product-reviews-item">
              <div className="product-reviews-item-head">
                <span className="product-reviews-stars" aria-label={`${review.rating} out of 5 stars`}>
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                </span>
                <strong className="product-reviews-author">{review.author}</strong>
              </div>
              <p className="product-reviews-body">{review.body}</p>
              {review.source === "google" ? (
                <small className="product-reviews-source">From Google</small>
              ) : null}
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
          <input
            type="text"
            placeholder="Optional"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
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
        <button type="submit" className="button primary button-sage product-reviews-submit">
          Submit review
        </button>
        {status ? <p className="product-reviews-status">{status}</p> : null}
      </form>
    </section>
  );
}
