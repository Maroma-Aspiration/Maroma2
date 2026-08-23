"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { compileReviewPrompt, REVIEW_TYPE_LABELS } from "../../../lib/review-feedback";
import { useReviewFeedback } from "./review-feedback-provider";

export function ReviewExportPanel() {
  const { items, removeItem, clearAll } = useReviewFeedback();
  const [copied, setCopied] = useState(false);
  const prompt = useMemo(() => compileReviewPrompt(items), [items]);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="review-export-page">
      <div className="review-export-head">
        <div>
          <h1>Review feedback export</h1>
          <p>Copy this prompt into Cursor to implement all collected changes.</p>
        </div>
        <Link href="/" className="review-export-btn">
          ← Back to shop
        </Link>
      </div>

      <section className="review-export-card">
        <h2>Collected notes ({items.length})</h2>
        <p>Feedback saved in this browser during review mode.</p>
        {items.length === 0 ? (
          <p>No feedback yet. Use the amber Feedback buttons around the site, or Add page note in the bottom bar.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="review-export-item">
              <div className="review-export-item-head">
                <div>
                  <h3>
                    {item.pageTitle} · {item.area}
                  </h3>
                  <p className="review-export-item-path">{item.page}</p>
                </div>
                <div className="review-export-item-actions">
                  <span className="review-export-badge">{REVIEW_TYPE_LABELS[item.type]}</span>
                  <button
                    type="button"
                    className="review-export-icon-btn"
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove feedback item"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <p className="review-export-item-note">{item.feedback}</p>
            </div>
          ))
        )}
        {items.length > 0 ? (
          <button type="button" className="review-export-btn" onClick={clearAll}>
            Clear all feedback
          </button>
        ) : null}
      </section>

      <section
        className="review-export-card"
        data-review="Review export prompt"
        data-review-files="lib/review-feedback.ts"
      >
        <h2>Cursor prompt</h2>
        <p>Paste this entire block into Cursor Agent to action all feedback.</p>
        <textarea className="review-export-prompt" value={prompt} readOnly rows={24} />
        <button type="button" className="review-export-btn review-export-btn-primary" onClick={copyPrompt}>
          {copied ? "Copied" : "Copy prompt for Cursor"}
        </button>
      </section>
    </div>
  );
}
