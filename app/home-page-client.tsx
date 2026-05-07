"use client";

import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ProductListingWithFilters } from "./components/ProductListingWithFilters";
import { ProductScroller } from "./components/ProductScroller";
import { DynamicProductShowcase } from "./components/DynamicProductShowcase";
import { RitualFaceTeaser } from "./components/RitualFaceTeaser";
import type { ProductRecord } from "../lib/product-types";
import { RITUAL_TEASER_POS_STORAGE_KEY } from "../lib/ritual-teaser-pos";
import { VISUAL_STATE_STORAGE_KEY, type HeroVisualState } from "../lib/hero-media-layout-types";
import { contentStorageKey, siteContent, type SiteContent } from "./content";
import { getDisplayImageUrl } from "../lib/product-image";

type HeroMediaLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type HeroLayerId = "primary" | "overlay";

type HeroLayerSettings = {
  visible: boolean;
  opacity: number;
  zIndex: number;
  rotateDeg: number;
  scale: number;
  fit: "cover" | "contain";
};

type HeroOverlayLayer = HeroLayerSettings & {
  src: string;
  layout: HeroMediaLayout;
};

type HeroVisualApiState = {
  layout?: HeroMediaLayout;
  backgroundVisible?: boolean;
  headlineVisible?: boolean;
  eyebrowVisible?: boolean;
  actionsVisible?: boolean;
  ritualsVisible?: boolean;
  heroPos?: { x: number; y: number };
  headlinePos?: { x: number; y: number };
  headlineSizeRem?: number;
  eyebrowPos?: { x: number; y: number };
  eyebrowPosRatio?: { x: number; y: number };
  heroActionsPos?: { x: number; y: number };
  heroCopyWidthVw?: number;
  primarySettings?: HeroLayerSettings;
  overlayLayer?: HeroOverlayLayer;
  heroLayout?: HeroMediaLayout;
  productShowcasePos?: { x: number; y: number };
  ritualCarouselPos?: { x: number; y: number };
  bgColors?: string[];
  bgAngle?: number;
  lovedSectionVisible?: boolean;
  lovedFloralsVisible?: boolean;
  lovedWashVisible?: boolean;
  lovedBandVisible?: boolean;
  lovedDividerOffsetY?: number;
  lovedFloralOffsetY?: number;
  lovedFloralOpacity?: number;
  lovedTintOffsetX?: number;
  lovedTintOffsetY?: number;
  lovedTintOpacity?: number;
  lovedTint2OffsetX?: number;
  lovedTint2OffsetY?: number;
  lovedTint2Opacity?: number;
  lovedTint2TopPct?: number;
  lovedTint2HeightPct?: number;
  heroSectionHeight?: number;
  error?: string;
};

type HomePageClientProps = {
  initialHeroVisual: HeroVisualState;
  initialSiteContent: SiteContent;
};

const FLOATING_ADMIN_CHROME_KEY = "maroma-floating-admin-chrome";

type FloatingAdminChrome = {
  bgOpacity: number;
  bottomPx: number;
  sideInsetPx: number;
};

const defaultFloatingChrome: FloatingAdminChrome = {
  bgOpacity: 0.94,
  bottomPx: 20,
  sideInsetPx: 20
};

const imageHasTransparency = (image: HTMLImageElement): boolean => {
  const sampleMax = 300;
  const scale = Math.min(1, sampleMax / Math.max(image.width, image.height));
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return false;
  }
  ctx.drawImage(image, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) {
      return true;
    }
  }
  return false;
};

