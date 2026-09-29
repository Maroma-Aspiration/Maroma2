"use client";

import { useEffect } from "react";

export function MarketingPageChrome() {
  useEffect(() => {
    document.body.classList.add("marketing-lookbook-page");
    return () => {
      document.body.classList.remove("marketing-lookbook-page");
    };
  }, []);

  return null;
}
