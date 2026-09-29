"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import "./carousel-scroll-hint.css";

type CarouselScrollHintProps = {
  scrollerRef: RefObject<HTMLElement | null>;
  itemSelector: string;
};

export function CarouselScrollHint({ scrollerRef, itemSelector }: CarouselScrollHintProps) {
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const sync = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const prev = el.scrollLeft > 12;
    const next = el.scrollLeft + el.clientWidth < el.scrollWidth - 12;
    setCanPrev(prev);
    setCanNext(next);
  }, [scrollerRef]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const frame = window.requestAnimationFrame(sync);
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(sync) : null;
    observer?.observe(el);
    return () => {
      window.cancelAnimationFrame(frame);
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      observer?.disconnect();
    };
  }, [sync]);

  const step = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const item = el.querySelector<HTMLElement>(itemSelector);
    const styles = window.getComputedStyle(el);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "16") || 16;
    const delta = (item?.offsetWidth || el.clientWidth) + gap;
    el.scrollBy({ left: direction * delta, behavior: "smooth" });
  };

  return (
    <>
      <button
        type="button"
        className={`carousel-nudge carousel-nudge--prev${canPrev ? " is-active" : ""}`}
        aria-label="Show previous"
        disabled={!canPrev}
        onClick={() => step(-1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14.7 5.3a1 1 0 010 1.4L9.4 12l5.3 5.3a1 1 0 11-1.4 1.4l-6-6a1 1 0 010-1.4l6-6a1 1 0 011.4 0z" />
        </svg>
      </button>
      <button
        type="button"
        className={`carousel-nudge carousel-nudge--next${canNext ? " is-active" : ""}`}
        aria-label="Show next"
        disabled={!canNext}
        onClick={() => step(1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9.3 5.3a1 1 0 011.4 0l6 6a1 1 0 010 1.4l-6 6a1 1 0 11-1.4-1.4l5.3-5.3-5.3-5.3a1 1 0 010-1.4z" />
        </svg>
      </button>
    </>
  );
}
