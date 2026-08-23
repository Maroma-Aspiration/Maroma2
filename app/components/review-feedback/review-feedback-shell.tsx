"use client";

import "./review-feedback.css";
import { ReviewFeedbackProvider } from "./review-feedback-provider";
import { ReviewFeedbackDialog } from "./review-feedback-dialog";
import { ReviewFeedbackBar, ReviewMarkerLayer } from "./review-marker-layer";

export function ReviewFeedbackShell({ children }: { children: React.ReactNode }) {
  return (
    <ReviewFeedbackProvider>
      {children}
      <ReviewMarkerLayer />
      <ReviewFeedbackBar />
      <ReviewFeedbackDialog />
    </ReviewFeedbackProvider>
  );
}
