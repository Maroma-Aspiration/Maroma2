"use client";

import Link from "next/link";
import { CompactShopNavigation } from "./CompactShopNavigation";
import { usePathname, useRouter } from "next/navigation";
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEventHandler,
} from "react";
import { useCart } from "../../context/CartContext";
import { contentStorageKey, siteContent, type SiteContent } from "../content";
import { mergeNavWithDefaults } from "../../lib/site-content-api";
import { getNavHref } from "../../lib/catalog-categories";
import {
  getMaromaMobileViewportMatches,
  subscribeMaromaMobileViewport,
} from "../../lib/mobile-viewport";

type SiteHeaderProps = {
  initialNav: Pick<SiteContent, "brand" | "nav">;
  initialViewportIsMobile?: boolean;
};

type NavScrollItem =
  | { kind: "link"; key: string; label: string; href: string }
  | { kind: "spa-logo"; key: "spa-logo" };

const SPA_BOOKING_URL = "https://www.themaromaspa.com/register?next=/booking";
const MAROMA_EXPERIENCES_URL = "https://www.maromaexperience.com";

function NavSearchBar({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <form
      className={`nav-search-bar${compact ? " nav-search-bar--compact" : ""}${className ? ` ${className}` : ""}`.trim()}
      action="/search"
      method="get"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const nextQuery = query.trim();
        router.push(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search");
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <svg className="nav-search-bar-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M10.5 3a7.5 7.5 0 015.92 12.08l4.35 4.35-1.42 1.42-4.35-4.35A7.5 7.5 0 1110.5 3zm0 2a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"
          fill="currentColor"
        />
      </svg>
      <input
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search"
        aria-label="Search products"
        autoComplete="off"
        enterKeyHint="search"
      />
    </form>
  );
}

const NAV_IMG_STYLE = {
  display: "block",
  objectFit: "contain",
  flexShrink: 0,
} as const;

function NavImg({
  src,
  alt,
  className,
  width,
  height,
}: {
  src: string;
  alt: string;
  className?: string;
  width: number;
  height: number;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      decoding="sync"
      fetchPriority="high"
      style={{ ...NAV_IMG_STYLE, width, height, maxWidth: width, maxHeight: height }}
    />
  );
}

type SpaBookRollLinkProps = {
  className?: string;
  carousel?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  tabIndex?: number;
  "aria-hidden"?: boolean;
};

const SpaBookRollLink = forwardRef<HTMLAnchorElement, SpaBookRollLinkProps>(function SpaBookRollLink(
  { className, carousel = false, onClick, tabIndex, "aria-hidden": ariaHidden },
  ref
) {
  return (
    <a
      ref={ref}
      className={[
        "spa-roll-cta",
        carousel ? "spa-roll-cta--carousel" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      href={SPA_BOOKING_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Book Maroma Spa"
      onClick={onClick}
      tabIndex={tabIndex}
      aria-hidden={ariaHidden}
    >
      <span className="spa-roll-track" aria-hidden="true">
        <span className="spa-roll-panel spa-roll-panel--logo">
          <NavImg src="/nav-spa-logo.png" alt="" className="spa-book-logo" width={68} height={24} />
        </span>
        <span className="spa-roll-panel spa-roll-panel--book">
          <span className="spa-book-text">BOOK NOW</span>
        </span>
      </span>
    </a>
  );
});

export function SiteHeader({ initialNav, initialViewportIsMobile = false }: SiteHeaderProps) {
  const pathname = usePathname();
  const isB2bRoute = pathname === "/b2b" || pathname.startsWith("/b2b/");
  const { totalItems } = useCart();
  const [navContent, setNavContent] = useState<Pick<SiteContent, "brand" | "nav">>(initialNav);
  const [scrolled, setScrolled] = useState(false);
  const [navLiftUp, setNavLiftUp] = useState(false);
  const viewportIsMobile = useSyncExternalStore(
    subscribeMaromaMobileViewport,
    getMaromaMobileViewportMatches,
    () => initialViewportIsMobile
  );
  const [navLayoutReady, setNavLayoutReady] = useState(false);
  useLayoutEffect(() => {
    setNavLayoutReady(true);
  }, []);
  const isMobileNav = navLayoutReady ? viewportIsMobile : initialViewportIsMobile;
  const [activeNavIndex, setActiveNavIndex] = useState(0);
  const { brand, nav } = navContent;
  const normalizedNav = useMemo(() => mergeNavWithDefaults(nav), [nav]);
  const navItems = useMemo(() => [...normalizedNav, "Newsletter", "Maroma Experiences"], [normalizedNav]);
  const lastScrollY = useRef(0);
  const navLinksRef = useRef<HTMLDivElement>(null);
  const scrollItemRefs = useRef<(HTMLElement | null)[]>([]);
  const activeNavIndexRef = useRef(0);
  const dragState = useRef<{ active: boolean; startX: number; startScrollLeft: number; moved: boolean }>({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });
  const navAutoScrollPaused = useRef(false);
  const navAutoIndexRef = useRef(0);
  const loopWidthRef = useRef(0);

  const scrollItems = useMemo((): NavScrollItem[] => {
    const links: NavScrollItem[] = navItems.map((item) => ({
      kind: "link",
      key: item,
      label: item,
      href: item === "Newsletter" ? "/blog" : item === "Maroma Experiences" ? MAROMA_EXPERIENCES_URL : getNavHref(item),
    }));
    return [...links, { kind: "spa-logo", key: "spa-logo" }];
  }, [navItems]);

  const carouselDomItems = useMemo(
    () => (scrollItems.length > 0 ? [...scrollItems, ...scrollItems] : []),
    [scrollItems]
  );

  const measureLoopWidth = useCallback(() => {
    const count = scrollItems.length;
    if (count === 0) {
      return 0;
    }
    const first = scrollItemRefs.current[0];
    const loopStart = scrollItemRefs.current[count];
    if (!first || !loopStart) {
      return loopWidthRef.current;
    }
    const width = loopStart.offsetLeft - first.offsetLeft;
    if (width > 0) {
      loopWidthRef.current = width;
    }
    return loopWidthRef.current;
  }, [scrollItems.length]);

  const normalizeLoopScroll = useCallback(
    (wrap: HTMLDivElement, adjustDragAnchor = false) => {
      const loopWidth = measureLoopWidth();
      if (loopWidth <= 0) {
        return;
      }

      while (wrap.scrollLeft >= loopWidth) {
        wrap.scrollLeft -= loopWidth;
        if (adjustDragAnchor) {
          dragState.current.startScrollLeft -= loopWidth;
        }
      }
    },
    [measureLoopWidth]
  );

  const scrollToDomIndex = useCallback(
    (domIndex: number, behavior: ScrollBehavior) => {
      const wrap = navLinksRef.current;
      const el = scrollItemRefs.current[domIndex];
      const count = scrollItems.length;
      if (!wrap || !el || count === 0) {
        return;
      }
      const target = el.offsetLeft - (wrap.clientWidth - el.offsetWidth) / 2;
      wrap.scrollTo({ left: Math.max(0, target), behavior });
      const logicalIndex = domIndex % count;
      navAutoIndexRef.current = logicalIndex;
      activeNavIndexRef.current = logicalIndex;
      setActiveNavIndex(logicalIndex);
    },
    [scrollItems.length]
  );

  const refreshFromStorage = useCallback(() => {
    const stored = window.localStorage.getItem(contentStorageKey);
    if (!stored) {
      setNavContent({ brand: siteContent.brand, nav: siteContent.nav });
      return;
    }
    try {
      const parsed = JSON.parse(stored) as SiteContent;
      setNavContent({ brand: parsed.brand, nav: mergeNavWithDefaults(parsed.nav) });
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
          setNavContent({ brand: payload.content.brand, nav: mergeNavWithDefaults(payload.content.nav) });
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
    document.body.classList.toggle("b2b-route-active", isB2bRoute);
    return () => {
      document.body.classList.remove("b2b-route-active");
    };
  }, [isB2bRoute]);

  useEffect(() => {
    if (!isMobileNav || scrollItems.length <= 1) {
      return;
    }
    const wrap = navLinksRef.current;
    if (!wrap) {
      return;
    }
    wrap.scrollLeft = 0;
    setActiveNavIndex(0);
    activeNavIndexRef.current = 0;
    navAutoIndexRef.current = 0;
  }, [isMobileNav, scrollItems.length]);

  useEffect(() => {
    if (!isMobileNav || scrollItems.length <= 1) {
      return;
    }
    const wrap = navLinksRef.current;
    if (!wrap) {
      return;
    }

    const updateActiveFromCenter = () => {
      const centerX = wrap.scrollLeft + wrap.clientWidth / 2;
      const count = scrollItems.length;
      let bestDomIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      carouselDomItems.forEach((_, idx) => {
        const el = scrollItemRefs.current[idx];
        if (!el) {
          return;
        }
        const elCenter = el.offsetLeft + el.offsetWidth / 2;
        const dist = Math.abs(elCenter - centerX);
        if (dist < bestDist) {
          bestDist = dist;
          bestDomIdx = idx;
        }
      });
      const logicalIdx = count > 0 ? bestDomIdx % count : 0;
      if (logicalIdx !== activeNavIndexRef.current) {
        activeNavIndexRef.current = logicalIdx;
        setActiveNavIndex(logicalIdx);
      }
      navAutoIndexRef.current = logicalIdx;
    };

    updateActiveFromCenter();
    const onCarouselScroll = () => {
      normalizeLoopScroll(wrap);
      updateActiveFromCenter();
    };
    wrap.addEventListener("scroll", onCarouselScroll, { passive: true });
    const ro = new ResizeObserver(() => {
      measureLoopWidth();
      updateActiveFromCenter();
    });
    ro.observe(wrap);
    return () => {
      wrap.removeEventListener("scroll", onCarouselScroll);
      ro.disconnect();
    };
  }, [carouselDomItems, isMobileNav, measureLoopWidth, normalizeLoopScroll, scrollItems.length]);

  useEffect(() => {
    if (!isMobileNav || scrollItems.length <= 1) {
      return;
    }
    const wrap = navLinksRef.current;
    if (!wrap) {
      return;
    }

    const DWELL_MS = 2000;
    const SCROLL_MS = 1500;

    let timeoutId: number | undefined;
    let resumeTimer: number | undefined;
    let cancelled = false;

    const clearScheduled = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    };

    const schedule = (delayMs: number, fn: () => void) => {
      clearScheduled();
      timeoutId = window.setTimeout(() => {
        timeoutId = undefined;
        if (!cancelled) {
          fn();
        }
      }, delayMs);
    };

    const finishLoopReset = () => {
      const loopWidth = measureLoopWidth();
      if (loopWidth > 0 && wrap.scrollLeft >= loopWidth - 2) {
        wrap.style.scrollBehavior = "auto";
        wrap.scrollLeft -= loopWidth;
        wrap.style.removeProperty("scroll-behavior");
      }
      navAutoIndexRef.current = 0;
      activeNavIndexRef.current = 0;
      setActiveNavIndex(0);
    };

    const scrollToDomIndexLocal = (domIndex: number, behavior: ScrollBehavior) => {
      const el = scrollItemRefs.current[domIndex];
      if (!wrap || !el) {
        return;
      }
      const target = el.offsetLeft - (wrap.clientWidth - el.offsetWidth) / 2;
      wrap.scrollTo({ left: Math.max(0, target), behavior });
      const logicalIndex = scrollItems.length > 0 ? domIndex % scrollItems.length : 0;
      navAutoIndexRef.current = logicalIndex;
      activeNavIndexRef.current = logicalIndex;
      setActiveNavIndex(logicalIndex);
    };

    const afterScroll = (onDone: () => void) => {
      let finished = false;
      const finish = () => {
        if (finished) {
          return;
        }
        finished = true;
        onDone();
      };

      if ("onscrollend" in wrap) {
        wrap.addEventListener("scrollend", finish, { once: true });
        window.setTimeout(finish, SCROLL_MS + 250);
        return;
      }
      schedule(SCROLL_MS, finish);
    };

    const step = () => {
      if (cancelled || navAutoScrollPaused.current || dragState.current.active) {
        schedule(400, step);
        return;
      }

      schedule(DWELL_MS, () => {
        if (cancelled || navAutoScrollPaused.current || dragState.current.active) {
          step();
          return;
        }

        const count = scrollItems.length;
        const logical = navAutoIndexRef.current;
        const nextDomIndex = logical === count - 1 ? count : logical + 1;

        scrollToDomIndexLocal(nextDomIndex, "smooth");
        afterScroll(() => {
          if (cancelled) {
            return;
          }
          if (logical === count - 1) {
            finishLoopReset();
          }
          schedule(0, step);
        });
      });
    };

    const pauseAutoScroll = () => {
      navAutoScrollPaused.current = true;
      clearScheduled();
      if (resumeTimer !== undefined) {
        window.clearTimeout(resumeTimer);
      }
      resumeTimer = window.setTimeout(() => {
        navAutoScrollPaused.current = false;
        navAutoIndexRef.current = activeNavIndexRef.current;
        step();
      }, 2800);
    };

    wrap.addEventListener("pointerdown", pauseAutoScroll);
    wrap.addEventListener("touchstart", pauseAutoScroll, { passive: true });
    wrap.addEventListener("wheel", pauseAutoScroll, { passive: true });

    navAutoIndexRef.current = activeNavIndexRef.current;
    requestAnimationFrame(() => {
      measureLoopWidth();
      scrollToDomIndexLocal(navAutoIndexRef.current, "auto");
      step();
    });

    return () => {
      cancelled = true;
      clearScheduled();
      if (resumeTimer !== undefined) {
        window.clearTimeout(resumeTimer);
      }
      wrap.removeEventListener("pointerdown", pauseAutoScroll);
      wrap.removeEventListener("touchstart", pauseAutoScroll);
      wrap.removeEventListener("wheel", pauseAutoScroll);
    };
  }, [isMobileNav, measureLoopWidth, scrollItems.length]);

  const scrollToNavIndex = useCallback(
    (logicalIndex: number, behavior: ScrollBehavior = "smooth") => {
      scrollToDomIndex(logicalIndex, behavior);
    },
    [scrollToDomIndex]
  );

  const onCarouselPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const wrap = navLinksRef.current;
    if (!wrap || event.button !== 0) {
      return;
    }
    navAutoScrollPaused.current = true;
    dragState.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: wrap.scrollLeft,
      moved: false,
    };
    wrap.setPointerCapture(event.pointerId);
    wrap.classList.add("is-dragging");
  };

  const onCarouselPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const wrap = navLinksRef.current;
    if (!wrap || !dragState.current.active) {
      return;
    }
    const dx = event.clientX - dragState.current.startX;
    if (Math.abs(dx) > 4) {
      dragState.current.moved = true;
    }
    wrap.scrollLeft = dragState.current.startScrollLeft - dx;
    normalizeLoopScroll(wrap, true);
  };

  const endCarouselDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const wrap = navLinksRef.current;
    if (!wrap) {
      return;
    }
    if (wrap.hasPointerCapture(event.pointerId)) {
      wrap.releasePointerCapture(event.pointerId);
    }
    wrap.classList.remove("is-dragging");
    dragState.current.active = false;
    normalizeLoopScroll(wrap);
    window.setTimeout(() => {
      navAutoScrollPaused.current = false;
      navAutoIndexRef.current = activeNavIndexRef.current;
    }, 2400);
  };

  const onCarouselItemClick = (logicalIndex: number) => (event: React.MouseEvent) => {
    if (dragState.current.moved) {
      event.preventDefault();
      dragState.current.moved = false;
      return;
    }
    if (logicalIndex !== activeNavIndexRef.current) {
      event.preventDefault();
      scrollToNavIndex(logicalIndex);
    }
  };

  if (
    pathname?.startsWith("/admin") ||
    (pathname?.startsWith("/newsletter") && !pathname.startsWith("/newsletter/archive"))
  ) {
    return null;
  }

  const basketLink = (
    <Link
      href="/cart"
      className="nav-basket-btn"
      aria-label={`Basket${totalItems ? `, ${totalItems} items` : ""}`}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 7h14l-1.5 9H8.5L7 7Zm2-3h8a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        <path d="M9 11h8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
      {totalItems > 0 ? <span className="nav-basket-count">{totalItems}</span> : null}
    </Link>
  );

  const desktopNavLinks = navItems
    .filter((item) => item !== "Maroma Experiences")
    .map((item) => (
      <Link key={item} href={item === "Newsletter" ? "/blog" : getNavHref(item)}>
        {item}
      </Link>
    ));

  const navStateClass = `${scrolled ? "nav-solid" : "nav-overlay"}${navLiftUp ? " nav-lift" : ""}`;

  if (isB2bRoute) {
    return (
      <header
        className={`site-header site-header-responsive site-header-b2b${scrolled ? " site-header-solid" : ""}${navLiftUp ? " site-header-lift" : ""}`}
        data-review="Site header"
        data-review-id="site-header-b2b"
        data-review-files="app/components/SiteHeader.tsx"
      >
        <nav className={`nav nav-b2b ${navStateClass}`}>
          <Link href="/?skipIntro=1" className="brand" aria-label={`${brand} home`}>
            <NavImg src="/nav-maroma-logo.png" alt={brand} className="brand-logo" width={160} height={22} />
          </Link>
          <p className="nav-b2b-label">Wholesale</p>
          <div className="nav-end nav-end--b2b">
            <Link href="/account" className="nav-b2b-account">
              Account
            </Link>
          </div>
        </nav>
      </header>
    );
  }

  return (
    <header className={`site-header site-header-responsive compact-store-header${scrolled ? " site-header-solid" : ""}`}>
      <nav className={`compact-store-nav ${navStateClass}`} aria-label="Main navigation">
        <Link href="/?skipIntro=1" className="brand" aria-label={`${brand} home`}>
          <NavImg src="/nav-maroma-logo.png" alt={brand} className="brand-logo" width={160} height={22} />
        </Link>
        <CompactShopNavigation experiencesUrl={MAROMA_EXPERIENCES_URL} spaUrl={SPA_BOOKING_URL} />
        <div className="compact-store-search"><NavSearchBar compact /></div>
        <div className="compact-store-basket">{basketLink}</div>
      </nav>
    </header>
  );
}
