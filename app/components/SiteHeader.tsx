"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { contentStorageKey, siteContent, type SiteContent } from "../content";
import { getNavHref } from "../../lib/catalog-categories";

type SiteHeaderProps = {
  initialNav: Pick<SiteContent, "brand" | "nav">;
};

export function SiteHeader({ initialNav }: SiteHeaderProps) {
  const pathname = usePathname();
  const [navContent, setNavContent] = useState<Pick<SiteContent, "brand" | "nav">>(initialNav);
  const [scrolled, setScrolled] = useState(false);
  const [navLiftUp, setNavLiftUp] = useState(false);
  const { brand, nav } = navContent;
  const navItems = useMemo(() => [...nav, "Journal"], [nav]);
  const lastScrollY = useRef(0);
  const navLinksRef = useRef<HTMLDivElement | null>(null);
  const mobileLinkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [activeNavIndex, setActiveNavIndex] = useState(0);
  const [isMobileNav, setIsMobileNav] = useState(false);
  const userInteractingRef = useRef(false);
  const resumeAutoplayTimerRef = useRef<number | null>(null);

  const refreshFromStorage = useCallback(() => {
    const stored = window.localStorage.getItem(contentStorageKey);
    if (!stored) {
      setNavContent({ brand: siteContent.brand, nav: siteContent.nav });
      return;
    }
    try {
      const parsed = JSON.parse(stored) as SiteContent;
      setNavContent({ brand: parsed.brand, nav: parsed.nav });
    } catch {
      setNavContent({ brand: siteContent.brand, nav: siteContent.nav });
    }
  }, []);

  const refreshFromServerThenStorage = useCallback(async () => {
    try {
      const response = await fetch("/api/site-content", { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as { content?: SiteContent | null };
        if (payload.content) {
          setNavContent({ brand: payload.content.brand, nav: payload.content.nav });
          try {
            window.localStorage.setItem(contentStorageKey, JSON.stringify(payload.content));
          } catch {
            // ignore
          }
          return;
        }
      }
    } catch {
      // ignore
    }
    refreshFromStorage();
  }, [refreshFromStorage]);

  useEffect(() => {
    const onResume = () => {
      if (document.visibilityState === "visible") {
        void refreshFromServerThenStorage();
      }
    };
    const onFocus = () => void refreshFromServerThenStorage();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onResume);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, [refreshFromServerThenStorage]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === contentStorageKey || event.key === null) {
        refreshFromStorage();
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshFromServerThenStorage();
      }
    };
    const onSiteContentChanged = () => {
      refreshFromStorage();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("maroma-site-content-changed", onSiteContentChanged);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("maroma-site-content-changed", onSiteContentChanged);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshFromStorage, refreshFromServerThenStorage]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastScrollY.current;
      lastScrollY.current = y;

      setScrolled(y > 24);

      if (y < 10) {
        setNavLiftUp(false);
        return;
      }

      if (y < 120 && dy < -0.5) {
        setNavLiftUp(true);
      } else if (dy > 0.5 && y > 40) {
        setNavLiftUp(false);
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(max-width: 720px)");
    const syncMobile = () => setIsMobileNav(media.matches);
    syncMobile();
    media.addEventListener("change", syncMobile);
    return () => media.removeEventListener("change", syncMobile);
  }, []);

  const setInteractionPause = useCallback((pauseForMs = 3500) => {
    userInteractingRef.current = true;
    if (resumeAutoplayTimerRef.current) {
      window.clearTimeout(resumeAutoplayTimerRef.current);
    }
    resumeAutoplayTimerRef.current = window.setTimeout(() => {
      userInteractingRef.current = false;
    }, pauseForMs);
  }, []);

  const scrollToNavIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const wrap = navLinksRef.current;
      const target = mobileLinkRefs.current[index];
      if (!wrap || !target) {
        return;
      }
      const wrapRect = wrap.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetCenterX = target.offsetLeft + targetRect.width / 2;
      const nextLeft = Math.max(0, targetCenterX - wrapRect.width / 2);
      wrap.scrollTo({ left: nextLeft, behavior });
      setActiveNavIndex(index);
    },
    []
  );

  useEffect(() => {
    if (!isMobileNav || navItems.length <= 1) {
      return;
    }
    const wrap = navLinksRef.current;
    if (!wrap) {
      return;
    }

    const updateActiveFromCenter = () => {
      const centerX = wrap.scrollLeft + wrap.clientWidth / 2;
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      navItems.forEach((_, idx) => {
        const el = mobileLinkRefs.current[idx];
        if (!el) {
          return;
        }
        const elCenter = el.offsetLeft + el.offsetWidth / 2;
        const dist = Math.abs(elCenter - centerX);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      });
      setActiveNavIndex(bestIdx);
    };

    let scrollIdleTimer: number | null = null;
    const onScroll = () => {
      if (scrollIdleTimer) {
        window.clearTimeout(scrollIdleTimer);
      }
      scrollIdleTimer = window.setTimeout(() => {
        updateActiveFromCenter();
      }, 90);
    };
    wrap.addEventListener("scroll", onScroll, { passive: true });
    updateActiveFromCenter();
    const interval = window.setInterval(() => {
      if (userInteractingRef.current) {
        return;
      }
      const next = (activeNavIndex + 1) % navItems.length;
      scrollToNavIndex(next, "smooth");
    }, 2600);

    return () => {
      wrap.removeEventListener("scroll", onScroll);
      window.clearInterval(interval);
      if (scrollIdleTimer) {
        window.clearTimeout(scrollIdleTimer);
      }
    };
  }, [activeNavIndex, isMobileNav, navItems, scrollToNavIndex]);

  useEffect(() => {
    return () => {
      if (resumeAutoplayTimerRef.current) {
        window.clearTimeout(resumeAutoplayTimerRef.current);
      }
    };
  }, []);

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <nav
      className={`nav ${scrolled ? "nav-solid" : "nav-overlay"} ${navLiftUp ? "nav-lift" : ""}`}
    >
      <Link href="/" className="brand">
        <img src="/maroma-logo.png" alt={brand} className="brand-logo" />
      </Link>
      <div
        className={`nav-links${isMobileNav ? " nav-links-carousel" : ""}`}
        ref={navLinksRef}
        onPointerDown={() => setInteractionPause()}
        onTouchStart={() => setInteractionPause()}
        onWheel={() => setInteractionPause(2200)}
      >
        {navItems.map((item, index) => (
          <Link
            key={item}
            href={item === "Journal" ? "/blog" : getNavHref(item)}
            ref={(el) => {
              mobileLinkRefs.current[index] = el;
            }}
            className={isMobileNav && index === activeNavIndex ? "is-centered" : ""}
            onClick={() => {
              if (isMobileNav) {
                setInteractionPause(2400);
                scrollToNavIndex(index, "smooth");
              }
            }}
          >
            {item}
          </Link>
        ))}
      </div>
      <div className="spa-cta-wrap">
        <img src="/spa-logo.png" alt="Maroma Spa" className="spa-book-logo" />
        <a
          className="spa-book-btn"
          href="https://www.themaromaspa.com/treatments"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="spa-book-text">Book a Treatment</span>
        </a>
      </div>
    </nav>
  );
}