export default function HomePageClient({ initialHeroVisual, initialSiteContent }: HomePageClientProps) {
  const [content, setContent] = useState<SiteContent>(initialSiteContent);
  const [heroLayout, setHeroLayout] = useState<HeroMediaLayout>(initialHeroVisual.heroLayout || { x: 0, y: 0, width: 100, height: 80 });
  const [headlinePos, setHeadlinePos] = useState(initialHeroVisual.headlinePos);
  const [headlineSizeRem, setHeadlineSizeRem] = useState(initialHeroVisual.headlineSizeRem);
  const [heroActionsPos, setHeroActionsPos] = useState(initialHeroVisual.heroActionsPos);
  const [ritualCarouselPos, setRitualCarouselPos] = useState(initialHeroVisual.ritualCarouselPos);

  const [eyebrowPos, setEyebrowPos] = useState(initialHeroVisual.eyebrowPos);
  const [heroCopyWidthVw, setHeroCopyWidthVw] = useState(initialHeroVisual.heroCopyWidthVw);
  const [heroMediaLayout, setHeroMediaLayout] = useState<HeroMediaLayout>(initialHeroVisual.layout);
  const [backgroundVisible, setBackgroundVisible] = useState<boolean>(initialHeroVisual.backgroundVisible ?? true);
  const [headlineVisible, setHeadlineVisible] = useState<boolean>(initialHeroVisual.headlineVisible ?? true);
  const [eyebrowVisible, setEyebrowVisible] = useState<boolean>(initialHeroVisual.eyebrowVisible ?? true);
  const [actionsVisible, setActionsVisible] = useState<boolean>(initialHeroVisual.actionsVisible ?? true);
  const [ritualsVisible, setRitualsVisible] = useState<boolean>(initialHeroVisual.ritualsVisible ?? true);
  const [heroPrimarySettings, setHeroPrimarySettings] = useState<HeroLayerSettings>(() => ({
    ...initialHeroVisual.primarySettings
  }));
  const [heroOverlayLayer, setHeroOverlayLayer] = useState<HeroOverlayLayer>(() => ({
    ...initialHeroVisual.overlayLayer,
    layout: { ...initialHeroVisual.overlayLayer.layout }
  }));
  const [selectedHeroLayer, setSelectedHeroLayer] = useState<HeroLayerId>("primary");

  const [floatingPanelPos, setFloatingPanelPos] = useState({ x: 0, y: 0 });
  const [floatingPanelMinimized, setFloatingPanelMinimized] = useState(false);
  const [adminDragEnabled, setAdminDragEnabled] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [bgColors, setBgColors] = useState<string[]>(initialHeroVisual.bgColors || ["#dbe3d0", "#cbd5c0", "#d6deca"]);
  const [bgAngle, setBgAngle] = useState<number>(initialHeroVisual.bgAngle || 135);
  const [lovedSectionVisible, setLovedSectionVisible] = useState<boolean>(initialHeroVisual.lovedSectionVisible ?? true);
  const [lovedFloralsVisible, setLovedFloralsVisible] = useState<boolean>(initialHeroVisual.lovedFloralsVisible ?? true);
  const [lovedWashVisible, setLovedWashVisible] = useState<boolean>(initialHeroVisual.lovedWashVisible ?? true);
  const [lovedBandVisible, setLovedBandVisible] = useState<boolean>(initialHeroVisual.lovedBandVisible ?? true);
  const [lovedDividerOffsetY, setLovedDividerOffsetY] = useState<number>(initialHeroVisual.lovedDividerOffsetY || 0);
  const [lovedFloralOffsetY, setLovedFloralOffsetY] = useState<number>(initialHeroVisual.lovedFloralOffsetY || 0);
  const [lovedFloralOpacity, setLovedFloralOpacity] = useState<number>(
    typeof initialHeroVisual.lovedFloralOpacity === "number" ? initialHeroVisual.lovedFloralOpacity : 1
  );
  const [lovedTintOffsetX, setLovedTintOffsetX] = useState<number>(
    typeof initialHeroVisual.lovedTintOffsetX === "number" ? initialHeroVisual.lovedTintOffsetX : 0
  );
  const [lovedTintOffsetY, setLovedTintOffsetY] = useState<number>(initialHeroVisual.lovedTintOffsetY || 0);
  const [lovedTintOpacity, setLovedTintOpacity] = useState<number>(
    typeof initialHeroVisual.lovedTintOpacity === "number" ? initialHeroVisual.lovedTintOpacity : 0.38
  );
  const [lovedTint2OffsetX, setLovedTint2OffsetX] = useState<number>(
    typeof initialHeroVisual.lovedTint2OffsetX === "number" ? initialHeroVisual.lovedTint2OffsetX : 0
  );
  const [lovedTint2OffsetY, setLovedTint2OffsetY] = useState<number>(
    typeof initialHeroVisual.lovedTint2OffsetY === "number" ? initialHeroVisual.lovedTint2OffsetY : 0
  );
  const [lovedTint2Opacity, setLovedTint2Opacity] = useState<number>(
    typeof initialHeroVisual.lovedTint2Opacity === "number" ? initialHeroVisual.lovedTint2Opacity : 0
  );
  const [lovedTint2TopPct, setLovedTint2TopPct] = useState<number>(
    typeof initialHeroVisual.lovedTint2TopPct === "number" ? initialHeroVisual.lovedTint2TopPct : 38
  );
  const [lovedTint2HeightPct, setLovedTint2HeightPct] = useState<number>(
    typeof initialHeroVisual.lovedTint2HeightPct === "number" ? initialHeroVisual.lovedTint2HeightPct : 22
  );
  const [productShowcasePos, setProductShowcasePos] = useState(initialHeroVisual.productShowcasePos || { x: 0, y: 0 });
  const [heroSectionHeight, setHeroSectionHeight] = useState(initialHeroVisual.heroSectionHeight || 100);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [floatingChrome, setFloatingChrome] = useState<FloatingAdminChrome>(defaultFloatingChrome);

  type AdminLayerId =
    | "primary"
    | "overlay"
    | "background"
    | "headline"
    | "eyebrow"
    | "actions"
    | "rituals"
    | "loved-florals"
    | "loved-wash"
    | "loved-band"
    | "loved-section";
  const [adminEditLayer, setAdminEditLayer] = useState<AdminLayerId>('primary');

  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productStatus, setProductStatus] = useState("Loading products...");
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const basePos = useRef(initialHeroVisual.headlinePos);
  const heroActionsDragStart = useRef<{ x: number; y: number } | null>(null);
  const heroActionsBaseRef = useRef({ x: 0, y: 0 });
  const heroActionsPosRef = useRef(initialHeroVisual.heroActionsPos);
  const floatingPanelDragStart = useRef<{ x: number; y: number } | null>(null);
  const floatingPanelBase = useRef({ x: 0, y: 0 });
  const floatingPanelRef = useRef<HTMLDivElement | null>(null);

  const clampFloatingPanelPos = useCallback((pos: { x: number; y: number }) => {
    if (typeof window === "undefined") {
      return pos;
    }
    const iw = window.innerWidth;
    const ih = window.innerHeight;
    const pad = 12;
    const rightOffset = floatingChrome.sideInsetPx;
    const bottomOffset = floatingChrome.bottomPx;
    const el = floatingPanelRef.current;
    const panelW = Math.max(el?.offsetWidth ?? 260, 120);
    const panelH = Math.max(el?.offsetHeight ?? 260, 120);
    const leftAtZero = iw - rightOffset - panelW;
    const topAtZero = ih - bottomOffset - panelH;
    const minX = pad - leftAtZero;
    const maxX = iw - pad - panelW - leftAtZero;
    const minY = pad - topAtZero;
    const maxY = ih - pad - panelH - topAtZero;
    if (minX > maxX || minY > maxY) {
      return pos;
    }
    return {
      x: Math.max(minX, Math.min(maxX, pos.x)),
      y: Math.max(minY, Math.min(maxY, pos.y))
    };
  }, [floatingChrome.bottomPx, floatingChrome.sideInsetPx]);

  const mediaDragStart = useRef<{ x: number; y: number } | null>(null);
  const mediaResizeStart = useRef<{ x: number; y: number } | null>(null);
  const mediaBaseLayout = useRef<HeroMediaLayout>({ ...initialHeroVisual.layout });
  const mediaInteractionLayerRef = useRef<HeroLayerId>("primary");

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(contentStorageKey);
    if (!stored) {
      return;
    }
    try {
      const parsed = JSON.parse(stored) as SiteContent;
      if (JSON.stringify(parsed) !== JSON.stringify(initialSiteContent)) {
        setContent(parsed);
      }
    } catch {
      // keep server-provided content
    }
  }, [initialSiteContent]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(max-width: 900px)");
    const updateViewportMode = () => setIsMobileViewport(media.matches);
    updateViewportMode();
    media.addEventListener("change", updateViewportMode);
    return () => media.removeEventListener("change", updateViewportMode);
  }, []);

  useEffect(() => {
    const loadContent = async () => {
      try {
        const response = await fetch("/api/site-content", { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as { content?: SiteContent | null };
          if (payload.content) {
            const next = payload.content;
            setContent((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
            try {
              window.localStorage.setItem(contentStorageKey, JSON.stringify(payload.content));
            } catch {
              // ignore quota errors
            }
            window.dispatchEvent(new Event("maroma-site-content-changed"));
            return;
          }
        }
      } catch {
        // ignore
      }
    };
    const onResume = () => {
      if (document.visibilityState === "visible") {
        void loadContent();
      }
    };
    const onFocus = () => void loadContent();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onResume);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, []);

  const persistSiteContentToServer = async (next: SiteContent) => {
    try {
      window.localStorage.setItem(contentStorageKey, JSON.stringify(next));
    } catch {
      // quota or private mode
    }
    try {
      await fetch("/api/site-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: next })
      });
      window.dispatchEvent(new Event("maroma-site-content-changed"));
    } catch {
      // server unavailable — local copy may still exist
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadProducts = async () => {
      try {
        const params = new URLSearchParams();
        if (productSearch.trim()) {
          params.set("q", productSearch.trim());
        }
        params.set("onlyWithImages", "1");
        params.set("limit", "120");
        const response = await fetch(`/api/products?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error("Failed to load products");
        }
        const data = (await response.json()) as { products?: ProductRecord[]; count?: number };
        const allProducts = data.products ?? [];
        const filtered = allProducts.filter(p => {
          const isBabyName = p.name.toLowerCase().includes("baby");
          const isBabyCategory = p.categories.some(c => c.toLowerCase().includes("baby"));
          return !isBabyName && !isBabyCategory;
        });
        setProducts(filtered);
        const count = filtered.length;
        setProductStatus(
          count > 0 ? `${count} products found` : "No products match this search yet."
        );
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") {
          return;
        }
        setProductStatus("Unable to load products right now.");
      }
    };
    void loadProducts();
    return () => controller.abort();
  }, [productSearch]);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".scroll-zoom"));
    if (nodes.length === 0) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-inview");
          }
        }
      },
      { threshold: 0.22, rootMargin: "0px 0px -6% 0px" }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [content, products.length]);

  useEffect(() => {
    const stored = window.localStorage.getItem("maroma-admin-drag");
    setAdminDragEnabled(stored === "true");
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("maroma-floating-admin-minimized");
    setFloatingPanelMinimized(stored === "true");
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("maroma-floating-admin-pos");
    if (stored) {
      try { setFloatingPanelPos(JSON.parse(stored)); } catch { }
    }
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(FLOATING_ADMIN_CHROME_KEY);
    if (!stored) {
      return;
    }
    try {
      const raw = JSON.parse(stored) as Partial<FloatingAdminChrome>;
      setFloatingChrome({
        bgOpacity:
          typeof raw.bgOpacity === "number"
            ? Math.min(1, Math.max(0.08, raw.bgOpacity))
            : defaultFloatingChrome.bgOpacity,
        bottomPx:
          typeof raw.bottomPx === "number"
            ? Math.min(160, Math.max(0, Math.round(raw.bottomPx)))
            : defaultFloatingChrome.bottomPx,
        sideInsetPx:
          typeof raw.sideInsetPx === "number"
            ? Math.min(64, Math.max(0, Math.round(raw.sideInsetPx)))
            : defaultFloatingChrome.sideInsetPx
      });
    } catch {
      // keep defaults
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(FLOATING_ADMIN_CHROME_KEY, JSON.stringify(floatingChrome));
    } catch {
      // ignore
    }
  }, [floatingChrome]);

  useEffect(() => {
    const stored = window.localStorage.getItem(VISUAL_STATE_STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored) as HeroVisualApiState;
        if (data.layout) setHeroMediaLayout(data.layout);
        if (data.primarySettings) setHeroPrimarySettings(data.primarySettings);
        if (data.overlayLayer) setHeroOverlayLayer(data.overlayLayer);
        if (data.headlineSizeRem) setHeadlineSizeRem(data.headlineSizeRem);
        if (data.heroCopyWidthVw) setHeroCopyWidthVw(data.heroCopyWidthVw);
        if (data.heroLayout) setHeroLayout(data.heroLayout);
        if (data.headlinePos) setHeadlinePos(data.headlinePos);
        if (data.heroActionsPos) setHeroActionsPos(data.heroActionsPos);
        if (data.bgColors) setBgColors(data.bgColors);
        if (data.bgAngle) setBgAngle(data.bgAngle);
        if (typeof data.backgroundVisible === "boolean") setBackgroundVisible(data.backgroundVisible);
        if (typeof data.headlineVisible === "boolean") setHeadlineVisible(data.headlineVisible);
        if (typeof data.eyebrowVisible === "boolean") setEyebrowVisible(data.eyebrowVisible);
        if (typeof data.actionsVisible === "boolean") setActionsVisible(data.actionsVisible);
        if (typeof data.ritualsVisible === "boolean") setRitualsVisible(data.ritualsVisible);
        if (typeof data.lovedSectionVisible === "boolean") setLovedSectionVisible(data.lovedSectionVisible);
        if (typeof data.lovedFloralsVisible === "boolean") setLovedFloralsVisible(data.lovedFloralsVisible);
        if (typeof data.lovedWashVisible === "boolean") setLovedWashVisible(data.lovedWashVisible);
        if (typeof data.lovedBandVisible === "boolean") setLovedBandVisible(data.lovedBandVisible);
        if (typeof data.lovedDividerOffsetY === "number") setLovedDividerOffsetY(data.lovedDividerOffsetY);
        if (typeof data.lovedFloralOffsetY === "number") setLovedFloralOffsetY(data.lovedFloralOffsetY);
        if (typeof data.lovedFloralOpacity === "number") setLovedFloralOpacity(data.lovedFloralOpacity);
        if (typeof data.lovedTintOffsetX === "number") setLovedTintOffsetX(data.lovedTintOffsetX);
        if (typeof data.lovedTintOffsetY === "number") setLovedTintOffsetY(data.lovedTintOffsetY);
        if (typeof data.lovedTintOpacity === "number") setLovedTintOpacity(data.lovedTintOpacity);
        if (typeof data.lovedTint2OffsetX === "number") setLovedTint2OffsetX(data.lovedTint2OffsetX);
        if (typeof data.lovedTint2OffsetY === "number") setLovedTint2OffsetY(data.lovedTint2OffsetY);
        if (typeof data.lovedTint2Opacity === "number") setLovedTint2Opacity(data.lovedTint2Opacity);
        if (typeof data.lovedTint2TopPct === "number") setLovedTint2TopPct(data.lovedTint2TopPct);
        if (typeof data.lovedTint2HeightPct === "number") setLovedTint2HeightPct(data.lovedTint2HeightPct);
        if (typeof data.heroSectionHeight === "number") setHeroSectionHeight(data.heroSectionHeight);
      } catch { }
    }
  }, []);

  useEffect(() => {
    const onResize = () => {
      setFloatingPanelPos((prev) => clampFloatingPanelPos(prev));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampFloatingPanelPos]);

  useEffect(() => {
    setFloatingPanelPos((prev) => clampFloatingPanelPos(prev));
  }, [adminDragEnabled, clampFloatingPanelPos]);

  useEffect(() => {
    const el = floatingPanelRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(() => {
      setFloatingPanelPos((prev) => clampFloatingPanelPos(prev));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [adminDragEnabled, clampFloatingPanelPos]);

  useEffect(() => {
    let active = true;
    const loadLatestVisualState = async () => {
      try {
        const response = await fetch("/api/hero-media-layout", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as HeroVisualApiState;
        if (!active || data.error) {
          return;
        }
        if (data.layout) setHeroMediaLayout(data.layout);
        if (data.primarySettings) setHeroPrimarySettings(data.primarySettings);
        if (data.overlayLayer) setHeroOverlayLayer(data.overlayLayer);
        if (typeof data.headlineSizeRem === "number") setHeadlineSizeRem(data.headlineSizeRem);
        if (typeof data.heroCopyWidthVw === "number") setHeroCopyWidthVw(data.heroCopyWidthVw);
        if (data.heroLayout) setHeroLayout(data.heroLayout);
        if (data.headlinePos) setHeadlinePos(data.headlinePos);
        if (data.heroActionsPos) setHeroActionsPos(data.heroActionsPos);
        if (data.eyebrowPos) setEyebrowPos(data.eyebrowPos);
        if (data.ritualCarouselPos) setRitualCarouselPos(data.ritualCarouselPos);
        if (data.bgColors) setBgColors(data.bgColors);
        if (typeof data.bgAngle === "number") setBgAngle(data.bgAngle);
        if (typeof data.backgroundVisible === "boolean") setBackgroundVisible(data.backgroundVisible);
        if (typeof data.headlineVisible === "boolean") setHeadlineVisible(data.headlineVisible);
        if (typeof data.eyebrowVisible === "boolean") setEyebrowVisible(data.eyebrowVisible);
        if (typeof data.actionsVisible === "boolean") setActionsVisible(data.actionsVisible);
        if (typeof data.ritualsVisible === "boolean") setRitualsVisible(data.ritualsVisible);
        if (typeof data.lovedSectionVisible === "boolean") setLovedSectionVisible(data.lovedSectionVisible);
        if (typeof data.lovedFloralsVisible === "boolean") setLovedFloralsVisible(data.lovedFloralsVisible);
        if (typeof data.lovedWashVisible === "boolean") setLovedWashVisible(data.lovedWashVisible);
        if (typeof data.lovedBandVisible === "boolean") setLovedBandVisible(data.lovedBandVisible);
        if (typeof data.lovedDividerOffsetY === "number") setLovedDividerOffsetY(data.lovedDividerOffsetY);
        if (typeof data.lovedFloralOffsetY === "number") setLovedFloralOffsetY(data.lovedFloralOffsetY);
        if (typeof data.lovedFloralOpacity === "number") setLovedFloralOpacity(data.lovedFloralOpacity);
        if (typeof data.lovedTintOffsetX === "number") setLovedTintOffsetX(data.lovedTintOffsetX);
        if (typeof data.lovedTintOffsetY === "number") setLovedTintOffsetY(data.lovedTintOffsetY);
        if (typeof data.lovedTintOpacity === "number") setLovedTintOpacity(data.lovedTintOpacity);
        if (typeof data.lovedTint2OffsetX === "number") setLovedTint2OffsetX(data.lovedTint2OffsetX);
        if (typeof data.lovedTint2OffsetY === "number") setLovedTint2OffsetY(data.lovedTint2OffsetY);
        if (typeof data.lovedTint2Opacity === "number") setLovedTint2Opacity(data.lovedTint2Opacity);
        if (typeof data.lovedTint2TopPct === "number") setLovedTint2TopPct(data.lovedTint2TopPct);
        if (typeof data.lovedTint2HeightPct === "number") setLovedTint2HeightPct(data.lovedTint2HeightPct);
        if (typeof data.heroSectionHeight === "number") setHeroSectionHeight(data.heroSectionHeight);
      } catch {
        // Keep current state when API is unavailable.
      }
    };
    void loadLatestVisualState();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    heroActionsPosRef.current = heroActionsPos;
  }, [heroActionsPos]);

  const handlePointerDown = (event: React.PointerEvent<HTMLHeadingElement>) => {
    if (!adminDragEnabled) {
      return;
    }
    dragStart.current = { x: event.clientX, y: event.clientY };
    basePos.current = headlinePos;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLHeadingElement>) => {
    if (!dragStart.current || !adminDragEnabled) {
      return;
    }
    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;
    setHeadlinePos({
      x: basePos.current.x + dx,
      y: basePos.current.y + dy
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLHeadingElement>) => {
    if (!adminDragEnabled) {
      return;
    }
    dragStart.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    void persistHeroVisualPatch({ headlinePos });
  };

  const handleHeroActionsPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!adminDragEnabled) {
      return;
    }
    heroActionsDragStart.current = { x: event.clientX, y: event.clientY };
    heroActionsBaseRef.current = heroActionsPosRef.current;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleHeroActionsPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!heroActionsDragStart.current || !adminDragEnabled) {
      return;
    }
    const dx = event.clientX - heroActionsDragStart.current.x;
    const dy = event.clientY - heroActionsDragStart.current.y;
    const next = {
      x: heroActionsBaseRef.current.x + dx,
      y: heroActionsBaseRef.current.y + dy
    };
    heroActionsPosRef.current = next;
    setHeroActionsPos(next);
  };

  const handleHeroActionsPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!adminDragEnabled) {
      return;
    }
    heroActionsDragStart.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    void persistHeroVisualPatch({
      heroActionsPos: {
        x: heroActionsPosRef.current.x,
        y: heroActionsPosRef.current.y
      }
    });
  };

  const clearSavedVisualPositions = useCallback(() => {
    try {
      const stored = window.localStorage.getItem(VISUAL_STATE_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as HeroVisualApiState;
        delete data.eyebrowPos;
        delete data.eyebrowPosRatio;
        delete data.ritualCarouselPos;
        window.localStorage.setItem(VISUAL_STATE_STORAGE_KEY, JSON.stringify(data));
      }
      window.localStorage.removeItem(RITUAL_TEASER_POS_STORAGE_KEY);
    } catch {
      window.localStorage.removeItem(VISUAL_STATE_STORAGE_KEY);
      window.localStorage.removeItem(RITUAL_TEASER_POS_STORAGE_KEY);
    }
  }, []);

  const persistHeroVisualPatch = async (patch: HeroVisualApiState) => {
    try {
      const stored = window.localStorage.getItem(VISUAL_STATE_STORAGE_KEY);
      const backup = stored ? JSON.parse(stored) as HeroVisualApiState : {};
      window.localStorage.setItem(VISUAL_STATE_STORAGE_KEY, JSON.stringify({ ...backup, ...patch }));
    } catch {
      // Server persistence is the source of truth.
    }

    try {
      await fetch("/api/hero-media-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
    } catch {
      // Best-effort persistence.
    }
  };

  const setEyebrowXFromPx = useCallback((nextX: number) => {
    const next = { ...eyebrowPos, x: nextX };
    setEyebrowPos(next);
    void persistHeroVisualPatch({ eyebrowPos: next });
  }, [eyebrowPos]);

  const setEyebrowYFromPx = useCallback((nextY: number) => {
    const next = { ...eyebrowPos, y: nextY };
    setEyebrowPos(next);
    void persistHeroVisualPatch({ eyebrowPos: next });
  }, [eyebrowPos]);

  const handleSaveAll = async () => {
    setSaveStatus("saving");
    const visualData = {
      layout: heroMediaLayout,
      backgroundVisible,
      headlineVisible,
      eyebrowVisible,
      actionsVisible,
      ritualsVisible,
      primarySettings: heroPrimarySettings,
      overlayLayer: heroOverlayLayer,
      headlineSizeRem,
      heroCopyWidthVw,
      heroLayout,
      headlinePos,
      heroActionsPos,
      ritualCarouselPos,
      eyebrowPos,
      bgColors,
      bgAngle,
      lovedSectionVisible,
      lovedFloralsVisible,
      lovedWashVisible,
      lovedBandVisible,
      lovedDividerOffsetY,
      lovedFloralOffsetY,
      lovedFloralOpacity,
      lovedTintOffsetX,
      lovedTintOffsetY,
      lovedTintOpacity,
      lovedTint2OffsetX,
      lovedTint2OffsetY,
      lovedTint2Opacity,
      lovedTint2TopPct,
      lovedTint2HeightPct,
      heroSectionHeight
    };

    // Backup to localStorage immediately
    try {
      window.localStorage.setItem(VISUAL_STATE_STORAGE_KEY, JSON.stringify(visualData));
    } catch { }

    try {
      const visualPromise = fetch("/api/hero-media-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(visualData)
      });

      const contentPromise = fetch("/api/site-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });

      await Promise.all([visualPromise, contentPromise]);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("idle");
    }
  };

  const handleCopyConfig = () => {
    const config = {
      visual: {
        layout: heroMediaLayout,
        backgroundVisible,
        headlineVisible,
        eyebrowVisible,
        actionsVisible,
        ritualsVisible,
        primarySettings: heroPrimarySettings,
        overlayLayer: heroOverlayLayer,
        headlineSizeRem,
        heroCopyWidthVw,
        heroLayout,
        headlinePos,
        heroActionsPos,
        eyebrowPos,
        bgColors,
        bgAngle,
        ritualCarouselPos,
        lovedSectionVisible,
        lovedFloralsVisible,
        lovedWashVisible,
        lovedBandVisible,
        lovedDividerOffsetY,
        lovedFloralOffsetY,
        lovedFloralOpacity,
        lovedTintOffsetX,
        lovedTintOffsetY,
        lovedTintOpacity,
        lovedTint2OffsetX,
        lovedTint2OffsetY,
        lovedTint2Opacity,
        lovedTint2TopPct,
        lovedTint2HeightPct,
        heroSectionHeight
      },
      content
    };
    void navigator.clipboard.writeText(JSON.stringify(config, null, 2));
  };

  const clampLayout = (layout: HeroMediaLayout): HeroMediaLayout => {
    const width = Math.min(100, Math.max(30, layout.width));
    const height = Math.min(100, Math.max(30, layout.height));
    const x = Math.max(-100, Math.min(100, layout.x));
    const y = Math.max(-100, Math.min(100, layout.y));
    return { x, y, width, height };
  };

  const clampLayerSettings = (settings: HeroLayerSettings): HeroLayerSettings => ({
    ...settings,
    opacity: Math.min(1, Math.max(0, settings.opacity)),
    zIndex: Math.min(20, Math.max(0, Math.round(settings.zIndex))),
    rotateDeg: Math.min(180, Math.max(-180, Number(settings.rotateDeg) || 0))
  });

  const setHeroMediaLayoutAndSave = (next: HeroMediaLayout) => {
    const clamped = clampLayout(next);
    setHeroMediaLayout(clamped);
    void persistHeroVisualPatch({ layout: clamped });
  };

  const setPrimarySettingsAndSave = (next: HeroLayerSettings) => {
    const clamped = clampLayerSettings(next);
    setHeroPrimarySettings(clamped);
    void persistHeroVisualPatch({ primarySettings: clamped });
  };

  const setOverlayLayerAndSave = (next: HeroOverlayLayer) => {
    const clamped: HeroOverlayLayer = {
      ...clampLayerSettings(next),
      src: next.src,
      layout: clampLayout(next.layout)
    };
    setHeroOverlayLayer(clamped);
    void persistHeroVisualPatch({ overlayLayer: clamped });
  };

  const activeLayerLayout =
    selectedHeroLayer === "primary" ? heroMediaLayout : heroOverlayLayer.layout;
  const activeLayerSettings =
    selectedHeroLayer === "primary" ? heroPrimarySettings : heroOverlayLayer;

  const handleHeroMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        return;
      }
      if (selectedHeroLayer === "overlay") {
        if (file.type.startsWith("image/")) {
          const image = new Image();
          image.onload = () => {
            const hasTransparency = imageHasTransparency(image);
            if (!hasTransparency) {
              window.alert("This image has no transparency (alpha). Please upload a real transparent PNG/WebP.");
            }
            const maxWidth = 1920;
            const maxHeight = 1080;
            const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(image.height * scale);
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              return;
            }
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            const keepAlpha =
              file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif";
            const compressed = keepAlpha
              ? canvas.toDataURL("image/png")
              : canvas.toDataURL("image/jpeg", 0.76);
            setOverlayLayerAndSave({
              ...heroOverlayLayer,
              src: compressed,
              visible: true
            });
          };
          image.src = dataUrl;
        } else {
          setOverlayLayerAndSave({
            ...heroOverlayLayer,
            src: dataUrl,
            visible: true
          });
        }
        return;
      }
      if (file.type.startsWith("image/")) {
        const image = new Image();
        image.onload = () => {
          const hasTransparency = imageHasTransparency(image);
          if (!hasTransparency) {
            window.alert("This image has no transparency (alpha). Please upload a real transparent PNG/WebP.");
          }
          const maxWidth = 1920;
          const maxHeight = 1080;
          const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return;
          }
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const keepAlpha =
            file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif";
          const compressed = keepAlpha
            ? canvas.toDataURL("image/png")
            : canvas.toDataURL("image/jpeg", 0.76);
          setContent((prev) => {
            const next = {
              ...prev,
              hero: {
                ...prev.hero,
                video: {
                  ...prev.hero.video,
                  poster: compressed,
                  src: ""
                }
              }
            };
            void persistSiteContentToServer(next);
            return next;
          });
        };
        image.src = dataUrl;
        return;
      }
      setContent((prev) => {
        const next = {
          ...prev,
          hero: {
            ...prev.hero,
            video: {
              ...prev.hero.video,
              src: dataUrl
            }
          }
        };
        void persistSiteContentToServer(next);
        return next;
      });
    };
    reader.readAsDataURL(file);
    event.currentTarget.value = "";
  };

  const handleCarouselFrameUpload = (
    slideIndex: number,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        return;
      }
      setContent((prev) => {
        const slides = [...prev.carousel.slides];
        const target = slides[slideIndex];
        if (!target) {
          return prev;
        }
        slides[slideIndex] = { ...target, image: dataUrl };
        const next = {
          ...prev,
          carousel: {
            ...prev.carousel,
            slides
          }
        };
        void persistSiteContentToServer(next);
        return next;
      });
    };
    reader.readAsDataURL(file);
    event.currentTarget.value = "";
  };

  const getHeroBounds = () => {
    const rect = heroSectionRef.current?.getBoundingClientRect();
    return {
      width: Math.max(rect?.width ?? 1, 1),
      height: Math.max(rect?.height ?? 1, 1)
    };
  };

  const floatingPanelChromeStyle = useMemo((): CSSProperties => {
    if (floatingPanelMinimized) {
      if (!isMobileViewport) {
        return { transform: `translate(${floatingPanelPos.x}px, ${floatingPanelPos.y}px)` };
      }
      return {};
    }
    const chrome: CSSProperties = {
      backgroundColor: `rgba(246, 245, 241, ${floatingChrome.bgOpacity})`,
      bottom: floatingChrome.bottomPx
    };
    if (isMobileViewport) {
      chrome.left = floatingChrome.sideInsetPx;
      chrome.right = floatingChrome.sideInsetPx;
    } else {
      chrome.right = floatingChrome.sideInsetPx;
      chrome.transform = `translate(${floatingPanelPos.x}px, ${floatingPanelPos.y}px)`;
    }
    return chrome;
  }, [
    floatingPanelMinimized,
    isMobileViewport,
    floatingPanelPos.x,
    floatingPanelPos.y,
    floatingChrome.bgOpacity,
    floatingChrome.bottomPx,
    floatingChrome.sideInsetPx
  ]);

  const bestSellersItems = useMemo(() => {
    return products
      .filter((p) => p.tags?.some((t) => t.toLowerCase() === "best seller"))
      .map((p) => ({
        label: p.name,
        description: p.shortDescription,
        image: getDisplayImageUrl(p) || "",
        color: "#f8f8f8",
        href: `/product/${p.id}`
      }))
      .slice(0, 15);
  }, [products]);

  const handleMediaDragDown = (event: React.PointerEvent<HTMLDivElement>, layerId: HeroLayerId) => {
    if (!adminDragEnabled) {
      return;
    }
    mediaInteractionLayerRef.current = layerId;
    const baseLayout =
      layerId === "primary" ? heroMediaLayout : heroOverlayLayer.layout;
    mediaDragStart.current = { x: event.clientX, y: event.clientY };
    mediaBaseLayout.current = { ...baseLayout };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleMediaDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!adminDragEnabled || !mediaDragStart.current || mediaResizeStart.current) {
      return;
    }
    const bounds = getHeroBounds();
    const dxPct = ((event.clientX - mediaDragStart.current.x) / bounds.width) * 100;
    const dyPct = ((event.clientY - mediaDragStart.current.y) / bounds.height) * 100;
    const next = clampLayout({
      ...mediaBaseLayout.current,
      x: mediaBaseLayout.current.x + dxPct,
      y: mediaBaseLayout.current.y + dyPct
    });
    if (mediaInteractionLayerRef.current === "primary") {
      setHeroMediaLayout(next);
    } else {
      setHeroOverlayLayer((prev) => ({ ...prev, layout: next }));
    }
  };

  const handleMediaDragUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!mediaDragStart.current) {
      return;
    }
    mediaDragStart.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (mediaResizeStart.current) {
      return;
    }
    if (mediaInteractionLayerRef.current === "primary") {
      setHeroMediaLayout((cur) => {
        const clamped = clampLayout(cur);
        void persistHeroVisualPatch({ layout: clamped });
        return clamped;
      });
    } else {
      setHeroOverlayLayer((prev) => {
        const clamped: HeroOverlayLayer = {
          ...prev,
          layout: clampLayout(prev.layout)
        };
        void persistHeroVisualPatch({ overlayLayer: clamped });
        return clamped;
      });
    }
  };

  const handleMediaResizeDown = (event: React.PointerEvent<HTMLButtonElement>, layerId: HeroLayerId) => {
    if (!adminDragEnabled) {
      return;
    }
    event.stopPropagation();
    mediaInteractionLayerRef.current = layerId;
    const baseLayout =
      layerId === "primary" ? heroMediaLayout : heroOverlayLayer.layout;
    mediaResizeStart.current = { x: event.clientX, y: event.clientY };
    mediaBaseLayout.current = { ...baseLayout };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleMediaResizeMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!adminDragEnabled || !mediaResizeStart.current) {
      return;
    }
    event.stopPropagation();
    const bounds = getHeroBounds();
    const dwPct = ((event.clientX - mediaResizeStart.current.x) / bounds.width) * 100;
    const dhPct = ((event.clientY - mediaResizeStart.current.y) / bounds.height) * 100;
    const next = clampLayout({
      ...mediaBaseLayout.current,
      width: mediaBaseLayout.current.width + dwPct,
      height: mediaBaseLayout.current.height + dhPct
    });
    if (mediaInteractionLayerRef.current === "primary") {
      setHeroMediaLayout(next);
    } else {
      setHeroOverlayLayer((prev) => ({ ...prev, layout: next }));
    }
  };

  const handleMediaResizeUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!mediaResizeStart.current) {
      return;
    }
    event.stopPropagation();
    mediaResizeStart.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (mediaInteractionLayerRef.current === "primary") {
      setHeroMediaLayout((cur) => {
        const clamped = clampLayout(cur);
        void persistHeroVisualPatch({ layout: clamped });
        return clamped;
      });
    } else {
      setHeroOverlayLayer((prev) => {
        const clamped: HeroOverlayLayer = {
          ...prev,
          layout: clampLayout(prev.layout)
        };
        void persistHeroVisualPatch({ overlayLayer: clamped });
        return clamped;
      });
    }
  };

  const handleFloatingPanelPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea, select, label")) {
      return;
    }
    floatingPanelDragStart.current = { x: event.clientX, y: event.clientY };
    floatingPanelBase.current = floatingPanelPos;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleFloatingPanelPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!floatingPanelDragStart.current) {
      return;
    }
    const dx = event.clientX - floatingPanelDragStart.current.x;
    const dy = event.clientY - floatingPanelDragStart.current.y;
    setFloatingPanelPos(clampFloatingPanelPos({
      x: floatingPanelBase.current.x + dx,
      y: floatingPanelBase.current.y + dy
    }));
  };

  const handleFloatingPanelPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!floatingPanelDragStart.current) {
      return;
    }
    const dx = event.clientX - floatingPanelDragStart.current.x;
    const dy = event.clientY - floatingPanelDragStart.current.y;
    const next = clampFloatingPanelPos({
      x: floatingPanelBase.current.x + dx,
      y: floatingPanelBase.current.y + dy
    });
    setFloatingPanelPos(next);
    floatingPanelDragStart.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    window.localStorage.setItem("maroma-floating-admin-pos", JSON.stringify(next));
  };

  const { hero, carousel, highlights, brand } = content;
  const hasHeroMedia = Boolean(hero.video.src || hero.video.poster);
  const hasOverlayMedia = Boolean(heroOverlayLayer.visible && heroOverlayLayer.src);
  // `hero-bg` adds a full-section darkening overlay via CSS (`.hero-bg::before`).
  // Only enable `hero-bg` when there is actually visible hero media.
  const hasAnyHeroVisualLayer =
    (hasHeroMedia && heroPrimarySettings.visible && heroPrimarySettings.opacity > 0.01) ||
    (hasOverlayMedia && heroOverlayLayer.visible && heroOverlayLayer.opacity > 0.01);
  const safeHeroSectionHeight = isMobileViewport ? Math.min(heroSectionHeight, 115) : heroSectionHeight;
  const mobileNeutralPos = { x: 0, y: 0 };
  const mobileHeroLayout = isMobileViewport
    ? { x: 0, y: 0, width: 100, height: 100 }
    : heroLayout;
  const mobilePrimaryLayout = isMobileViewport
    ? { x: 50, y: 52, width: 92, height: 74 }
    : heroMediaLayout;
  const mobileOverlayLayout = isMobileViewport
    ? { ...heroOverlayLayer.layout, x: 50, y: 52, width: 94, height: 76 }
    : heroOverlayLayer.layout;
  const mobilePrimaryScale = isMobileViewport ? Math.min(heroPrimarySettings.scale || 1, 1) : (heroPrimarySettings.scale || 1);
  const mobileOverlayScale = isMobileViewport ? Math.min(heroOverlayLayer.scale || 1, 1) : (heroOverlayLayer.scale || 1);
  const copyWidth = isMobileViewport ? 92 : heroCopyWidthVw;
  const eyebrowRenderPos = isMobileViewport ? mobileNeutralPos : eyebrowPos;
  const headlineRenderPos = isMobileViewport ? mobileNeutralPos : headlinePos;
  const heroActionsRenderPos = isMobileViewport ? mobileNeutralPos : heroActionsPos;
  const ritualRenderPos = isMobileViewport ? mobileNeutralPos : ritualCarouselPos;
  const primaryMediaPointerEvents =
    hasHeroMedia && adminDragEnabled && selectedHeroLayer === "overlay" ? "none" : "auto";
  const overlayMediaPointerEvents =
    adminDragEnabled && selectedHeroLayer === "overlay" ? "auto" : "none";

  return (
    <div className="page maroma">
      <section
        className={`hero ${hasAnyHeroVisualLayer ? "hero-bg" : ""}`}
        id="hero"
        ref={heroSectionRef}
        style={{ minHeight: `${safeHeroSectionHeight}vh` }}
      >
        {backgroundVisible ? (
          <div
            className="hero-background-layer"
            aria-hidden="true"
            style={{
              transform: `translate(${mobileHeroLayout.x}vw, ${mobileHeroLayout.y}vh)`,
              width: `${mobileHeroLayout.width}vw`,
              // Always cover the hero section; otherwise the hero's ::before overlay darkens the
              // underlying page background and reads as an uncontrolled "grey band".
              minHeight: `${safeHeroSectionHeight}vh`,
              background: `linear-gradient(${bgAngle}deg, ${bgColors.join(", ")})`
            }}
          />
        ) : null}
        <div className="hero-copy">
          <div style={{ width: `${copyWidth}vw`, maxWidth: "100%" }}>
          {eyebrowVisible ? (
            <span
              className="eyebrow hero-eyebrow scroll-zoom"
              style={{ transform: `translate(${eyebrowRenderPos.x}px, ${eyebrowRenderPos.y}px)` }}
            >
              {hero.eyebrow}
            </span>
          ) : null}
          {headlineVisible ? (
            <h1
              className="hero-headline scroll-zoom"
              style={{
                transform: `translate(${headlineRenderPos.x}px, ${headlineRenderPos.y}px)`,
                fontSize: `${headlineSizeRem}rem`
              }}
            >
              {hero.headline}
            </h1>
          ) : null}
          {hero.subhead ? <p className="scroll-zoom">{hero.subhead}</p> : null}
          {actionsVisible ? (
            <div
              className={`hero-actions${adminDragEnabled ? " hero-cta-drag" : ""}`}
              style={{ transform: `translate(${heroActionsRenderPos.x}px, ${heroActionsRenderPos.y}px)` }}
            >
              <Link href="/special" className="button primary button-gold">
                {hero.ctaPrimary}
              </Link>
              <Link href="/rituals" className="button primary button-sage">
                {hero.ctaSecondary}
              </Link>
              <Link href="#shop" className="button secondary">
                Search Products
              </Link>
            </div>
          ) : null}
          {hero.phrases.length > 0 ? (
            <div className="phrase-cycle" aria-live="polite">
              {hero.phrases.map((phrase, index) => (
                <span
                  key={phrase}
                  className="phrase"
                  style={{ animationDelay: `${index * 3}s` }}
                >
                  {phrase}
                </span>
              ))}
            </div>
          ) : null}
          </div>
        </div>

        {/* Primary Media Layer (Video, Poster, or Fallback Graphic) */}
        {hasHeroMedia || adminDragEnabled || hasOverlayMedia ? (
          <div className="hero-media">
            {hasOverlayMedia ? (
              <div
                className={`hero-media-frame ${
                  adminDragEnabled && selectedHeroLayer === "overlay" ? "hero-media-editable" : ""
                }`}
                style={{
                  left: `${mobileOverlayLayout.x}%`,
                  top: `${mobileOverlayLayout.y}%`,
                  width: `${mobileOverlayLayout.width}%`,
                  height: `${mobileOverlayLayout.height}%`,
                  transform: `translate(-50%, -50%) rotate(${heroOverlayLayer.rotateDeg}deg) scale(${mobileOverlayScale})`,
                  opacity: heroOverlayLayer.opacity,
                  zIndex: heroOverlayLayer.zIndex,
                  pointerEvents: overlayMediaPointerEvents
                }}
              >
                <img
                  className="hero-media-image"
                  src={heroOverlayLayer.src}
                  alt=""
                  aria-hidden="true"
                  style={{ objectFit: heroOverlayLayer.fit }}
                />
              </div>
            ) : null}

            <div
              className={`hero-media-frame ${adminDragEnabled && selectedHeroLayer === "primary" ? "hero-media-editable" : ""}`}
              style={{
                left: `${mobilePrimaryLayout.x}%`,
                top: `${mobilePrimaryLayout.y}%`,
                width: `${mobilePrimaryLayout.width}%`,
                height: `${mobilePrimaryLayout.height}%`,
                transform: `translate(-50%, -50%) rotate(${heroPrimarySettings.rotateDeg}deg) scale(${mobilePrimaryScale})`,
                opacity: heroPrimarySettings.opacity,
                zIndex: heroPrimarySettings.zIndex,
                display: heroPrimarySettings.visible ? "block" : "none",
                pointerEvents: primaryMediaPointerEvents
              }}
            >
              {hero.video.src ? (
                <video
                  className="hero-video"
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster={hero.video.poster}
                  style={{ objectFit: heroPrimarySettings.fit }}
                >
                  <source src={hero.video.src} />
                </video>
              ) : (
                <img
                  className="hero-media-image"
                  src={hero.video.poster || "/hero-right-product.png"}
                  alt=""
                  aria-hidden="true"
                  style={{ objectFit: heroPrimarySettings.fit }}
                />
              )}
            </div>
          </div>
        ) : null}

        {ritualsVisible ? (
          <RitualFaceTeaser
            products={products}
            position={ritualRenderPos}
          />
        ) : null}
      </section>

      {lovedSectionVisible ? (
        <ProductScroller
          className="scroller-loved-for-a-reason"
          sectionStyle={{
            "--loved-divider-offset-y": `${lovedDividerOffsetY}px`,
            "--loved-floral-offset-y": `${lovedFloralOffsetY}px`,
            "--loved-floral-opacity": String(lovedFloralsVisible ? lovedFloralOpacity : 0),
            "--loved-tint-offset-x": `${lovedTintOffsetX}px`,
            "--loved-tint-offset-y": `${lovedTintOffsetY}px`,
            "--loved-tint-opacity": String(lovedWashVisible ? lovedTintOpacity : 0),
            "--loved-tint2-offset-x": `${lovedTint2OffsetX}px`,
            "--loved-tint2-offset-y": `${lovedTint2OffsetY}px`,
            "--loved-tint2-opacity": String(lovedBandVisible ? lovedTint2Opacity : 0),
            "--loved-tint2-top-pct": `${lovedTint2TopPct}%`,
            "--loved-tint2-height-pct": `${lovedTint2HeightPct}%`
          } as CSSProperties}
          title={carousel.title}
          subtitle={carousel.subtitle}
          items={carousel.slides.map((s) => {
            const product = products.find(p => p.name === s.label || p.id === s.id);
            return {
              label: s.label,
              description: s.description,
              image: s.image,
              color: s.color,
              href: `/product/${s.label.toLowerCase().replace(/\s+/g, "-")}`,
              product
            };
          })}
        />
      ) : null}

      <section className="instagram-section">
        <div className="scroller-header">
          <h2 className="scroller-title">From the Maroma World!</h2>
        </div>
        <div className="instagram-feed-container">
          <div className="elfsight-app-3e9b8508-c159-4052-be08-dcc0f7f5a278" data-elfsight-app-lazy></div>
        </div>
      </section>

      <div className="ticker-top-banner">
        <img src="/staging-media/banners/care-banner.png" alt="" aria-hidden="true" />
      </div>

      <section className="scrolling-ticker-section">
        <div className="ticker-wrap">
          <div className="ticker">
            <span className="ticker__item">
              Vegan and Cruelty-free • No rabbits (or any other living thing was harmed or in any way even slightly inconvenienced by the creation of our products) • World Fair Trade Certified - everyone gets paid a fair wage and treated with respect • Naturally derived • Almost entirely locally-sourced • Palm-Oil Free • Good For You • Good for the Planet •
            </span>
            <span className="ticker__item">
              Vegan and Cruelty-free • No rabbits (or any other living thing was harmed or in any way even slightly inconvenienced by the creation of our products) • World Fair Trade Certified - everyone gets paid a fair wage and treated with respect • Naturally derived • Almost entirely locally-sourced • Palm-Oil Free • Good For You • Good for the Planet •
            </span>
          </div>
        </div>
      </section>

      <section className="product-database" id="shop" style={{ scrollMarginTop: "100px" }} aria-label="Searchable product database">
        <div className="product-database-head">
          <div>
            <span className="eyebrow scroll-zoom">Shop database</span>
            <h2 className="scroll-zoom">Find Your Product Here</h2>
          </div>
          <label className="product-search">
            <span>Search products</span>
            <input
              type="search"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Try soap, lavender, shampoo..."
            />
          </label>
        </div>
        <p className="product-status">{productStatus}</p>
        <div className="product-listing-section">
          <ProductListingWithFilters products={products} />
        </div>
      </section>

      <footer className="footer">
        <strong>{brand}</strong>
        <div>Preview only. Replace placeholders with real media.</div>
      </footer>

      <div
        ref={floatingPanelRef}
        className={`floating-admin-toggle${floatingPanelMinimized ? " is-minimized" : ""}${isMobileViewport ? " is-mobile-controls" : ""}`}
        role="complementary"
        aria-label="Admin controls"
        onPointerDown={isMobileViewport ? undefined : handleFloatingPanelPointerDown}
        onPointerMove={isMobileViewport ? undefined : handleFloatingPanelPointerMove}
        onPointerUp={isMobileViewport ? undefined : handleFloatingPanelPointerUp}
        style={floatingPanelChromeStyle}
      >
        {floatingPanelMinimized ? (
          <button
            type="button"
            className="floating-admin-mini-btn"
            aria-label="Open admin controls"
            onClick={() => {
              setFloatingPanelMinimized(false);
              window.localStorage.setItem("maroma-floating-admin-minimized", "false");
            }}
          >
            Admin
          </button>
        ) : (
          <>
            <div className="floating-admin-head">
              <span className="floating-admin-label">
                {adminDragEnabled ? "Admin mode" : "Non-admin mode"}
              </span>
              <button
                type="button"
                className="floating-admin-collapse"
                aria-label="Minimize admin controls"
                onClick={() => {
                  setFloatingPanelMinimized(true);
                  window.localStorage.setItem("maroma-floating-admin-minimized", "true");
                }}
              >
                -
              </button>
            </div>
            <button
              type="button"
              className="button primary"
              style={{ width: "100%", marginBottom: "12px", background: saveStatus === "saved" ? "#10b981" : "" }}
              onClick={handleSaveAll}
              disabled={saveStatus === "saving"}
            >
              {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Changes Saved" : "SAVE ALL CHANGES"}
            </button>
            <button
              type="button"
              className="button secondary"
              style={{ width: "100%", marginBottom: "12px" }}
              onClick={handleCopyConfig}
            >
              COPY CONFIG JSON
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const next = !adminDragEnabled;
                setAdminDragEnabled(next);
                window.localStorage.setItem("maroma-admin-drag", next ? "true" : "false");
                window.dispatchEvent(new Event("maroma-admin-changed"));
              }}
            >
              Switch to {adminDragEnabled ? "Non-admin" : "Admin"}
            </button>

            <div className="floating-admin-grid">
              <span className="floating-admin-hint" style={{ color: "var(--soft-ink)", gridColumn: "1 / -1" }}>
                Bottom toolbar / floating panel (position & opacity — saved in this browser only).
              </span>
              <label>
                Panel opacity{" "}
                <input
                  type="range"
                  min={0.08}
                  max={1}
                  step={0.02}
                  value={floatingChrome.bgOpacity}
                  onChange={(e) =>
                    setFloatingChrome((prev) => ({
                      ...prev,
                      bgOpacity: Number(e.target.value)
                    }))
                  }
                />{" "}
                <span>{floatingChrome.bgOpacity.toFixed(2)}</span>
              </label>
              <label>
                Bottom offset{" "}
                <input
                  type="range"
                  min={0}
                  max={160}
                  step={1}
                  value={floatingChrome.bottomPx}
                  onChange={(e) =>
                    setFloatingChrome((prev) => ({
                      ...prev,
                      bottomPx: Math.round(Number(e.target.value))
                    }))
                  }
                />{" "}
                <span>{floatingChrome.bottomPx}px</span>
              </label>
              <label>
                Side inset{" "}
                <input
                  type="range"
                  min={0}
                  max={56}
                  step={1}
                  value={floatingChrome.sideInsetPx}
                  onChange={(e) =>
                    setFloatingChrome((prev) => ({
                      ...prev,
                      sideInsetPx: Math.round(Number(e.target.value))
                    }))
                  }
                />{" "}
                <span>{floatingChrome.sideInsetPx}px</span>
              </label>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  const next = { ...defaultFloatingChrome };
                  setFloatingChrome(next);
                  try {
                    window.localStorage.setItem(FLOATING_ADMIN_CHROME_KEY, JSON.stringify(next));
                  } catch {
                    // ignore
                  }
                }}
              >
                Reset panel chrome
              </button>
            </div>

            {adminDragEnabled ? (
              <>
            <label className="floating-admin-upload">
              Upload image/video for selected media layer
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleHeroMediaUpload}
              />
            </label>

            {/* Loved veil controls moved into Select Layer dropdown (Layer 1/2/3). */}

            <div className="floating-admin-grid">
              <label className="floating-admin-select-group">
                Select Layer
                <select
                  value={adminEditLayer}
                  onChange={(e) => {
                    const next = e.target.value as AdminLayerId;
                    setAdminEditLayer(next);
                    if (next === "primary" || next === "overlay") {
                      setSelectedHeroLayer(next);
                    }
                  }}
                >
                  <option value="primary">Primary Media</option>
                  <option value="overlay">Overlay Media</option>
                  <option value="background">Background (gradient)</option>
                  <option value="headline">Headline</option>
                  <option value="eyebrow">Eyebrow</option>
                  <option value="actions">Hero actions row</option>
                  <option value="rituals">Ritual carousel</option>
                  <option value="loved-section">Loved section (position)</option>
                  <option value="loved-florals">Layer 1 — Loved florals</option>
                  <option value="loved-wash">Layer 2 — Loved wash veil</option>
                  <option value="loved-band">Layer 3 — Loved band veil</option>
                </select>
              </label>
            </div>

            {/* Focused Controls for Selected Layer */}
            <div className="floating-admin-grid">
              {adminEditLayer === "background" && (
                <>
                  <label>
                    Visible{" "}
                    <input
                      type="checkbox"
                      checked={backgroundVisible}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setBackgroundVisible(next);
                        void persistHeroVisualPatch({ backgroundVisible: next });
                      }}
                    />
                  </label>
                  <label>
                    X{" "}
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={0.1}
                      value={heroLayout.x}
                      onChange={(e) => {
                        const next = { ...heroLayout, x: Number(e.target.value) };
                        setHeroLayout(next);
                        void persistHeroVisualPatch({ heroLayout: next });
                      }}
                    />{" "}
                    <span>{heroLayout.x.toFixed(1)}vw</span>
                  </label>
                  <label>
                    Y{" "}
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={0.1}
                      value={heroLayout.y}
                      onChange={(e) => {
                        const next = { ...heroLayout, y: Number(e.target.value) };
                        setHeroLayout(next);
                        void persistHeroVisualPatch({ heroLayout: next });
                      }}
                    />{" "}
                    <span>{heroLayout.y.toFixed(1)}vh</span>
                  </label>
                  <span className="floating-admin-hint" style={{ gridColumn: "1 / -1", fontSize: "0.74rem" }}>
                    (Only X/Y are shown now. Gradient colors/size moved out for clarity.)
                  </span>
                </>
              )}
              {adminEditLayer === "primary" && (
                <>
                  <label>
                    Visible{" "}
                    <input
                      type="checkbox"
                      checked={heroPrimarySettings.visible}
                      onChange={(e) =>
                        setPrimarySettingsAndSave({
                          ...heroPrimarySettings,
                          visible: e.target.checked
                        })
                      }
                    />
                  </label>
                  <label>
                    X{" "}
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={0.1}
                      value={heroMediaLayout.x}
                      onChange={(e) => setHeroMediaLayoutAndSave({ ...heroMediaLayout, x: Number(e.target.value) })}
                    />{" "}
                    <span>{heroMediaLayout.x.toFixed(1)}%</span>
                  </label>
                  <label>
                    Y{" "}
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={0.1}
                      value={heroMediaLayout.y}
                      onChange={(e) => setHeroMediaLayoutAndSave({ ...heroMediaLayout, y: Number(e.target.value) })}
                    />{" "}
                    <span>{heroMediaLayout.y.toFixed(1)}%</span>
                  </label>
                  <label>
                    Opacity{" "}
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={heroPrimarySettings.opacity}
                      onChange={(e) =>
                        setPrimarySettingsAndSave({
                          ...heroPrimarySettings,
                          opacity: Number(e.target.value)
                        })
                      }
                    />{" "}
                    <span>{heroPrimarySettings.opacity.toFixed(2)}</span>
                  </label>
                </>
              )}
              {adminEditLayer === "overlay" && (
                <>
                  <label>
                    Visible{" "}
                    <input
                      type="checkbox"
                      checked={heroOverlayLayer.visible}
                      onChange={(e) =>
                        setOverlayLayerAndSave({
                          ...heroOverlayLayer,
                          visible: e.target.checked
                        })
                      }
                    />
                  </label>
                  <label>
                    X{" "}
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={0.1}
                      value={heroOverlayLayer.layout.x}
                      onChange={(e) =>
                        setOverlayLayerAndSave({
                          ...heroOverlayLayer,
                          layout: { ...heroOverlayLayer.layout, x: Number(e.target.value) }
                        })
                      }
                    />{" "}
                    <span>{heroOverlayLayer.layout.x.toFixed(1)}%</span>
                  </label>
                  <label>
                    Y{" "}
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={0.1}
                      value={heroOverlayLayer.layout.y}
                      onChange={(e) =>
                        setOverlayLayerAndSave({
                          ...heroOverlayLayer,
                          layout: { ...heroOverlayLayer.layout, y: Number(e.target.value) }
                        })
                      }
                    />{" "}
                    <span>{heroOverlayLayer.layout.y.toFixed(1)}%</span>
                  </label>
                  <label>
                    Opacity{" "}
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={heroOverlayLayer.opacity}
                      onChange={(e) =>
                        setOverlayLayerAndSave({
                          ...heroOverlayLayer,
                          opacity: Number(e.target.value)
                        })
                      }
                    />{" "}
                    <span>{heroOverlayLayer.opacity.toFixed(2)}</span>
                  </label>
                </>
              )}
              {adminEditLayer === "headline" && (
                <>
                  <label>
                    Visible{" "}
                    <input
                      type="checkbox"
                      checked={headlineVisible}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setHeadlineVisible(next);
                        void persistHeroVisualPatch({ headlineVisible: next });
                      }}
                    />
                  </label>
                  <label>X <input type="range" min={-1000} max={1000} step={1} value={headlinePos.x} onChange={e => { const next = {...headlinePos, x: Number(e.target.value)}; setHeadlinePos(next); void persistHeroVisualPatch({headlinePos: next}); }} /> <span>{headlinePos.x}px</span></label>
                  <label>Y <input type="range" min={-1000} max={1000} step={1} value={headlinePos.y} onChange={e => { const next = {...headlinePos, y: Number(e.target.value)}; setHeadlinePos(next); void persistHeroVisualPatch({headlinePos: next}); }} /> <span>{headlinePos.y}px</span></label>
                  <span className="floating-admin-hint" style={{ gridColumn: "1 / -1", fontSize: "0.74rem" }}>
                    (Opacity control for headline can be added next if you want; keeping this pass to X/Y/Opacity only where it already exists.)
                  </span>
                </>
              )}
              {adminEditLayer === "eyebrow" && (
                <>
                  <label>
                    Visible{" "}
                    <input
                      type="checkbox"
                      checked={eyebrowVisible}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setEyebrowVisible(next);
                        void persistHeroVisualPatch({ eyebrowVisible: next });
                      }}
                    />
                  </label>
                  <label>X <input type="range" min={-1000} max={1000} step={1} value={eyebrowPos.x} onChange={e => setEyebrowXFromPx(Number(e.target.value))} /> <span>{Math.round(eyebrowPos.x)}px</span></label>
                  <label>Y <input type="range" min={-1000} max={1000} step={1} value={eyebrowPos.y} onChange={e => setEyebrowYFromPx(Number(e.target.value))} /> <span>{Math.round(eyebrowPos.y)}px</span></label>
                </>
              )}
              {adminEditLayer === "actions" && (
                <>
                  <label>
                    Visible{" "}
                    <input
                      type="checkbox"
                      checked={actionsVisible}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setActionsVisible(next);
                        void persistHeroVisualPatch({ actionsVisible: next });
                      }}
                    />
                  </label>
                  <label>X <input type="range" min={-1000} max={1000} step={1} value={heroActionsPos.x} onChange={e => { const next = {...heroActionsPos, x: Number(e.target.value)}; setHeroActionsPos(next); void persistHeroVisualPatch({heroActionsPos: next}); }} /> <span>{heroActionsPos.x}px</span></label>
                  <label>Y <input type="range" min={-1000} max={1000} step={1} value={heroActionsPos.y} onChange={e => { const next = {...heroActionsPos, y: Number(e.target.value)}; setHeroActionsPos(next); void persistHeroVisualPatch({heroActionsPos: next}); }} /> <span>{heroActionsPos.y}px</span></label>
                </>
              )}

              {adminEditLayer === "rituals" && (
                <>
                  <label>
                    Visible{" "}
                    <input
                      type="checkbox"
                      checked={ritualsVisible}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setRitualsVisible(next);
                        void persistHeroVisualPatch({ ritualsVisible: next });
                      }}
                    />
                  </label>
                  <label>X <input type="range" min={-1000} max={1000} step={1} value={ritualCarouselPos?.x ?? 0} onChange={e => { const next = { x: Number(e.target.value), y: ritualCarouselPos?.y ?? 0 }; setRitualCarouselPos(next); void persistHeroVisualPatch({ ritualCarouselPos: next }); }} /> <span>{ritualCarouselPos?.x ?? 0}px</span></label>
                  <label>Y <input type="range" min={-1000} max={1000} step={1} value={ritualCarouselPos?.y ?? 0} onChange={e => { const next = { x: ritualCarouselPos?.x ?? 0, y: Number(e.target.value) }; setRitualCarouselPos(next); void persistHeroVisualPatch({ ritualCarouselPos: next }); }} /> <span>{ritualCarouselPos?.y ?? 0}px</span></label>
                </>
              )}
              {adminEditLayer === "loved-section" && (
                <>
                  <label>
                    Visible{" "}
                    <input
                      type="checkbox"
                      checked={lovedSectionVisible}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setLovedSectionVisible(next);
                        void persistHeroVisualPatch({ lovedSectionVisible: next });
                      }}
                    />
                  </label>
                  <label>
                    Y{" "}
                    <input
                      type="range"
                      min={-500}
                      max={500}
                      step={1}
                      value={lovedDividerOffsetY}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setLovedDividerOffsetY(next);
                        void persistHeroVisualPatch({ lovedDividerOffsetY: next });
                      }}
                    />{" "}
                    <span>{lovedDividerOffsetY}px</span>
                  </label>
                </>
              )}
              {adminEditLayer === "loved-florals" && (
                <>
                  <label>
                    Visible{" "}
                    <input
                      type="checkbox"
                      checked={lovedFloralsVisible}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setLovedFloralsVisible(next);
                        void persistHeroVisualPatch({ lovedFloralsVisible: next });
                      }}
                    />
                  </label>
                  <label>
                    Y{" "}
                    <input
                      type="range"
                      min={-500}
                      max={500}
                      step={1}
                      value={lovedFloralOffsetY}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setLovedFloralOffsetY(next);
                        void persistHeroVisualPatch({ lovedFloralOffsetY: next });
                      }}
                    />{" "}
                    <span>{lovedFloralOffsetY}px</span>
                  </label>
                  <label>
                    Opacity{" "}
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={lovedFloralOpacity}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setLovedFloralOpacity(next);
                        void persistHeroVisualPatch({ lovedFloralOpacity: next });
                      }}
                    />{" "}
                    <span>{lovedFloralOpacity.toFixed(2)}</span>
                  </label>
                </>
              )}
              {adminEditLayer === "loved-wash" && (
                <>
                  <label>
                    Visible{" "}
                    <input
                      type="checkbox"
                      checked={lovedWashVisible}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setLovedWashVisible(next);
                        void persistHeroVisualPatch({ lovedWashVisible: next });
                      }}
                    />
                  </label>
                  <label>
                    X{" "}
                    <input
                      type="range"
                      min={-500}
                      max={500}
                      step={1}
                      value={lovedTintOffsetX}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setLovedTintOffsetX(next);
                        void persistHeroVisualPatch({ lovedTintOffsetX: next });
                      }}
                    />{" "}
                    <span>{lovedTintOffsetX}px</span>
                  </label>
                  <label>
                    Y{" "}
                    <input
                      type="range"
                      min={-500}
                      max={500}
                      step={1}
                      value={lovedTintOffsetY}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setLovedTintOffsetY(next);
                        void persistHeroVisualPatch({ lovedTintOffsetY: next });
                      }}
                    />{" "}
                    <span>{lovedTintOffsetY}px</span>
                  </label>
                  <label>
                    Opacity{" "}
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={lovedTintOpacity}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setLovedTintOpacity(next);
                        void persistHeroVisualPatch({ lovedTintOpacity: next });
                      }}
                    />{" "}
                    <span>{lovedTintOpacity.toFixed(2)}</span>
                  </label>
                </>
              )}
              {adminEditLayer === "loved-band" && (
                <>
                  <label>
                    Visible{" "}
                    <input
                      type="checkbox"
                      checked={lovedBandVisible}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setLovedBandVisible(next);
                        void persistHeroVisualPatch({ lovedBandVisible: next });
                      }}
                    />
                  </label>
                  <label>
                    X{" "}
                    <input
                      type="range"
                      min={-500}
                      max={500}
                      step={1}
                      value={lovedTint2OffsetX}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setLovedTint2OffsetX(next);
                        void persistHeroVisualPatch({ lovedTint2OffsetX: next });
                      }}
                    />{" "}
                    <span>{lovedTint2OffsetX}px</span>
                  </label>
                  <label>
                    Y{" "}
                    <input
                      type="range"
                      min={-500}
                      max={500}
                      step={1}
                      value={lovedTint2OffsetY}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setLovedTint2OffsetY(next);
                        void persistHeroVisualPatch({ lovedTint2OffsetY: next });
                      }}
                    />{" "}
                    <span>{lovedTint2OffsetY}px</span>
                  </label>
                  <label>
                    Opacity{" "}
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={lovedTint2Opacity}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setLovedTint2Opacity(next);
                        void persistHeroVisualPatch({ lovedTint2Opacity: next });
                      }}
                    />{" "}
                    <span>{lovedTint2Opacity.toFixed(2)}</span>
                  </label>
                </>
              )}
            </div>

              </>
            ) : null}
            <a href="/admin" className="floating-admin-link">
              Open Admin Page
            </a>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const reset = { x: 0, y: 0 };
                setFloatingPanelPos(reset);
                window.localStorage.setItem("maroma-floating-admin-pos", JSON.stringify(reset));
              }}
            >
              Reset panel position
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const reset = { x: 0, y: 0 };
                setRitualCarouselPos(reset);
                clearSavedVisualPositions();
                void persistHeroVisualPatch({ ritualCarouselPos: reset });
              }}

            >
              Reset carousel position
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const reset = { x: 0, y: 0 };
                setEyebrowPos(reset);
                clearSavedVisualPositions();
                void persistHeroVisualPatch({ eyebrowPos: reset });
              }}
            >
              Clear saved eyebrow position
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const reset = { x: 0, y: 0 };
                setRitualCarouselPos(reset);
                clearSavedVisualPositions();
                void persistHeroVisualPatch({ ritualCarouselPos: reset });
              }}
            >
              Clear saved carousel position
            </button>
          </>
        )}
      </div>
    </div>
  );
}
