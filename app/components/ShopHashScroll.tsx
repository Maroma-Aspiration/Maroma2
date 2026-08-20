"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isShopHref, requestShopScroll } from "../../lib/scroll-to-shop";

export function ShopHashScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || !isShopHref(anchor.href)) return;

      const dest = new URL(anchor.href, window.location.href);
      const onHome = window.location.pathname === "/" || window.location.pathname === "";
      if (!onHome) return;

      event.preventDefault();
      event.stopPropagation();
      const params = new URLSearchParams(window.location.search);
      dest.searchParams.forEach((value, key) => params.set(key, value));
      params.set("skipIntro", "1");
      window.history.replaceState(null, "", `/?${params.toString()}#shop`);
      requestShopScroll();
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("hashchange", requestShopScroll);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("hashchange", requestShopScroll);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHome = pathname === "/" || pathname === "";
    if (!onHome) return;
    const params = new URLSearchParams(window.location.search);
    const wantsShop = window.location.hash === "#shop" || Boolean(params.get("q")?.trim());
    if (wantsShop) requestShopScroll();
  }, [pathname]);

  return null;
}
