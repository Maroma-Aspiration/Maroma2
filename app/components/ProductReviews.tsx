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
      <h2 id="pdp-reviews">Ratings & reviews</h2>
      {summary.count > 0 ? (
        <p className="product-reviews-summary">
          {summary.average} / 5 · {summary.count} review{summary.count === 1 ? "" : "s"}
        </p>
      ) : (
        <p className="product-reviews-summary">No published reviews yet.</p>
      )}
      <ul className="product-reviews-list">
        {reviews.map((review) => (
          <li key={review.id}>
            <strong>
              {"★".repeat(review.rating)}
              {"☆".repeat(5 - review.rating)} {review.author}
            </strong>
            <p>{review.body}</p>
            {review.source === "google" ? <small>From Google</small> : null}
          </li>
        ))}
      </ul>
      <form
        className="product-reviews-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h3>Write a review</h3>
        <input
          type="text"
          placeholder="Your name"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
        />
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} star{value === 1 ? "" : "s"}
            </option>
          ))}
        </select>
        <textarea
          required
          rows={4}
          placeholder="How did this product feel, smell, or last?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button type="submit" className="button primary button-sage">
          Submit review
        </button>
        {status ? <p>{status}</p> : null}
      </form>
    </section>
  );
}
