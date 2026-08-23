"use client";

import { useEffect, useState } from "react";
import {
  REVIEW_TYPE_LABELS,
  type ReviewFeedbackType,
} from "../../../lib/review-feedback";
import { useReviewFeedback } from "./review-feedback-provider";

export function ReviewFeedbackDialog() {
  const { draft, closeDraft, addItem } = useReviewFeedback();
  const [feedback, setFeedback] = useState("");
  const [type, setType] = useState<ReviewFeedbackType>("change");

  useEffect(() => {
    if (draft) {
      setFeedback("");
      setType("change");
    }
  }, [draft]);

  useEffect(() => {
    if (!draft) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDraft();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, closeDraft]);

  if (!draft) return null;

  return (
    <div
      className="review-dialog-backdrop"
      role="presentation"
      onClick={closeDraft}
    >
      <div
        className="review-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="review-dialog-title">Add review feedback</h2>
        <p className="review-dialog-desc">
          {draft.pageTitle} · {draft.area}
        </p>

        <div className="review-dialog-meta">
          <p>
            <strong>Page:</strong> {draft.page}
          </p>
          {draft.suggestedFiles.length > 0 ? (
            <p>
              <strong>Likely files:</strong> {draft.suggestedFiles.join(", ")}
            </p>
          ) : null}
        </div>

        <div className="review-dialog-field">
          <label htmlFor="review-type">Feedback type</label>
          <select
            id="review-type"
            value={type}
            onChange={(event) => setType(event.target.value as ReviewFeedbackType)}
          >
            {Object.entries(REVIEW_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="review-dialog-field">
          <label htmlFor="review-feedback">What should change?</label>
          <textarea
            id="review-feedback"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            rows={5}
            placeholder="Describe the issue or improvement. Be specific about expected behavior, layout, copy, or data."
            autoFocus
          />
        </div>

        <div className="review-dialog-actions">
          <button type="button" className="review-dialog-cancel" onClick={closeDraft}>
            Cancel
          </button>
          <button
            type="button"
            className="review-dialog-save"
            disabled={!feedback.trim()}
            onClick={() => addItem(draft, feedback.trim(), type)}
          >
            Save feedback
          </button>
        </div>
      </div>
    </div>
  );
}
