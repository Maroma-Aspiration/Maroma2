"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useReviewFeedbackOptional } from "./review-feedback-provider";

const PAGE_TITLES: Record<string, string> = {
  "": "Home",
  shop: "Shop",
  product: "Product",
  cart: "Basket",
  checkout: "Checkout",
  blog: "Journal",
  about: "About",
  stores: "Stores",
  rituals: "Rituals",
  gifting: "Gifting",
  review: "Review report",
  special: "Special",
  search: "Search",
  b2b: "B2B",
  newsletter: "Newsletter",
  admin: "Admin",
  account: "Account",
};

function pageTitleFromPath(pathname: string) {
  if (pathname === "/") return "Home";
  const segment = pathname.split("/").filter(Boolean)[0] ?? "Page";
  return PAGE_TITLES[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

function parseFiles(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((file) => file.trim())
    .filter(Boolean);
}

export function ReviewMarkerLayer() {
  const pathname = usePathname();
  const review = useReviewFeedbackOptional();
  const [markerCount, setMarkerCount] = useState(0);

  useEffect(() => {
    if (!review?.enabled) return;
    const feedback = review;

    const markers: HTMLButtonElement[] = [];

    function cleanup() {
      for (const button of markers) button.remove();
      markers.length = 0;
      document.querySelectorAll(".review-marker-host").forEach((element) => {
        element.classList.remove("review-marker-host");
      });
    }

    function attachMarkers() {
      cleanup();

      const areas = document.querySelectorAll<HTMLElement>("[data-review]");
      setMarkerCount(areas.length);

      areas.forEach((element) => {
        const area = element.dataset.review;
        if (!area) return;

        element.classList.add("review-marker-host");
        if (getComputedStyle(element).position === "static") {
          element.style.position = "relative";
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "review-marker-btn";
        button.setAttribute("aria-label", `Add feedback for ${area}`);
        button.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v6"/><path d="M9 10h6"/></svg><span>Feedback</span>';

        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          feedback.openDraft({
            page: pathname,
            pageTitle: pageTitleFromPath(pathname),
            area,
            areaId: element.dataset.reviewId,
            suggestedFiles: parseFiles(element.dataset.reviewFiles),
          });
        });

        element.appendChild(button);
        markers.push(button);
      });
    }

    attachMarkers();
    const retry = window.setTimeout(attachMarkers, 800);
    const retryLate = window.setTimeout(attachMarkers, 2000);

    return () => {
      window.clearTimeout(retry);
      window.clearTimeout(retryLate);
      cleanup();
    };
  }, [pathname, review]);

  if (!review?.enabled) return null;

  return (
    <div className="review-mode-chip">
      Review mode · {markerCount} marked areas
    </div>
  );
}

export function ReviewFeedbackBar() {
  const pathname = usePathname();
  const review = useReviewFeedbackOptional();

  if (!review?.enabled) return null;

  return (
    <div className="review-feedback-bar">
      <button
        type="button"
        className="review-feedback-bar-primary"
        onClick={() =>
          review.openDraft({
            page: pathname,
            pageTitle: pageTitleFromPath(pathname),
            area: "General page feedback",
            suggestedFiles: [],
          })
        }
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M12 7v6" />
          <path d="M9 10h6" />
        </svg>
        Add page note
      </button>
      <a href="/review" className="review-feedback-bar-outline">
        Report ({review.items.length})
      </a>
    </div>
  );
}
