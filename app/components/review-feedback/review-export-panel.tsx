"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  compileReviewPrompt,
  compileReviewReport,
  REVIEW_TYPE_LABELS,
  type ReviewFeedbackItem,
} from "../../../lib/review-feedback";
import { useAdminSession } from "../../../lib/use-admin-session";
import { useReviewFeedback } from "./review-feedback-provider";

function formatReviewTimestamp(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function groupItemsByPage(items: ReviewFeedbackItem[]) {
  const grouped = new Map<string, ReviewFeedbackItem[]>();
  for (const item of items) {
    const bucket = grouped.get(item.page);
    if (bucket) bucket.push(item);
    else grouped.set(item.page, [item]);
  }
  return grouped;
}

function countByType(items: ReviewFeedbackItem[]) {
  return items.reduce<Record<ReviewFeedbackItem["type"], number>>(
    (acc, item) => {
      acc[item.type] += 1;
      return acc;
    },
    { bug: 0, change: 0, question: 0, praise: 0 }
  );
}

export function ReviewExportPanel() {
  const { items, removeItem, clearAll } = useReviewFeedback();
  const { isAdminUser, sessionReady } = useAdminSession();
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const reportText = useMemo(() => compileReviewReport(items), [items]);
  const prompt = useMemo(() => compileReviewPrompt(items), [items]);
  const groupedItems = useMemo(() => groupItemsByPage(items), [items]);
  const typeCounts = useMemo(() => countByType(items), [items]);
  const pageCount = groupedItems.size;

  async function copyReport() {
    await navigator.clipboard.writeText(reportText);
    setCopiedReport(true);
    window.setTimeout(() => setCopiedReport(false), 2000);
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    window.setTimeout(() => setCopiedPrompt(false), 2000);
  }

  return (
    <div className="review-export-page">
      <div className="review-export-head">
        <div>
          <h1>Site review report</h1>
          <p>Collected feedback from review mode on this browser.</p>
        </div>
        <Link href="/" className="review-export-btn">
          ← Back to shop
        </Link>
      </div>

      <section className="review-export-card review-export-summary">
        <h2>Summary</h2>
        <ul className="review-export-summary-list">
          <li>
            <strong>{items.length}</strong> note{items.length === 1 ? "" : "s"} across{" "}
            <strong>{pageCount}</strong> page{pageCount === 1 ? "" : "s"}
          </li>
          {typeCounts.bug ? <li>{typeCounts.bug} bug / broken</li> : null}
          {typeCounts.change ? <li>{typeCounts.change} change request{typeCounts.change === 1 ? "" : "s"}</li> : null}
          {typeCounts.question ? <li>{typeCounts.question} question{typeCounts.question === 1 ? "" : "s"}</li> : null}
          {typeCounts.praise ? <li>{typeCounts.praise} positive note{typeCounts.praise === 1 ? "" : "s"}</li> : null}
        </ul>
        {items.length > 0 ? (
          <button type="button" className="review-export-btn review-export-btn-primary" onClick={copyReport}>
            {copiedReport ? "Copied" : "Copy report"}
          </button>
        ) : null}
      </section>

      <section className="review-export-card">
        <h2>Feedback notes ({items.length})</h2>
        {items.length === 0 ? (
          <p>No feedback yet. Use the amber Feedback buttons around the site, or Add page note in the bottom bar.</p>
        ) : (
          [...groupedItems.entries()].map(([page, pageItems]) => (
            <div key={page} className="review-export-page-group">
              <h3 className="review-export-page-group-title">
                {pageItems[0]?.pageTitle ?? page}
                <span className="review-export-page-group-path">{page}</span>
              </h3>
              {pageItems.map((item) => (
                <div key={item.id} className="review-export-item">
                  <div className="review-export-item-head">
                    <div>
                      <h4>{item.area}</h4>
                      <p className="review-export-item-meta">
                        {REVIEW_TYPE_LABELS[item.type]} · {formatReviewTimestamp(item.createdAt)}
                      </p>
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
              ))}
            </div>
          ))
        )}
        {items.length > 0 ? (
          <button type="button" className="review-export-btn" onClick={clearAll}>
            Clear all feedback
          </button>
        ) : null}
      </section>

      {sessionReady && isAdminUser ? (
        <details className="review-export-admin-tools">
          <summary>Developer export</summary>
          <p className="review-export-admin-lede">
            Cursor-ready prompt with file hints. Not shown to reviewers.
          </p>
          <textarea className="review-export-prompt" value={prompt} readOnly rows={18} />
          <button type="button" className="review-export-btn review-export-btn-primary" onClick={copyPrompt}>
            {copiedPrompt ? "Copied" : "Copy Cursor prompt"}
          </button>
        </details>
      ) : null}
    </div>
  );
}
