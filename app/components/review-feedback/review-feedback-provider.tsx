"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type ReviewFeedbackItem,
  type ReviewFeedbackType,
  isReviewModeEnabled,
  loadReviewFeedback,
  saveReviewFeedback,
} from "../../../lib/review-feedback";

type DraftFeedback = {
  page: string;
  pageTitle: string;
  area: string;
  areaId?: string;
  suggestedFiles: string[];
};

type ReviewFeedbackContextValue = {
  enabled: boolean;
  items: ReviewFeedbackItem[];
  addItem: (draft: DraftFeedback, feedback: string, type: ReviewFeedbackType) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
  openDraft: (draft: DraftFeedback) => void;
  draft: DraftFeedback | null;
  closeDraft: () => void;
};

const ReviewFeedbackContext = createContext<ReviewFeedbackContextValue | null>(null);

export function ReviewFeedbackProvider({ children }: { children: React.ReactNode }) {
  const enabled = isReviewModeEnabled();
  const [items, setItems] = useState<ReviewFeedbackItem[]>([]);
  const [draft, setDraft] = useState<DraftFeedback | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(loadReviewFeedback());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveReviewFeedback(items);
  }, [items, hydrated]);

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add("review-mode-active");
    return () => {
      document.documentElement.classList.remove("review-mode-active");
    };
  }, [enabled]);

  const addItem = useCallback(
    (nextDraft: DraftFeedback, feedback: string, type: ReviewFeedbackType) => {
      setItems((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          ...nextDraft,
          feedback,
          type,
          createdAt: new Date().toISOString(),
        },
      ]);
      setDraft(null);
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo(
    () => ({
      enabled,
      items,
      addItem,
      removeItem,
      clearAll,
      openDraft: setDraft,
      draft,
      closeDraft: () => setDraft(null),
    }),
    [enabled, items, addItem, removeItem, clearAll, draft]
  );

  return (
    <ReviewFeedbackContext.Provider value={value}>{children}</ReviewFeedbackContext.Provider>
  );
}

export function useReviewFeedback() {
  const context = useContext(ReviewFeedbackContext);
  if (!context) {
    throw new Error("useReviewFeedback must be used within ReviewFeedbackProvider");
  }
  return context;
}

export function useReviewFeedbackOptional() {
  return useContext(ReviewFeedbackContext);
}
