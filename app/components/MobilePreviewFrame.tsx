"use client";

import type { ReactNode, Ref } from "react";

type MobilePreviewFrameProps = {
  frameRef: Ref<HTMLDivElement>;
  header: ReactNode;
  children: ReactNode;
};

export function MobilePreviewFrame({ frameRef, header, children }: MobilePreviewFrameProps) {
  return (
    <div className="admin-mobile-preview-shell">
      <div className="admin-mobile-preview-studio">
        <div className="admin-mobile-preview-badge">Mobile edit preview · 390 × 844</div>
        <div className="admin-mobile-preview-device" aria-label="Phone preview">
          <div className="admin-mobile-preview-device-bar" aria-hidden="true" />
          <div ref={frameRef} className="admin-mobile-preview-frame">
            {header}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
