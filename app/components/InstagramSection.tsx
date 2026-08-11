"use client";

import { memo } from "react";

/** Elfsight Instagram Feed — native widget only (no DOM/CSS overrides). */
export const InstagramSection = memo(function InstagramSection() {
  return (
    <section className="instagram-section">
      <div className="scroller-header">
        <h2 className="scroller-title">From the Maroma World!</h2>
      </div>
      <div className="instagram-feed-container">
        <div className="elfsight-app-3e9b8508-c159-4052-be08-dcc0f7f5a278" />
      </div>
    </section>
  );
});
