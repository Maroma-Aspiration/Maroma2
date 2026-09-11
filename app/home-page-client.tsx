"use client";

import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { HomePageBelowFold } from "./components/HomePageBelowFold";
import { HomeCollections } from "./components/HomeCollections";
import { HeroPromoBanner } from "./components/PromoBannerStrip";
import { HomepagePromoQuickEditor } from "./components/HomepagePromoQuickEditor";
import { HeroVideoMedia } from "./components/HeroVideoMedia";
import { isYouTubeUrl } from "../lib/youtube-embed";
import { MobilePreviewFrame } from "./components/MobilePreviewFrame";
import { RitualFaceTeaser } from "./components/RitualFaceTeaser";
import { SiteHeader } from "./components/SiteHeader";
import { SignOutButton } from "./components/SignOutButton";
import type { CategoryBannerStore } from "../lib/category-banner-types";
import type { ProductRecord } from "../lib/product-types";
import type { PromoBanner } from "../lib/promo-types";
import {
  normalizePromoStripFields,
  PROMO_STRIP_DEFAULTS,
  PROMO_STRIP_ASPECT_21_9,
  PROMO_STRIP_HEIGHT_MAX,
  PROMO_STRIP_HEIGHT_MIN,
  PROMO_STRIP_POSITION_CM_MIN,
  PROMO_STRIP_POSITION_CM_MAX,
  PROMO_STRIP_POSITION_PX_MIN,
  PROMO_STRIP_POSITION_PX_MAX,
  promoStripHidesHeroPrimary,
  isPromoModeEnabled,
} from "../lib/promo-strip-utils";
import {
  PROMO_PREVIEW_MESSAGE,
  readPromoPreviewPayload,
} from "../lib/promo-preview-storage";
import { isAdminUiHidden } from "../lib/admin-ui-visible";
import { useAdminSession, setAdminDragPreference, ADMIN_DRAG_STORAGE_KEY } from "../lib/use-admin-session";
import {
  getMaromaDesktopLikePointer,
  getMaromaForceMobileLayout,
  getMaromaMobileViewportMatches,
  getMaromaNarrowViewportMatches,
  subscribeMaromaDesktopLikePointer,
  subscribeMaromaForceMobileLayout,
  subscribeMaromaMobileViewport,
  subscribeMaromaNarrowViewport,
} from "../lib/mobile-viewport";
import { RITUAL_TEASER_POS_STORAGE_KEY } from "../lib/ritual-teaser-pos";
import {
  VISUAL_STATE_STORAGE_KEY,
  type HeroMobileOverrides,
  type HeroVisualState
} from "../lib/hero-media-layout-types";
import {
  deriveMobileFromDesktop,
  deriveMobileHeadlineSizeRem,
} from "../lib/derive-mobile-from-desktop";
import { buildMobilePersistenceSnapshot, MOBILE_DESIGN_WIDTH_PX } from "../lib/mobile-design-snapshot";
import { mergeHeroMobileOverrides, resolveHeroMobileLayout, clampMobileRitualBandLayout } from "../lib/hero-mobile-layout";
import { readHeroVisualLocalBackup, writeHeroVisualLocalBackup } from "../lib/hero-visual-local-backup";
import { getVisualStateUpdatedAt, mergeHeroVisualStates } from "../lib/hero-visual-state-merge";
import { requestShopScroll, SCROLL_TO_SHOP_EVENT } from "../lib/scroll-to-shop";
import { parseHeroVisualState } from "../lib/hero-visual-state-parse";
import { heroNudgeStyle } from "../lib/hero-visual-css";
import {
  HERO_RITUAL_BAND_DEFAULT_LAYOUT,
  HERO_RITUAL_DEFAULT_POS_PCT,
  LOVED_HANDOFF_OFFSET_Y_PX,
  ritualCarouselPxToPct,
  MOBILE_RITUAL_REF_CARD_PX,
  MOBILE_RITUAL_STACK_REF_HEIGHT_PX,
  mobileRitualBandHeightPx,
  mobileRitualBandYOffsetPx,
} from "../lib/hero-artboard";
import {
  clampHeroLayerDepth,
  HERO_LAYER_DEPTH_MAX,
  HERO_LAYER_DEPTH_MIN,
  lovedStackZToPaintZ,
  normalizeRitualStackZ,
  RITUAL_CAROUSEL_STACK_REV,
} from "../lib/hero-layer-depth";
import {
  pageShellStackCssVars,
  resolveLovedOverlapPaintZ,
  resolvePageShellPaintZ,
} from "../lib/page-layer-stack";
import { contentStorageKey, siteContent, type SiteContent } from "./content";
import { mergeWithDefaults } from "../lib/site-content-api";
import { getDisplayImageUrl } from "../lib/product-image";

/** Mobile hero: one phrase per line (e.g. BOTANICAL. / ETHICAL. / ESSENTIAL.) */
function formatHeadlineForMobileStack(headline: string): string {
  const phrases = headline
    .split(/\.\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (phrases.length <= 1) return headline;
  return phrases.map((part) => (part.endsWith(".") ? part : `${part}.`)).join("\n");
}

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
  heroPromoBannerTopCm?: number;
  heroPromoBannerPos?: { x: number; y: number };
  heroPromoBannerWidthPct?: number;
  heroMarqueeStartOffsetCm?: number;
  heroMarqueeStartOffsetPx?: number;
  heroMarqueeEndOffsetCm?: number;
  heroMarqueeEndOffsetPx?: number;
  heroCopyWidthVw?: number;
  primarySettings?: HeroLayerSettings;
  overlayLayer?: HeroOverlayLayer;
  heroLayout?: HeroMediaLayout;
  productShowcasePos?: { x: number; y: number };
  ritualCarouselPos?: { x: number; y: number };
  ritualCarouselPosPct?: { x: number; y: number };
  bgColors?: string[];
  bgAngle?: number;
  lovedSectionVisible?: boolean;
  lovedFloralsVisible?: boolean;
  lovedWashVisible?: boolean;
  lovedBandVisible?: boolean;
  lovedDividerOffsetY?: number;
  lovedFlowOffsetPx?: number;
  lovedPositionCustomized?: boolean;
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
  lovedTint2WidthPct?: number;
  lovedTint2LeftPct?: number;
  heroSectionHeight?: number;
  heroBackgroundStackZ?: number;
  heroMediaStackZ?: number;
  heroRitualStackZ?: number;
  heroRitualBandStackZ?: number;
  ritualBandVisible?: boolean;
  ritualBandVisibleMobile?: boolean;
  ritualBandLayout?: HeroMediaLayout;
  ritualBandScale?: number;
  ritualBandOpacity?: number;
  ritualBandColor?: string;
  ritualCarouselScale?: number;
  heroCopyStackZ?: number;
  heroPromoStackZ?: number;
  lovedFloralsStackZ?: number;
  lovedWashStackZ?: number;
  lovedBandStackZ?: number;
  lovedContentStackZ?: number;
  heroCopyOffsetY?: string;
  mobile?: HeroMobileOverrides;
  updatedAt?: number;
  ritualCarouselStackRev?: number;
  error?: string;
};

type HomePageClientProps = {
  initialHeroVisual: HeroVisualState;
  initialSiteContent: SiteContent;
  initialPromoBanners?: PromoBanner[];
  initialCategoryBanners?: CategoryBannerStore;
  initialViewportIsMobile?: boolean;
  initialSkipIntro?: boolean;
  initialPromoPreview?: boolean;
  initialProductSearch?: string;
};

function createHomepagePromoDraft(): PromoBanner {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    adminName: "Homepage promo",
    title: "A beautiful seasonal offer",
    body: "Discover botanical care, made with purpose.",
    mediaUrl: "",
    mediaKind: "none",
    animation: "fade",
    animateEnabled: true,
    headlineAnimation: "none",
    headlineAnimationDurationMs: 2400,
    taglineAnimation: "none",
    taglineAnimationDurationMs: 2400,
    ctaLabel: "Shop the offer",
    ctaHref: "/face-care",
    ctaStyle: "magical",
    ctaBuyLinks: [],
    presentation: "static",
    sequenceTransition: "crossfade",
    sequenceLoop: true,
    frames: [],
    stripBackground: "#134a57",
    stripBackgroundGradient: "linear-gradient(135deg,#083f55 0%,#1688a3 45%,#efc85d 100%)",
    stripBackgroundImageUrl: "",
    stripBackgroundMediaKind: "none",
    stripBackgroundVideoLoop: false,
    stripBackgroundFallbackImageUrl: "",
    stripBackgroundImageScale: 100,
    stripBackgroundImageOffsetX: 50,
    stripBackgroundImageOffsetY: 50,
    stripHeightPx: 430,
    stripPositionOffsetCm: 0,
    stripPositionOffsetPx: 0,
    stripAspectRatio: "fixed",
    stripOpacity: 1,
    overlayImageX: 50,
    overlayImageY: 48,
    overlayImageScale: 75,
    overlayImageRadius: 18,
    overlayImageShadow: true,
    ctaOffsetX: 0,
    ctaOffsetY: 0,
    thumbnailOffsetX: 0,
    thumbnailOffsetY: 0,
    startsAt: "",
    endsAt: "",
    active: true,
    promoModeEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

const FLOATING_ADMIN_CHROME_KEY = "maroma-floating-admin-chrome";
const ADMIN_DEVICE_PREVIEW_KEY = "maroma-admin-device-preview";
const RITUAL_STACK_BASELINE_KEY = "maroma-ritual-stack-baseline-v3";

type AdminDevicePreview = "desktop" | "mobile";

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

export default function HomePageClient({
  initialHeroVisual,
  initialSiteContent,
  initialPromoBanners = [],
  initialCategoryBanners,
  initialViewportIsMobile = false,
  initialSkipIntro = false,
  initialPromoPreview = false,
  initialProductSearch = "",
}: HomePageClientProps) {
  const [introPhase, setIntroPhase] = useState<"playing" | "fading" | "skip-fading" | "done">(
    initialSkipIntro || initialPromoPreview ? "done" : "playing"
  );
  const [introVideoReady, setIntroVideoReady] = useState(false);
  const introFinishTimerRef = useRef<number | null>(null);
  const introScrollRevealRef = useRef(0);
  const introScrollHoldRef = useRef(0);
  const [content, setContent] = useState<SiteContent>(initialSiteContent);
  const [livePromoBanners, setLivePromoBanners] = useState<PromoBanner[]>(() => {
    if (initialPromoPreview && typeof window !== "undefined") {
      const payload = readPromoPreviewPayload();
      if (payload?.banners?.length) return payload.banners;
    }
    return initialPromoBanners;
  });
  const [promoEditorOpen, setPromoEditorOpen] = useState(false);
  const [promoEditorBanners, setPromoEditorBanners] = useState<PromoBanner[]>([]);
  const [promoEditorModeOverride, setPromoEditorModeOverride] = useState<boolean | null>(null);
  const [promoEditorStatus, setPromoEditorStatus] = useState("");
  const [promoPublishSucceeded, setPromoPublishSucceeded] = useState(false);
  const livePromoBannersRef = useRef(livePromoBanners);
  livePromoBannersRef.current = livePromoBanners;
  const promoPatchTimerRef = useRef<number | null>(null);

  const refreshPromoEditor = useCallback(async () => {
    const res = await fetch("/api/promos?admin=1", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) throw new Error("Unable to load promo controls.");
    const data = (await res.json()) as { banners?: PromoBanner[] };
    const banners = data.banners ?? [];
    setPromoEditorBanners(banners);
    return banners;
  }, []);

  const openPromoEditor = useCallback(async () => {
    setPromoEditorStatus("Loading promo controls…");
    try {
      const banners = await refreshPromoEditor();
      const source = banners[0] ?? livePromoBannersRef.current[0] ?? createHomepagePromoDraft();
      const editorBanner: PromoBanner = {
        ...source,
        presentation: "static",
        animation: source.animation === "marquee" ? "fade" : source.animation,
      };
      setPromoEditorBanners([editorBanner, ...banners.filter((item) => item.id !== editorBanner.id)]);
      setPromoEditorModeOverride(editorBanner.promoModeEnabled !== false);
      livePromoBannersRef.current = [
        editorBanner,
        ...livePromoBannersRef.current.filter((item) => item.id !== editorBanner.id),
      ];
      setLivePromoBanners(livePromoBannersRef.current);
      setPromoEditorOpen(true);
      setPromoEditorStatus("");
    } catch (error) {
      setPromoEditorStatus(error instanceof Error ? error.message : "Unable to load promo controls.");
    }
  }, [refreshPromoEditor]);

  const applyPromoEditorPreview = useCallback((banner: PromoBanner) => {
    setPromoEditorBanners((current) => [banner, ...current.filter((item) => item.id !== banner.id)]);
    livePromoBannersRef.current = [
      banner,
      ...livePromoBannersRef.current.filter((item) => item.id !== banner.id),
    ];
    setLivePromoBanners(livePromoBannersRef.current);
  }, []);

  const refreshLivePromoBanners = useCallback(async () => {
    const res = await fetch("/api/promos", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return;
    const data = (await res.json()) as { banners?: PromoBanner[] };
    if (data.banners) {
      livePromoBannersRef.current = data.banners;
      setLivePromoBanners(data.banners);
    }
  }, []);
  const [marqueePreviewMode, setMarqueePreviewMode] = useState<"start" | "end">("start");
  const [heroMarqueeStartOffsetCm, setHeroMarqueeStartOffsetCm] = useState(
    initialHeroVisual.heroMarqueeStartOffsetCm ??
      initialPromoBanners[0]?.heroMarqueeStartOffsetCm ??
      PROMO_STRIP_DEFAULTS.heroMarqueeStartOffsetCm
  );
  const [heroMarqueeStartOffsetPx, setHeroMarqueeStartOffsetPx] = useState(
    initialHeroVisual.heroMarqueeStartOffsetPx ??
      initialPromoBanners[0]?.heroMarqueeStartOffsetPx ??
      PROMO_STRIP_DEFAULTS.heroMarqueeStartOffsetPx
  );
  const [heroMarqueeEndOffsetCm, setHeroMarqueeEndOffsetCm] = useState(
    initialHeroVisual.heroMarqueeEndOffsetCm ??
      initialPromoBanners[0]?.heroMarqueeEndOffsetCm ??
      PROMO_STRIP_DEFAULTS.heroMarqueeEndOffsetCm
  );
  const [heroMarqueeEndOffsetPx, setHeroMarqueeEndOffsetPx] = useState(
    initialHeroVisual.heroMarqueeEndOffsetPx ??
      initialPromoBanners[0]?.heroMarqueeEndOffsetPx ??
      PROMO_STRIP_DEFAULTS.heroMarqueeEndOffsetPx
  );

  useEffect(() => {
    if (initialPromoPreview || promoEditorOpen) return;
    setLivePromoBanners((current) => {
      const local = current[0];
      const incoming = initialPromoBanners[0];
      if (
        local &&
        incoming &&
        local.id === incoming.id &&
        local.updatedAt &&
        incoming.updatedAt &&
        Date.parse(local.updatedAt) > Date.parse(incoming.updatedAt)
      ) {
        return current;
      }
      return initialPromoBanners;
    });
  }, [initialPromoBanners, initialPromoPreview, promoEditorOpen]);

  useEffect(() => {
    if (!initialPromoPreview) return undefined;

    document.documentElement.classList.add("is-promo-preview");

    const applyPreviewBanners = () => {
      const payload = readPromoPreviewPayload();
      if (payload?.banners?.length) {
        setLivePromoBanners(payload.banners);
      }
    };

    applyPreviewBanners();

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== PROMO_PREVIEW_MESSAGE) return;
      if (Array.isArray(event.data.banners) && event.data.banners.length > 0) {
        setLivePromoBanners(event.data.banners);
        return;
      }
      applyPreviewBanners();
    };

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "maroma:promo-preview-ready" }, window.location.origin);

    return () => {
      document.documentElement.classList.remove("is-promo-preview");
      window.removeEventListener("message", onMessage);
    };
  }, [initialPromoPreview]);
  const [heroLayout, setHeroLayout] = useState<HeroMediaLayout>(initialHeroVisual.heroLayout || { x: 0, y: 0, width: 100, height: 80 });
  const [headlinePos, setHeadlinePos] = useState(initialHeroVisual.headlinePos);
  const [headlineSizeRem, setHeadlineSizeRem] = useState(initialHeroVisual.headlineSizeRem);
  const [heroActionsPos, setHeroActionsPos] = useState(initialHeroVisual.heroActionsPos);
  const [heroPromoBannerTopCm, setHeroPromoBannerTopCm] = useState(
    initialHeroVisual.heroPromoBannerTopCm
  );
  const [heroPromoBannerPos, setHeroPromoBannerPos] = useState(initialHeroVisual.heroPromoBannerPos);
  const [heroPromoBannerWidthPct, setHeroPromoBannerWidthPct] = useState(
    initialHeroVisual.heroPromoBannerWidthPct
  );
  const [ritualCarouselPos, setRitualCarouselPos] = useState(initialHeroVisual.ritualCarouselPos);
  const [ritualCarouselPosPct, setRitualCarouselPosPct] = useState(
    initialHeroVisual.ritualCarouselPosPct ?? HERO_RITUAL_DEFAULT_POS_PCT
  );

  const [eyebrowPos, setEyebrowPos] = useState(initialHeroVisual.eyebrowPos);
  const [heroCopyWidthVw, setHeroCopyWidthVw] = useState(initialHeroVisual.heroCopyWidthVw);
  const [heroMediaLayout, setHeroMediaLayout] = useState<HeroMediaLayout>(initialHeroVisual.layout);
  const [backgroundVisible, setBackgroundVisible] = useState<boolean>(initialHeroVisual.backgroundVisible ?? true);
  const [headlineVisible, setHeadlineVisible] = useState<boolean>(initialHeroVisual.headlineVisible ?? true);
  const [eyebrowVisible, setEyebrowVisible] = useState<boolean>(initialHeroVisual.eyebrowVisible ?? true);
  const [actionsVisible, setActionsVisible] = useState<boolean>(initialHeroVisual.actionsVisible ?? true);
  const [ritualsVisible, setRitualsVisible] = useState<boolean>(false);
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
  const [adminDragEnabled, setAdminDragEnabled] = useState(false);
  const { isAdminUser, sessionReady, refreshSession } = useAdminSession();
  const showFloatingAdmin = sessionReady && isAdminUser && !isAdminUiHidden() && !initialPromoPreview;

  useEffect(() => {
    if (!sessionReady || !isAdminUser || initialPromoPreview) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("openPromoEditor") !== "1") return;
    params.delete("openPromoEditor");
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    void openPromoEditor();
  }, [initialPromoPreview, isAdminUser, openPromoEditor, sessionReady]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [bgColors, setBgColors] = useState<string[]>(initialHeroVisual.bgColors || ["#dbe3d0", "#cbd5c0", "#d6deca"]);
  const [bgAngle, setBgAngle] = useState<number>(initialHeroVisual.bgAngle || 135);
  const [lovedSectionVisible, setLovedSectionVisible] = useState<boolean>(initialHeroVisual.lovedSectionVisible ?? true);
  const [lovedFloralsVisible, setLovedFloralsVisible] = useState<boolean>(initialHeroVisual.lovedFloralsVisible ?? true);
  const [lovedWashVisible, setLovedWashVisible] = useState<boolean>(initialHeroVisual.lovedWashVisible ?? true);
  const [lovedBandVisible, setLovedBandVisible] = useState<boolean>(initialHeroVisual.lovedBandVisible ?? true);
  const [lovedDividerOffsetY, setLovedDividerOffsetY] = useState<number>(initialHeroVisual.lovedDividerOffsetY);
  const [lovedFlowOffsetPx, setLovedFlowOffsetPx] = useState<number>(
    typeof initialHeroVisual.lovedFlowOffsetPx === "number" ? initialHeroVisual.lovedFlowOffsetPx : -160
  );
  const lovedDividerOffsetRef = useRef(lovedDividerOffsetY);
  const lovedFlowOffsetRef = useRef(lovedFlowOffsetPx);
  const lovedPositionCustomizedRef = useRef(Boolean(initialHeroVisual.lovedPositionCustomized));
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
    typeof initialHeroVisual.lovedTint2TopPct === "number" ? initialHeroVisual.lovedTint2TopPct : 12
  );
  const [lovedTint2HeightPct, setLovedTint2HeightPct] = useState<number>(
    typeof initialHeroVisual.lovedTint2HeightPct === "number" ? initialHeroVisual.lovedTint2HeightPct : 28
  );
  const [lovedTint2WidthPct, setLovedTint2WidthPct] = useState<number>(
    typeof initialHeroVisual.lovedTint2WidthPct === "number" ? initialHeroVisual.lovedTint2WidthPct : 100
  );
  const [lovedTint2LeftPct, setLovedTint2LeftPct] = useState<number>(
    typeof initialHeroVisual.lovedTint2LeftPct === "number" ? initialHeroVisual.lovedTint2LeftPct : 0
  );
  const [productShowcasePos, setProductShowcasePos] = useState(initialHeroVisual.productShowcasePos || { x: 0, y: 0 });
  const [heroSectionHeight, setHeroSectionHeight] = useState(initialHeroVisual.heroSectionHeight || 100);
  const [heroBackgroundStackZ, setHeroBackgroundStackZ] = useState(initialHeroVisual.heroBackgroundStackZ ?? 1);
  const [heroMediaStackZ, setHeroMediaStackZ] = useState(initialHeroVisual.heroMediaStackZ ?? 8);
  const [heroRitualStackZ, setHeroRitualStackZ] = useState(
    normalizeRitualStackZ(initialHeroVisual.heroRitualStackZ, 4)
  );
  const [heroRitualBandStackZ, setHeroRitualBandStackZ] = useState(
    initialHeroVisual.heroRitualBandStackZ ?? 2
  );
  const [ritualBandVisible, setRitualBandVisible] = useState(
    initialHeroVisual.ritualBandVisible ?? true
  );
  const [ritualBandVisibleMobile, setRitualBandVisibleMobile] = useState(
    initialHeroVisual.ritualBandVisibleMobile ?? false
  );
  const [ritualBandLayout, setRitualBandLayout] = useState<HeroMediaLayout>(
    initialHeroVisual.ritualBandLayout ?? { ...HERO_RITUAL_BAND_DEFAULT_LAYOUT }
  );
  const [ritualBandScale, setRitualBandScale] = useState(initialHeroVisual.ritualBandScale ?? 1);
  const [ritualBandOpacity, setRitualBandOpacity] = useState(
    initialHeroVisual.ritualBandOpacity ?? 0.94
  );
  const [ritualBandColor, setRitualBandColor] = useState(
    initialHeroVisual.ritualBandColor ?? "#ffffff"
  );
  const ritualBandLayoutRef = useRef(
    initialHeroVisual.ritualBandLayout ?? { ...HERO_RITUAL_BAND_DEFAULT_LAYOUT }
  );
  const ritualBandScaleRef = useRef(initialHeroVisual.ritualBandScale ?? 1);
  const ritualBandOpacityRef = useRef(initialHeroVisual.ritualBandOpacity ?? 0.94);
  const ritualBandColorRef = useRef(initialHeroVisual.ritualBandColor ?? "#ffffff");
  const bandServerSaveTimerRef = useRef<number | null>(null);
  const bandServerSaveGenRef = useRef(0);
  ritualBandLayoutRef.current = ritualBandLayout;
  ritualBandScaleRef.current = ritualBandScale;
  ritualBandOpacityRef.current = ritualBandOpacity;
  ritualBandColorRef.current = ritualBandColor;
  const [ritualCarouselScale, setRitualCarouselScale] = useState(
    initialHeroVisual.ritualCarouselScale ?? 1
  );
  const [heroCopyStackZ, setHeroCopyStackZ] = useState(initialHeroVisual.heroCopyStackZ ?? 9);
  const [heroPromoStackZ, setHeroPromoStackZ] = useState(initialHeroVisual.heroPromoStackZ ?? 7);
  const [lovedFloralsStackZ, setLovedFloralsStackZ] = useState(initialHeroVisual.lovedFloralsStackZ ?? 1);
  const [lovedWashStackZ, setLovedWashStackZ] = useState(initialHeroVisual.lovedWashStackZ ?? 2);
  const [lovedBandStackZ, setLovedBandStackZ] = useState(initialHeroVisual.lovedBandStackZ ?? 3);
  const [lovedContentStackZ, setLovedContentStackZ] = useState(initialHeroVisual.lovedContentStackZ ?? 4);
  const isMobileViewport = useSyncExternalStore(
    subscribeMaromaMobileViewport,
    getMaromaMobileViewportMatches,
    () => initialViewportIsMobile
  );
  const isNarrowViewport = useSyncExternalStore(
    subscribeMaromaNarrowViewport,
    getMaromaNarrowViewportMatches,
    () => initialViewportIsMobile
  );
  const isDesktopLikePointer = useSyncExternalStore(
    subscribeMaromaDesktopLikePointer,
    getMaromaDesktopLikePointer,
    () => !initialViewportIsMobile
  );
  const forceMobileLayout = useSyncExternalStore(
    subscribeMaromaForceMobileLayout,
    getMaromaForceMobileLayout,
    () => initialViewportIsMobile
  );
  /** Real phones — touch-primary or narrow viewport without a desktop pointer. */
  const isRealPhoneViewport = forceMobileLayout;
  const [adminDevicePreview, setAdminDevicePreview] = useState<AdminDevicePreview>("desktop");
  const [heroCopyOffsetY, setHeroCopyOffsetY] = useState(initialHeroVisual.heroCopyOffsetY);
  const [heroMobileOverrides, setHeroMobileOverrides] = useState<HeroMobileOverrides>(
    initialHeroVisual.mobile ?? {}
  );
  const [layoutDragging, setLayoutDragging] = useState(false);
  const [floatingChrome, setFloatingChrome] = useState<FloatingAdminChrome>(defaultFloatingChrome);
  const [adminMoreOpen, setAdminMoreOpen] = useState(false);

  const adminMobilePreviewActive =
    adminDragEnabled && adminDevicePreview === "mobile" && !isNarrowViewport;
  /** Desktop admin tab on wide/narrow desktop — never on real touch phones. */
  const adminDesktopEditActive =
    adminDragEnabled &&
    adminDevicePreview === "desktop" &&
    !isRealPhoneViewport &&
    (!isNarrowViewport || isDesktopLikePointer);
  const showMobileLayout =
    adminMobilePreviewActive ||
    isRealPhoneViewport ||
    (isMobileViewport && !adminDesktopEditActive && !isDesktopLikePointer);
  const canEditLayout = adminDragEnabled && !adminMobilePreviewActive;
  const canEditMobilePreview = adminDragEnabled && adminMobilePreviewActive;
  const isEditingMobilePreview = canEditMobilePreview;
  /** Admin layout edits on any mobile view (preview frame or real phone) write to mobile overrides only. */
  const persistLayoutToMobile = adminDragEnabled && showMobileLayout;
  /** Mobile preview + phones share the 390px document-flow stack (not desktop % coords). */
  const useMobileDocumentFlow = showMobileLayout;
  /** Preview + phone share composed-stack CSS vars — never switch to legacy is-admin-layout on mobile. */
  const mobileNudgeActive = false;
  const mobileLayerEditChrome = persistLayoutToMobile && adminDragEnabled;
  const desktopLayoutSource = useMemo(
    () => ({
      layout: heroMediaLayout,
      overlayLayout: heroOverlayLayer.layout,
      backgroundLayout: heroLayout,
      primaryScale: heroPrimarySettings.scale || 1,
      overlayScale: heroOverlayLayer.scale || 1,
      ritualCarouselPosPct,
      eyebrowPos,
      headlinePos,
      heroActionsPos,
      heroPromoBannerTopCm,
      heroPromoBannerPos,
      heroPromoBannerWidthPct,
      headlineSizeRem,
      heroCopyWidthVw,
      heroCopyOffsetY,
      lovedDividerOffsetY,
      lovedFloralOffsetY,
      lovedTintOpacity,
      ritualCarouselScale,
    }),
    [
      heroMediaLayout,
      heroOverlayLayer.layout,
      heroLayout,
      heroPrimarySettings.scale,
      heroOverlayLayer.scale,
      ritualCarouselPosPct,
      eyebrowPos,
      headlinePos,
      heroActionsPos,
      heroPromoBannerTopCm,
      heroPromoBannerPos,
      heroPromoBannerWidthPct,
      headlineSizeRem,
      heroCopyWidthVw,
      heroCopyOffsetY,
      lovedDividerOffsetY,
      lovedFloralOffsetY,
      lovedTintOpacity,
      ritualCarouselScale,
    ]
  );
  const mobileEffective = useMemo(() => {
    const derived = deriveMobileFromDesktop(desktopLayoutSource);
    return resolveHeroMobileLayout(mergeHeroMobileOverrides(derived, heroMobileOverrides));
  }, [desktopLayoutSource, heroMobileOverrides]);

  useEffect(() => {
    if (persistLayoutToMobile) {
      setRitualCarouselScale(mobileEffective.ritualCarouselScale);
    }
  }, [adminDevicePreview, persistLayoutToMobile]);

  type AdminLayerId =
    | "primary"
    | "overlay"
    | "background"
    | "headline"
    | "eyebrow"
    | "actions"
    | "promo-banner"
    | "promo-cta"
    | "ritual-band"
    | "rituals"
    | "loved-florals"
    | "loved-wash"
    | "loved-band"
    | "loved-section";
  type StackOrderLayerId = Exclude<AdminLayerId, "primary" | "overlay">;
  const [adminEditLayer, setAdminEditLayer] = useState<AdminLayerId>("headline");
  const mobilePrimaryEditActive = mobileLayerEditChrome && adminEditLayer === "primary";
  const mobileOverlayEditActive = mobileLayerEditChrome && adminEditLayer === "overlay";
  const heroMediaEditActive =
    adminDragEnabled &&
    (mobilePrimaryEditActive ||
      mobileOverlayEditActive ||
      (adminDesktopEditActive &&
        (adminEditLayer === "primary" || adminEditLayer === "overlay")));
  const canEditRitualPosition = adminDragEnabled && adminEditLayer === "rituals" && (canEditLayout || canEditMobilePreview);
  const canEditRitualBand = adminDragEnabled && adminEditLayer === "ritual-band" && (canEditLayout || canEditMobilePreview);
  const canEditHeroMediaLayout = canEditLayout || canEditMobilePreview;

  const [productSearch, setProductSearch] = useState(initialProductSearch);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productStatus, setProductStatus] = useState("Loading products...");
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const basePos = useRef(initialHeroVisual.headlinePos);
  const headlinePosRef = useRef(initialHeroVisual.headlinePos);
  const heroActionsDragStart = useRef<{ x: number; y: number } | null>(null);
  const heroActionsBaseRef = useRef({ x: 0, y: 0 });
  const heroActionsPosRef = useRef(initialHeroVisual.heroActionsPos);
  const heroPromoDragStart = useRef<{ x: number; y: number } | null>(null);
  const heroPromoBaseRef = useRef({ x: 0, y: 0, topCm: initialHeroVisual.heroPromoBannerTopCm });
  const heroPromoBannerPosRef = useRef(initialHeroVisual.heroPromoBannerPos);
  const heroPromoBannerTopCmRef = useRef(initialHeroVisual.heroPromoBannerTopCm);
  const floatingPanelDragStart = useRef<{ x: number; y: number } | null>(null);
  const floatingPanelBase = useRef({ x: 0, y: 0 });
  const floatingPanelRef = useRef<HTMLDivElement | null>(null);
  const floatingAdminCoreRef = useRef<HTMLDivElement | null>(null);
  const floatingAdminBodyRef = useRef<HTMLDivElement | null>(null);
  const adminMobilePreviewFrameRef = useRef<HTMLDivElement | null>(null);
  const headlineElRef = useRef<HTMLHeadingElement | null>(null);
  const heroActionsElRef = useRef<HTMLDivElement | null>(null);
  const heroPromoElRef = useRef<HTMLDivElement | null>(null);
  const ritualDragStart = useRef<{ x: number; y: number } | null>(null);
  const ritualBasePct = useRef(HERO_RITUAL_DEFAULT_POS_PCT);
  const ritualBandDragStart = useRef<{ x: number; y: number } | null>(null);
  const ritualBandBaseLayout = useRef<HeroMediaLayout>(
    initialHeroVisual.ritualBandLayout ?? { ...HERO_RITUAL_BAND_DEFAULT_LAYOUT }
  );
  const heroArtboardRef = useRef<HTMLDivElement | null>(null);
  const [ritualPageLayerBounds, setRitualPageLayerBounds] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  });
  const ritualPageLayerBoundsRef = useRef(ritualPageLayerBounds);
  const showMobileLayoutRef = useRef(showMobileLayout);
  showMobileLayoutRef.current = showMobileLayout;
  const canEditLayoutRef = useRef(canEditLayout);
  canEditLayoutRef.current = canEditLayout;
  const useMobileDocumentFlowRef = useRef(useMobileDocumentFlow);
  useMobileDocumentFlowRef.current = useMobileDocumentFlow;

  const clampFloatingPanelPos = useCallback(
    (pos: { x: number; y: number }) => {
      if (typeof window === "undefined") {
        return pos;
      }
      const iw = window.innerWidth;
      const ih = window.innerHeight;
      const pad = 12;
      const el = floatingPanelRef.current;
      const panelW = Math.max(el?.offsetWidth ?? 280, 120);
      const panelH = Math.max(el?.offsetHeight ?? 260, 120);
      const adminBar =
        Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--admin-bar-height")
        ) || 0;

      if (adminMobilePreviewActive) {
        const anchorTop = adminBar + 16;
        const anchorRight = 16;
        const minX = pad - (iw - anchorRight - panelW);
        const maxX = anchorRight - pad;
        const minY = adminBar + pad - anchorTop;
        const maxY = ih - pad - anchorTop - panelH;
        return {
          x: Math.max(minX, Math.min(maxX, pos.x)),
          y: Math.max(minY, Math.min(maxY, pos.y))
        };
      }

      const rightOffset = floatingChrome.sideInsetPx;
      const topOffset = adminBar + floatingChrome.bottomPx;
      const leftAtZero = iw - rightOffset - panelW;
      const topAtZero = topOffset;
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
    },
    [adminMobilePreviewActive, floatingChrome.bottomPx, floatingChrome.sideInsetPx]
  );

  const applyHeroVisualState = useCallback((data: HeroVisualApiState) => {
    if (data.layout) setHeroMediaLayout(data.layout);
    if (data.primarySettings) setHeroPrimarySettings(data.primarySettings);
    if (data.overlayLayer) setHeroOverlayLayer(data.overlayLayer);
    if (typeof data.headlineSizeRem === "number") setHeadlineSizeRem(data.headlineSizeRem);
    if (typeof data.heroCopyWidthVw === "number") setHeroCopyWidthVw(data.heroCopyWidthVw);
    if (data.heroLayout) setHeroLayout(data.heroLayout);
    if (data.headlinePos) setHeadlinePos(data.headlinePos);
    if (data.heroActionsPos) setHeroActionsPos(data.heroActionsPos);
    if (typeof data.heroPromoBannerTopCm === "number") {
      setHeroPromoBannerTopCm(data.heroPromoBannerTopCm);
    }
    if (data.heroPromoBannerPos) setHeroPromoBannerPos(data.heroPromoBannerPos);
    if (typeof data.heroPromoBannerWidthPct === "number") {
      setHeroPromoBannerWidthPct(data.heroPromoBannerWidthPct);
    }
    if (typeof data.heroMarqueeStartOffsetCm === "number") {
      setHeroMarqueeStartOffsetCm(data.heroMarqueeStartOffsetCm);
    }
    if (typeof data.heroMarqueeStartOffsetPx === "number") {
      setHeroMarqueeStartOffsetPx(data.heroMarqueeStartOffsetPx);
    }
    if (typeof data.heroMarqueeEndOffsetCm === "number") {
      setHeroMarqueeEndOffsetCm(data.heroMarqueeEndOffsetCm);
    }
    if (typeof data.heroMarqueeEndOffsetPx === "number") {
      setHeroMarqueeEndOffsetPx(data.heroMarqueeEndOffsetPx);
    }
    if (data.eyebrowPos) setEyebrowPos(data.eyebrowPos);
    if (data.ritualCarouselPos) setRitualCarouselPos(data.ritualCarouselPos);
    if (data.ritualCarouselPosPct) setRitualCarouselPosPct(data.ritualCarouselPosPct);
    if (data.bgColors) setBgColors(data.bgColors);
    if (typeof data.bgAngle === "number") setBgAngle(data.bgAngle);
    if (typeof data.backgroundVisible === "boolean") setBackgroundVisible(data.backgroundVisible);
    if (typeof data.headlineVisible === "boolean") setHeadlineVisible(data.headlineVisible);
    if (typeof data.eyebrowVisible === "boolean") setEyebrowVisible(data.eyebrowVisible);
    if (typeof data.actionsVisible === "boolean") setActionsVisible(data.actionsVisible);
    if (typeof data.lovedSectionVisible === "boolean") setLovedSectionVisible(data.lovedSectionVisible);
    if (typeof data.lovedFloralsVisible === "boolean") setLovedFloralsVisible(data.lovedFloralsVisible);
    if (typeof data.lovedWashVisible === "boolean") setLovedWashVisible(data.lovedWashVisible);
    if (typeof data.lovedBandVisible === "boolean") setLovedBandVisible(data.lovedBandVisible);
    if (typeof data.lovedDividerOffsetY === "number") setLovedDividerOffsetY(data.lovedDividerOffsetY);
    if (typeof data.lovedFlowOffsetPx === "number") setLovedFlowOffsetPx(data.lovedFlowOffsetPx);
    if (typeof data.lovedPositionCustomized === "boolean") {
      lovedPositionCustomizedRef.current = data.lovedPositionCustomized;
    } else if (typeof data.lovedDividerOffsetY === "number") {
      lovedPositionCustomizedRef.current =
        data.lovedDividerOffsetY !== LOVED_HANDOFF_OFFSET_Y_PX ||
        typeof data.lovedFlowOffsetPx === "number";
    }
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
    if (typeof data.lovedTint2WidthPct === "number") setLovedTint2WidthPct(data.lovedTint2WidthPct);
    if (typeof data.lovedTint2LeftPct === "number") setLovedTint2LeftPct(data.lovedTint2LeftPct);
    if (typeof data.heroSectionHeight === "number") setHeroSectionHeight(data.heroSectionHeight);
    if (typeof data.heroBackgroundStackZ === "number") {
      setHeroBackgroundStackZ(clampHeroLayerDepth(data.heroBackgroundStackZ, heroBackgroundStackZ));
    }
    if (typeof data.heroMediaStackZ === "number") {
      setHeroMediaStackZ(clampHeroLayerDepth(data.heroMediaStackZ, heroMediaStackZ));
    }
    if (typeof data.heroRitualStackZ === "number") {
      setHeroRitualStackZ(normalizeRitualStackZ(data.heroRitualStackZ, 4));
    }
    if (typeof data.heroRitualBandStackZ === "number") setHeroRitualBandStackZ(data.heroRitualBandStackZ);
    if (typeof data.ritualBandVisible === "boolean") setRitualBandVisible(data.ritualBandVisible);
    if (typeof data.ritualBandVisibleMobile === "boolean") {
      setRitualBandVisibleMobile(data.ritualBandVisibleMobile);
    }
    if (data.ritualBandLayout) setRitualBandLayout(data.ritualBandLayout);
    if (typeof data.ritualBandScale === "number") setRitualBandScale(data.ritualBandScale);
    if (typeof data.ritualBandOpacity === "number") setRitualBandOpacity(data.ritualBandOpacity);
    if (typeof data.ritualBandColor === "string") setRitualBandColor(data.ritualBandColor);
    if (typeof data.ritualCarouselScale === "number") setRitualCarouselScale(data.ritualCarouselScale);
    if (typeof data.heroCopyStackZ === "number") {
      setHeroCopyStackZ(clampHeroLayerDepth(data.heroCopyStackZ, heroCopyStackZ));
    }
    if (typeof data.heroPromoStackZ === "number") {
      setHeroPromoStackZ(clampHeroLayerDepth(data.heroPromoStackZ, heroPromoStackZ));
    }
    if (typeof data.lovedFloralsStackZ === "number") setLovedFloralsStackZ(data.lovedFloralsStackZ);
    if (typeof data.lovedWashStackZ === "number") setLovedWashStackZ(data.lovedWashStackZ);
    if (typeof data.lovedBandStackZ === "number") setLovedBandStackZ(data.lovedBandStackZ);
    if (typeof data.lovedContentStackZ === "number") setLovedContentStackZ(data.lovedContentStackZ);
    if (typeof data.heroCopyOffsetY === "string" && data.heroCopyOffsetY.trim()) {
      setHeroCopyOffsetY(data.heroCopyOffsetY.trim());
    }
    if (data.mobile) {
      setHeroMobileOverrides(data.mobile);
    }
  }, []);

  const postHeroVisualState = useCallback(async (payload: HeroVisualApiState) => {
    const response = await fetch("/api/hero-media-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      let message = "Unable to save layout.";
      try {
        const data = (await response.json()) as { error?: string };
        if (data.error) {
          message = data.error;
        }
      } catch {
        // keep default message
      }
      throw new Error(message);
    }
    return (await response.json()) as HeroVisualApiState;
  }, []);

  const mediaDragStart = useRef<{ x: number; y: number } | null>(null);
  const mediaResizeStart = useRef<{ x: number; y: number } | null>(null);
  const mediaBaseLayout = useRef<HeroMediaLayout>({ ...initialHeroVisual.layout });
  const bgDragStart = useRef<{ x: number; y: number } | null>(null);
  const bgBaseLayout = useRef<HeroMediaLayout>(
    initialHeroVisual.heroLayout || { x: 0, y: 0, width: 100, height: 100 }
  );
  const lovedDragStartY = useRef<number | null>(null);
  const lovedBaseOffsetY = useRef(0);
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
      const parsed = mergeWithDefaults(JSON.parse(stored) as unknown);
      if (JSON.stringify(parsed) !== JSON.stringify(initialSiteContent)) {
        setContent(parsed);
      }
      try {
        window.localStorage.setItem(contentStorageKey, JSON.stringify(parsed));
      } catch {
        // ignore quota
      }
    } catch {
      // keep server-provided content
    }
  }, [initialSiteContent]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(ADMIN_DEVICE_PREVIEW_KEY);
    if (stored === "mobile" || stored === "desktop") {
      setAdminDevicePreview(stored);
      return;
    }
    if (getMaromaForceMobileLayout() || (initialViewportIsMobile && getMaromaNarrowViewportMatches())) {
      setAdminDevicePreview("mobile");
    }
  }, [initialViewportIsMobile]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (useMobileDocumentFlowRef.current) {
      return;
    }

    const syncRitualPageLayerBounds = () => {
      const artboard = heroArtboardRef.current;
      const page = artboard?.closest(".page.maroma") as HTMLElement | null;
      const hero = heroSectionRef.current;
      if (!artboard || !page) {
        return;
      }
      const artboardRect = artboard.getBoundingClientRect();
      const pageRect = page.getBoundingClientRect();
      const nextBounds = {
        top: Math.round(artboardRect.top - pageRect.top + page.scrollTop),
        left: Math.round(artboardRect.left - pageRect.left + page.scrollLeft),
        width: Math.round(artboardRect.width),
        height: Math.round(artboardRect.height),
      };
      const prevBounds = ritualPageLayerBoundsRef.current;
      const mobileStable =
        showMobileLayoutRef.current &&
        Math.abs(nextBounds.top - prevBounds.top) < 2 &&
        Math.abs(nextBounds.left - prevBounds.left) < 2 &&
        Math.abs(nextBounds.width - prevBounds.width) < 2 &&
        Math.abs(nextBounds.height - prevBounds.height) < 2;
      if (!mobileStable) {
        ritualPageLayerBoundsRef.current = nextBounds;
        setRitualPageLayerBounds(nextBounds);
      }

      if (!hero) {
        return;
      }
      const heroBottom =
        hero.getBoundingClientRect().bottom - pageRect.top + page.scrollTop;
      let contentBottom = heroBottom;
      const carouselPanel = page.querySelector<HTMLElement>(
        ".hero-ritual-page-layer .hero-ritual-panel"
      );
      if (carouselPanel) {
        contentBottom =
          carouselPanel.getBoundingClientRect().bottom - pageRect.top + page.scrollTop;
      }
      const bandEl = page.querySelector<HTMLElement>(".hero-ritual-band");
      if (bandEl) {
        const bandBottom =
          bandEl.getBoundingClientRect().bottom - pageRect.top + page.scrollTop;
        contentBottom = Math.max(contentBottom, bandBottom);
      }
      if (!showMobileLayoutRef.current && !lovedPositionCustomizedRef.current) {
        setLovedFlowOffsetPx(contentBottom - heroBottom);
      }
    };

    syncRitualPageLayerBounds();
    let raf1 = 0;
    let raf2 = 0;
    if (!showMobileLayout) {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(syncRitualPageLayerBounds);
      });
    }
    const artboard = heroArtboardRef.current;
    if (!artboard) {
      return;
    }

    const trackScroll = !showMobileLayout;
    const resizeObserver = new ResizeObserver(syncRitualPageLayerBounds);
    resizeObserver.observe(artboard);
    const page = artboard.closest(".page.maroma");
    if (page) {
      resizeObserver.observe(page);
    }
    if (heroSectionRef.current) {
      resizeObserver.observe(heroSectionRef.current);
    }
    page
      ?.querySelectorAll<HTMLElement>(".hero-ritual-page-layer .hero-ritual-panel, .hero-ritual-band")
      .forEach((node) => resizeObserver.observe(node));

    window.addEventListener("resize", syncRitualPageLayerBounds);
    if (trackScroll) {
      window.addEventListener("scroll", syncRitualPageLayerBounds, true);
      window.visualViewport?.addEventListener("scroll", syncRitualPageLayerBounds);
    }
    window.visualViewport?.addEventListener("resize", syncRitualPageLayerBounds);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncRitualPageLayerBounds);
      if (trackScroll) {
        window.removeEventListener("scroll", syncRitualPageLayerBounds, true);
        window.visualViewport?.removeEventListener("scroll", syncRitualPageLayerBounds);
      }
      window.visualViewport?.removeEventListener("resize", syncRitualPageLayerBounds);
    };
  }, [
    showMobileLayout,
    adminMobilePreviewActive,
    adminEditLayer,
    mobileNudgeActive,
    layoutDragging,
    ritualCarouselPosPct,
    ritualCarouselPos.y,
    heroSectionHeight,
    adminDragEnabled,
    ritualsVisible,
    ritualBandVisible,
    ritualBandVisibleMobile,
    ritualBandLayout,
    ritualBandScale,
    ritualCarouselScale,
    lovedDividerOffsetY,
  ]);

  const setDevicePreview = useCallback((mode: AdminDevicePreview) => {
    setAdminDevicePreview(mode);
    try {
      window.localStorage.setItem(ADMIN_DEVICE_PREVIEW_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const loadContent = async () => {
      try {
        const response = await fetch("/api/site-content", { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as { content?: SiteContent | null };
          if (payload.content) {
            const next = mergeWithDefaults(payload.content);
            setContent((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
            try {
              window.localStorage.setItem(contentStorageKey, JSON.stringify(next));
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
    void loadContent();
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
    const isMobile =
      getMaromaMobileViewportMatches() ||
      document.body.classList.contains("admin-mobile-preview-active");
    if (isMobile) {
      nodes.forEach((node) => node.classList.add("is-inview"));
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
  }, [content, products.length, adminMobilePreviewActive]);

  useEffect(() => {
    if (!sessionReady) return;
    if (!isAdminUser) {
      setAdminDragEnabled(false);
      return;
    }
    const stored = window.localStorage.getItem(ADMIN_DRAG_STORAGE_KEY);
    setAdminDragEnabled(stored === "true");
  }, [sessionReady, isAdminUser]);

  useEffect(() => {
    if (!isAdminUser) return;
    const sync = () => {
      setAdminDragEnabled(window.localStorage.getItem(ADMIN_DRAG_STORAGE_KEY) === "true");
    };
    window.addEventListener("maroma-admin-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("maroma-admin-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [isAdminUser]);

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
    if (typeof window === "undefined") {
      return;
    }
    try {
      if (window.localStorage.getItem(RITUAL_STACK_BASELINE_KEY)) {
        return;
      }
      setHeroRitualStackZ(1);
      const stored = window.localStorage.getItem(VISUAL_STATE_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as HeroVisualApiState;
        data.heroRitualStackZ = 1;
        data.ritualCarouselStackRev = 2;
        window.localStorage.setItem(VISUAL_STATE_STORAGE_KEY, JSON.stringify(data));
      }
      window.localStorage.setItem(RITUAL_STACK_BASELINE_KEY, "1");
      void fetch("/api/hero-media-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroRitualStackZ: 1, ritualCarouselStackRev: 2 }),
      });
    } catch {
      // ignore
    }
  }, []);

  useLayoutEffect(() => {
    const local = readHeroVisualLocalBackup();
    if (!local) {
      return;
    }
    const localAt = getVisualStateUpdatedAt(local);
    const initialAt = getVisualStateUpdatedAt(initialHeroVisual);
    if (localAt > initialAt) {
      applyHeroVisualState(local);
    }
  }, [applyHeroVisualState, initialHeroVisual]);

  useEffect(() => {
    let active = true;
    const loadLatestVisualState = async () => {
      const local = readHeroVisualLocalBackup() ?? initialHeroVisual;
      let server: HeroVisualState = initialHeroVisual;

      try {
        const response = await fetch("/api/hero-media-layout", { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as HeroVisualApiState;
          if (!data.error) {
            server = parseHeroVisualState(data);
          }
        }
      } catch {
        // Fall back to local backup when API is unavailable.
      }

      const merged = mergeHeroVisualStates(local, server);
      if (!active) {
        return;
      }

      applyHeroVisualState(merged);
      writeHeroVisualLocalBackup(merged);

      const localAt = getVisualStateUpdatedAt(local);
      const serverAt = getVisualStateUpdatedAt(server);
      if (localAt <= serverAt) {
        return;
      }

      try {
        const sessionResponse = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const sessionData = (await sessionResponse.json()) as { user?: { role?: string } | null };
        if (sessionData.user?.role !== "admin") {
          return;
        }
        await postHeroVisualState(merged);
      } catch {
        setSaveStatus("error");
      }
    };
    void loadLatestVisualState();
    return () => {
      active = false;
    };
  }, [applyHeroVisualState, initialHeroVisual, postHeroVisualState]);

  useEffect(() => {
    const onResize = () => {
      setFloatingPanelPos((prev) => clampFloatingPanelPos(prev));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampFloatingPanelPos]);

  useEffect(() => {
    setFloatingPanelPos((prev) => clampFloatingPanelPos(prev));
  }, [adminMobilePreviewActive, clampFloatingPanelPos]);

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
    lovedDividerOffsetRef.current = lovedDividerOffsetY;
  }, [lovedDividerOffsetY]);

  useEffect(() => {
    lovedFlowOffsetRef.current = lovedFlowOffsetPx;
  }, [lovedFlowOffsetPx]);

  useEffect(() => {
    headlinePosRef.current = headlinePos;
  }, [headlinePos]);

  useEffect(() => {
    heroActionsPosRef.current = heroActionsPos;
  }, [heroActionsPos]);

  useEffect(() => {
    heroPromoBannerPosRef.current = heroPromoBannerPos;
  }, [heroPromoBannerPos]);

  useEffect(() => {
    heroPromoBannerTopCmRef.current = heroPromoBannerTopCm;
  }, [heroPromoBannerTopCm]);


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

  const buildLiveBandFields = (patch: HeroVisualApiState) => ({
    ritualBandLayout: patch.ritualBandLayout ?? ritualBandLayoutRef.current,
    ritualBandScale: patch.ritualBandScale ?? ritualBandScaleRef.current,
    ritualBandOpacity: patch.ritualBandOpacity ?? ritualBandOpacityRef.current,
    ritualBandColor: patch.ritualBandColor ?? ritualBandColorRef.current,
  });

  const writeVisualLocalBackup = (patch: HeroVisualApiState, stampedAt: number) => {
    const liveBandFields = buildLiveBandFields(patch);
    try {
      const stored = window.localStorage.getItem(VISUAL_STATE_STORAGE_KEY);
      const backup = (
        stored ? (JSON.parse(stored) as HeroVisualApiState) : initialHeroVisual
      ) as HeroVisualApiState;
      const merged: HeroVisualApiState = {
        ...backup,
        ...liveBandFields,
        ...patch,
        updatedAt: stampedAt,
        ...(patch.mobile
          ? { mobile: { ...(backup.mobile ?? {}), ...patch.mobile } }
          : {}),
        ...(patch.primarySettings
          ? { primarySettings: { ...backup.primarySettings, ...patch.primarySettings } }
          : {}),
        ...(patch.overlayLayer
          ? {
              overlayLayer: {
                ...backup.overlayLayer,
                ...patch.overlayLayer,
                layout: patch.overlayLayer.layout ?? backup.overlayLayer?.layout,
              },
            }
          : {}),
      };
      window.localStorage.setItem(VISUAL_STATE_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Server persistence is the source of truth.
    }
    return { ...patch, ...liveBandFields, updatedAt: stampedAt };
  };

  const persistHeroVisualPatch = async (patch: HeroVisualApiState) => {
    const stampedAt = Date.now();
    const serverPayload = writeVisualLocalBackup(patch, stampedAt);

    try {
      await postHeroVisualState(serverPayload);
    } catch {
      setSaveStatus("error");
    }
  };

  const applyMobilePatch = (patch: HeroMobileOverrides) => {
    setHeroMobileOverrides((prev) => {
      const next = mergeHeroMobileOverrides(prev, patch);
      void persistHeroVisualPatch({ mobile: next });
      return next;
    });
  };

  const postRitualBandServerSave = (stampedAt = Date.now()) => {
    const payload = {
      ritualBandLayout: ritualBandLayoutRef.current,
      ritualBandScale: ritualBandScaleRef.current,
      ritualBandOpacity: ritualBandOpacityRef.current,
      ritualBandColor: ritualBandColorRef.current,
      updatedAt: stampedAt,
    };
    writeVisualLocalBackup(payload, stampedAt);
    return postHeroVisualState(payload);
  };

  const flushImmediateRitualBandServerSave = () => {
    if (bandServerSaveTimerRef.current !== null) {
      window.clearTimeout(bandServerSaveTimerRef.current);
      bandServerSaveTimerRef.current = null;
    }
    bandServerSaveGenRef.current += 1;
    void postRitualBandServerSave();
  };

  const scheduleRitualBandLayoutServerSave = (layout: HeroMediaLayout) => {
    ritualBandLayoutRef.current = layout;
    writeVisualLocalBackup({ ritualBandLayout: layout }, Date.now());

    if (bandServerSaveTimerRef.current !== null) {
      window.clearTimeout(bandServerSaveTimerRef.current);
    }
    const gen = ++bandServerSaveGenRef.current;
    bandServerSaveTimerRef.current = window.setTimeout(() => {
      if (gen !== bandServerSaveGenRef.current) {
        return;
      }
      bandServerSaveTimerRef.current = null;
      void postRitualBandServerSave();
    }, 400);
  };

  useEffect(() => {
    const flushPendingBandSave = () => {
      if (bandServerSaveTimerRef.current === null) {
        return;
      }
      window.clearTimeout(bandServerSaveTimerRef.current);
      bandServerSaveTimerRef.current = null;
      const payload = JSON.stringify({
        ritualBandLayout: ritualBandLayoutRef.current,
        ritualBandScale: ritualBandScaleRef.current,
        ritualBandOpacity: ritualBandOpacityRef.current,
        ritualBandColor: ritualBandColorRef.current,
        updatedAt: Date.now(),
      });
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(
          "/api/hero-media-layout",
          new Blob([payload], { type: "application/json" })
        );
      }
    };
    window.addEventListener("beforeunload", flushPendingBandSave);
    window.addEventListener("pagehide", flushPendingBandSave);
    return () => {
      window.removeEventListener("beforeunload", flushPendingBandSave);
      window.removeEventListener("pagehide", flushPendingBandSave);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("admin-mobile-preview-active", adminMobilePreviewActive);
    return () => {
      document.body.classList.remove("admin-mobile-preview-active");
    };
  }, [adminMobilePreviewActive]);

  useEffect(() => {
    document.body.classList.toggle("maroma-mobile-layout-active", showMobileLayout);
    document.documentElement.toggleAttribute("data-maroma-mobile-layout", showMobileLayout);
    return () => {
      document.body.classList.remove("maroma-mobile-layout-active");
      document.documentElement.removeAttribute("data-maroma-mobile-layout");
    };
  }, [showMobileLayout]);

  useEffect(() => {
    if (!adminMobilePreviewActive) {
      return;
    }
    const frame = adminMobilePreviewFrameRef.current;
    if (frame) {
      frame.scrollTop = 0;
    }
  }, [adminMobilePreviewActive, adminDevicePreview]);

  useEffect(() => {
    if (!adminDragEnabled) {
      return;
    }
    floatingAdminBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [adminDragEnabled, adminEditLayer]);

  const handlePointerDown = (event: React.PointerEvent<HTMLHeadingElement>) => {
    if (!canEditLayout && !canEditMobilePreview) {
      return;
    }
    if (persistLayoutToMobile && adminEditLayer !== "headline") {
      return;
    }
    dragStart.current = { x: event.clientX, y: event.clientY };
    basePos.current = persistLayoutToMobile ? { ...mobileEffective.headlinePos } : headlinePos;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLHeadingElement>) => {
    if (!dragStart.current || (!canEditLayout && !canEditMobilePreview)) {
      return;
    }
    if (persistLayoutToMobile && adminEditLayer !== "headline") {
      return;
    }
    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;
    const next = {
      x: basePos.current.x + dx,
      y: basePos.current.y + dy
    };
    headlinePosRef.current = next;
    if (persistLayoutToMobile) {
      setHeroMobileOverrides((prev) => mergeHeroMobileOverrides(prev, { headlinePos: next }));
    } else {
      setHeadlinePos(next);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLHeadingElement>) => {
    if (!canEditLayout && !canEditMobilePreview) {
      return;
    }
    dragStart.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (persistLayoutToMobile) {
      applyMobilePatch({ headlinePos: headlinePosRef.current });
    } else {
      void persistHeroVisualPatch({
        headlinePos: {
          x: headlinePosRef.current.x,
          y: headlinePosRef.current.y,
        },
      });
    }
  };

  const handleHeroActionsPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canEditLayout && !canEditMobilePreview) {
      return;
    }
    if (adminEditLayer !== "actions") {
      return;
    }
    heroActionsDragStart.current = { x: event.clientX, y: event.clientY };
    heroActionsBaseRef.current = persistLayoutToMobile
      ? { ...mobileEffective.heroActionsPos }
      : heroActionsPosRef.current;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleHeroActionsPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!heroActionsDragStart.current || (!canEditLayout && !canEditMobilePreview)) {
      return;
    }
    if (adminEditLayer !== "actions") {
      return;
    }
    const dx = event.clientX - heroActionsDragStart.current.x;
    const dy = event.clientY - heroActionsDragStart.current.y;
    const next = {
      x: heroActionsBaseRef.current.x + dx,
      y: heroActionsBaseRef.current.y + dy
    };
    heroActionsPosRef.current = next;
    if (persistLayoutToMobile) {
      setHeroMobileOverrides((prev) => mergeHeroMobileOverrides(prev, { heroActionsPos: next }));
    } else {
      setHeroActionsPos(next);
    }
  };

  const handleHeroActionsPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canEditLayout && !canEditMobilePreview) {
      return;
    }
    heroActionsDragStart.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (persistLayoutToMobile) {
      applyMobilePatch({ heroActionsPos: heroActionsPosRef.current });
    } else {
      void persistHeroVisualPatch({
        heroActionsPos: {
          x: heroActionsPosRef.current.x,
          y: heroActionsPosRef.current.y
        }
      });
    }
  };

  const handleHeroPromoPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canEditLayout && !canEditMobilePreview) {
      return;
    }
    if (adminEditLayer !== "promo-banner") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    heroPromoDragStart.current = { x: event.clientX, y: event.clientY };
    heroPromoBaseRef.current = promoHomepageActive
      ? {
          x: normalizePromoStripFields(livePromoBannersRef.current[0] ?? {}).stripPositionOffsetX ?? 0,
          y: normalizePromoStripFields(livePromoBannersRef.current[0] ?? {}).stripPositionOffsetPx,
          topCm: heroPromoBannerTopCmRef.current,
        }
      : persistLayoutToMobile
      ? {
          x: mobileEffective.heroPromoBannerPos.x,
          y: mobileEffective.heroPromoBannerPos.y,
          topCm: mobileEffective.heroPromoBannerTopCm,
        }
      : {
          x: heroPromoBannerPosRef.current.x,
          y: heroPromoBannerPosRef.current.y,
          topCm: heroPromoBannerTopCmRef.current,
        };
    setLayoutDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleHeroPromoPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!heroPromoDragStart.current || (!canEditLayout && !canEditMobilePreview)) {
      return;
    }
    if (adminEditLayer !== "promo-banner") {
      return;
    }
    event.preventDefault();
    const dx = event.clientX - heroPromoDragStart.current.x;
    const dy = event.clientY - heroPromoDragStart.current.y;
    const nextPos = {
      x: heroPromoBaseRef.current.x + dx,
      y: heroPromoBaseRef.current.y + dy,
    };
    if (promoHomepageActive) {
      const framePosition = { ...heroPromoBannerPosRef.current, x: nextPos.x };
      heroPromoBannerPosRef.current = framePosition;
      if (persistLayoutToMobile) {
        setHeroMobileOverrides((prev) => mergeHeroMobileOverrides(prev, { heroPromoBannerPos: framePosition }));
      } else {
        setHeroPromoBannerPos(framePosition);
      }
      patchLivePromoStrip({ stripPositionOffsetX: Math.max(-1200, Math.min(1200, Math.round(nextPos.x))), stripPositionOffsetPx: Math.max(PROMO_STRIP_POSITION_PX_MIN, Math.min(PROMO_STRIP_POSITION_PX_MAX, Math.round(nextPos.y))) });
    } else if (persistLayoutToMobile) {
      setHeroMobileOverrides((prev) =>
        mergeHeroMobileOverrides(prev, {
          heroPromoBannerPos: nextPos,
        })
      );
    } else {
      setHeroPromoBannerPos(nextPos);
    }
  };

  const handleHeroPromoPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canEditLayout && !canEditMobilePreview) {
      return;
    }
    if (!heroPromoDragStart.current) {
      return;
    }
    heroPromoDragStart.current = null;
    setLayoutDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (promoHomepageActive) {
      if (persistLayoutToMobile) {
        applyMobilePatch({ heroPromoBannerPos: heroPromoBannerPosRef.current });
      } else {
        void persistHeroVisualPatch({ heroPromoBannerPos: heroPromoBannerPosRef.current });
      }
      return;
    }
    if (persistLayoutToMobile) {
      applyMobilePatch({
        heroPromoBannerPos: heroPromoBannerPosRef.current,
      });
    } else {
      void persistHeroVisualPatch({
        heroPromoBannerPos: {
          x: heroPromoBannerPosRef.current.x,
          y: heroPromoBannerPosRef.current.y,
        },
      });
    }
  };

  const setEyebrowXFromPx = useCallback((nextX: number) => {
    if (persistLayoutToMobile) {
      applyMobilePatch({ eyebrowPos: { ...mobileEffective.eyebrowPos, x: nextX } });
      return;
    }
    const next = { ...eyebrowPos, x: nextX };
    setEyebrowPos(next);
    void persistHeroVisualPatch({ eyebrowPos: next });
  }, [applyMobilePatch, eyebrowPos, mobileEffective.eyebrowPos, persistLayoutToMobile]);

  const setEyebrowYFromPx = useCallback((nextY: number) => {
    if (persistLayoutToMobile) {
      applyMobilePatch({ eyebrowPos: { ...mobileEffective.eyebrowPos, y: nextY } });
      return;
    }
    const next = { ...eyebrowPos, y: nextY };
    setEyebrowPos(next);
    void persistHeroVisualPatch({ eyebrowPos: next });
  }, [applyMobilePatch, eyebrowPos, mobileEffective.eyebrowPos, persistLayoutToMobile]);

  const handleSaveAll = async () => {
    setSaveStatus("saving");
    if (lovedDividerOffsetRef.current !== LOVED_HANDOFF_OFFSET_Y_PX) {
      lovedPositionCustomizedRef.current = true;
    }
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
      headlinePos: headlinePosRef.current,
      heroActionsPos: heroActionsPosRef.current,
      heroPromoBannerTopCm: heroPromoBannerTopCmRef.current,
      heroPromoBannerPos: heroPromoBannerPosRef.current,
      heroPromoBannerWidthPct,
      heroMarqueeStartOffsetCm:
        heroMarqueeStartOffsetCm ?? livePromoBanners[0]?.heroMarqueeStartOffsetCm,
      heroMarqueeStartOffsetPx:
        heroMarqueeStartOffsetPx ?? livePromoBanners[0]?.heroMarqueeStartOffsetPx,
      heroMarqueeEndOffsetCm:
        heroMarqueeEndOffsetCm ?? livePromoBanners[0]?.heroMarqueeEndOffsetCm,
      heroMarqueeEndOffsetPx:
        heroMarqueeEndOffsetPx ?? livePromoBanners[0]?.heroMarqueeEndOffsetPx,
      ritualCarouselPos,
      ritualCarouselPosPct,
      eyebrowPos,
      bgColors,
      bgAngle,
      lovedSectionVisible,
      lovedFloralsVisible,
      lovedWashVisible,
      lovedBandVisible,
      lovedDividerOffsetY,
      lovedFlowOffsetPx,
      lovedPositionCustomized: lovedPositionCustomizedRef.current,
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
      lovedTint2WidthPct,
      lovedTint2LeftPct,
      heroSectionHeight,
      heroBackgroundStackZ,
      heroMediaStackZ,
      heroRitualStackZ,
      heroRitualBandStackZ,
      ritualBandVisible,
      ritualBandVisibleMobile,
      ritualBandLayout,
      ritualBandScale,
      ritualBandOpacity,
      ritualBandColor,
      ritualCarouselScale,
      heroCopyStackZ,
      heroPromoStackZ,
      lovedFloralsStackZ,
      lovedWashStackZ,
      lovedBandStackZ,
      lovedContentStackZ,
      heroCopyOffsetY,
      mobile: buildMobilePersistenceSnapshot(mobileEffective),
      updatedAt: Date.now(),
    };

    // Backup to localStorage immediately
    try {
      window.localStorage.setItem(VISUAL_STATE_STORAGE_KEY, JSON.stringify(visualData));
    } catch { }

    try {
      const [visualResponse, contentResponse] = await Promise.all([
        postHeroVisualState(visualData),
        fetch("/api/site-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ content }),
        }),
      ]);

      if (!contentResponse.ok) {
        throw new Error("Unable to save site content.");
      }

      const liveBanner = livePromoBannersRef.current[0];
      if (liveBanner) {
        const strip = normalizePromoStripFields({
          ...liveBanner,
          heroMarqueeStartOffsetCm:
            heroMarqueeStartOffsetCm ?? liveBanner.heroMarqueeStartOffsetCm,
          heroMarqueeStartOffsetPx:
            heroMarqueeStartOffsetPx ?? liveBanner.heroMarqueeStartOffsetPx,
          heroMarqueeEndOffsetCm: heroMarqueeEndOffsetCm ?? liveBanner.heroMarqueeEndOffsetCm,
          heroMarqueeEndOffsetPx: heroMarqueeEndOffsetPx ?? liveBanner.heroMarqueeEndOffsetPx,
        });
        const promoRes = await fetch("/api/promos", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...liveBanner,
            ...strip,
          }),
        });
        if (!promoRes.ok) {
          throw new Error("Unable to save marquee start and end.");
        }
      }

      writeHeroVisualLocalBackup(parseHeroVisualState(visualResponse));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    }
  };

  const clampLayout = (layout: HeroMediaLayout): HeroMediaLayout => {
    const width = Math.min(100, Math.max(30, layout.width));
    const height = Math.min(100, Math.max(30, layout.height));
    const x = Math.max(-100, Math.min(100, layout.x));
    const y = Math.max(-100, Math.min(100, layout.y));
    return { x, y, width, height };
  };

  const clampBackgroundLayout = (layout: HeroMediaLayout): HeroMediaLayout => ({
    x: Math.max(-100, Math.min(100, layout.x)),
    y: Math.max(-150, Math.min(150, layout.y)),
    width: Math.min(200, Math.max(20, layout.width)),
    height: Math.min(200, Math.max(20, layout.height)),
  });

  const clampLayerSettings = (settings: HeroLayerSettings): HeroLayerSettings => ({
    ...settings,
    opacity: Math.min(1, Math.max(0, settings.opacity)),
    zIndex: clampHeroLayerDepth(settings.zIndex, HERO_LAYER_DEPTH_MIN),
    rotateDeg: Math.min(180, Math.max(-180, Number(settings.rotateDeg) || 0))
  });

  const setHeroMediaLayoutAndSave = (next: HeroMediaLayout) => {
    const clamped = clampLayout(next);
    if (persistLayoutToMobile) {
      applyMobilePatch({ layout: clamped });
      return;
    }
    setHeroMediaLayout(clamped);
    void persistHeroVisualPatch({ layout: clamped });
  };

  const setBackgroundLayoutAndSave = (next: HeroMediaLayout) => {
    const clamped = clampBackgroundLayout(next);
    if (persistLayoutToMobile) {
      applyMobilePatch({ backgroundLayout: clamped });
      return;
    }
    setHeroLayout(clamped);
    void persistHeroVisualPatch({ heroLayout: clamped });
  };

  const setPrimarySettingsAndSave = (next: HeroLayerSettings) => {
    const clamped = clampLayerSettings(next);
    if (persistLayoutToMobile) {
      applyMobilePatch({ primaryScale: clamped.scale });
      const shared: HeroLayerSettings = {
        ...heroPrimarySettings,
        visible: clamped.visible,
        opacity: clamped.opacity,
        zIndex: clamped.zIndex,
        rotateDeg: clamped.rotateDeg,
        fit: clamped.fit,
      };
      setHeroPrimarySettings(shared);
      void persistHeroVisualPatch({ primarySettings: shared });
      return;
    }
    setHeroPrimarySettings(clamped);
    void persistHeroVisualPatch({ primarySettings: clamped });
  };

  const setOverlayLayoutAndSave = (next: HeroMediaLayout) => {
    const clamped = clampLayout(next);
    if (persistLayoutToMobile) {
      applyMobilePatch({ overlayLayout: clamped });
      return;
    }
    const nextLayer: HeroOverlayLayer = { ...heroOverlayLayer, layout: clamped };
    setHeroOverlayLayer(nextLayer);
    void persistHeroVisualPatch({ overlayLayer: nextLayer });
  };

  const setOverlayLayerAndSave = (next: HeroOverlayLayer) => {
    const layout = clampLayout(next.layout);
    const clamped: HeroOverlayLayer = {
      ...clampLayerSettings(next),
      src: next.src,
      layout
    };
    if (persistLayoutToMobile) {
      // Mobile position/scale use dedicated setters — avoid overwriting overlayScale on opacity/z-index edits.
      const shared: HeroOverlayLayer = {
        ...heroOverlayLayer,
        visible: clamped.visible,
        opacity: clamped.opacity,
        zIndex: clamped.zIndex,
        rotateDeg: clamped.rotateDeg,
        fit: clamped.fit,
        src: clamped.src,
        layout: heroOverlayLayer.layout,
        scale: heroOverlayLayer.scale,
      };
      setHeroOverlayLayer(shared);
      void persistHeroVisualPatch({ overlayLayer: shared });
      return;
    }
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
    const artboardRect = heroArtboardRef.current?.getBoundingClientRect();
    if (artboardRect && artboardRect.width > 0 && artboardRect.height > 0) {
      return { width: artboardRect.width, height: artboardRect.height };
    }
    const rect = heroSectionRef.current?.getBoundingClientRect();
    return {
      width: Math.max(rect?.width ?? 1, 1),
      height: Math.max(rect?.height ?? 1, 1)
    };
  };

  const patchMobileMediaLayout = (layerId: HeroLayerId, layout: HeroMediaLayout) => {
    const clamped = clampLayout(layout);
    if (layerId === "primary") {
      setHeroMobileOverrides((prev) => mergeHeroMobileOverrides(prev, { layout: clamped }));
    } else {
      setHeroMobileOverrides((prev) => mergeHeroMobileOverrides(prev, { overlayLayout: clamped }));
    }
    return clamped;
  };

  const canEditBackgroundLayout =
    adminDragEnabled && adminEditLayer === "background" && (canEditLayout || canEditMobilePreview);

  const handleBackgroundDragDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canEditBackgroundLayout) {
      return;
    }
    setLayoutDragging(true);
    bgDragStart.current = { x: event.clientX, y: event.clientY };
    bgBaseLayout.current = persistLayoutToMobile
      ? { ...mobileEffective.backgroundLayout }
      : { ...heroLayout };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleBackgroundDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canEditBackgroundLayout || !bgDragStart.current) {
      return;
    }
    const bounds = getHeroBounds();
    const dxPct = ((event.clientX - bgDragStart.current.x) / bounds.width) * 100;
    const dyPct = ((event.clientY - bgDragStart.current.y) / bounds.height) * 100;
    const next = clampBackgroundLayout({
      ...bgBaseLayout.current,
      x: bgBaseLayout.current.x + dxPct,
      y: bgBaseLayout.current.y + dyPct,
    });
    if (persistLayoutToMobile) {
      applyMobilePatch({ backgroundLayout: next });
      return;
    }
    setHeroLayout(next);
  };

  const handleBackgroundDragUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!bgDragStart.current) {
      return;
    }
    bgDragStart.current = null;
    setLayoutDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (persistLayoutToMobile) {
      setHeroMobileOverrides((prev) => {
        void persistHeroVisualPatch({ mobile: prev });
        return prev;
      });
      return;
    }
    setHeroLayout((cur) => {
      const clamped = clampBackgroundLayout(cur);
      void persistHeroVisualPatch({ heroLayout: clamped });
      return clamped;
    });
  };

  const handleLovedSectionDragDown = (event: React.PointerEvent<HTMLElement>) => {
    if ((!canEditLayout && !canEditMobilePreview) || adminEditLayer !== "loved-section") {
      return;
    }
    setLayoutDragging(true);
    lovedDragStartY.current = event.clientY;
    lovedBaseOffsetY.current = persistLayoutToMobile
      ? mobileEffective.lovedDividerOffsetY
      : lovedDividerOffsetY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleLovedSectionDragMove = (event: React.PointerEvent<HTMLElement>) => {
    if (
      (!canEditLayout && !canEditMobilePreview) ||
      lovedDragStartY.current === null ||
      adminEditLayer !== "loved-section"
    ) {
      return;
    }
    const dy = event.clientY - lovedDragStartY.current;
    const next = Math.max(-800, Math.min(800, Math.round(lovedBaseOffsetY.current + dy)));
    if (persistLayoutToMobile) {
      applyMobilePatch({ lovedDividerOffsetY: next });
      return;
    }
    lovedDividerOffsetRef.current = next;
    setLovedDividerOffsetY(next);
  };

  const handleLovedSectionDragUp = (event: React.PointerEvent<HTMLElement>) => {
    if (lovedDragStartY.current === null) {
      return;
    }
    lovedDragStartY.current = null;
    setLayoutDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (persistLayoutToMobile) {
      setHeroMobileOverrides((prev) => {
        void persistHeroVisualPatch({ mobile: prev });
        return prev;
      });
      return;
    }
    lovedPositionCustomizedRef.current = true;
    void persistHeroVisualPatch({
      lovedDividerOffsetY: lovedDividerOffsetRef.current,
      lovedFlowOffsetPx: lovedFlowOffsetRef.current,
      lovedPositionCustomized: true,
    });
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
      top: `calc(var(--admin-bar-height, 0px) + ${floatingChrome.bottomPx}px)`,
      bottom: "auto",
    };
    if (adminMobilePreviewActive) {
      chrome.right = 16;
      chrome.transform = `translate(${floatingPanelPos.x}px, ${floatingPanelPos.y}px)`;
    } else if (isMobileViewport) {
      chrome.left = floatingChrome.sideInsetPx;
      chrome.right = floatingChrome.sideInsetPx;
      chrome.transform = `translate(${floatingPanelPos.x}px, ${floatingPanelPos.y}px)`;
    } else {
      chrome.right = floatingChrome.sideInsetPx;
      chrome.transform = `translate(${floatingPanelPos.x}px, ${floatingPanelPos.y}px)`;
    }
    return chrome;
  }, [
    floatingPanelMinimized,
    adminMobilePreviewActive,
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
    if (!canEditHeroMediaLayout) {
      return;
    }
    if (layerId === "primary" && adminEditLayer !== "primary") {
      return;
    }
    if (layerId === "overlay" && adminEditLayer !== "overlay") {
      return;
    }
    mediaInteractionLayerRef.current = layerId;
    const baseLayout =
      layerId === "primary"
        ? persistLayoutToMobile
          ? mobileEffective.layout
          : heroMediaLayout
        : persistLayoutToMobile
          ? mobileEffective.overlayLayout
          : heroOverlayLayer.layout;
    mediaDragStart.current = { x: event.clientX, y: event.clientY };
    mediaBaseLayout.current = { ...baseLayout };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleMediaDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canEditHeroMediaLayout || !mediaDragStart.current || mediaResizeStart.current) {
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
    if (persistLayoutToMobile) {
      patchMobileMediaLayout(mediaInteractionLayerRef.current ?? "primary", next);
      return;
    }
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
    const layerId = mediaInteractionLayerRef.current ?? "primary";
    if (persistLayoutToMobile) {
      setHeroMobileOverrides((prev) => {
        void persistHeroVisualPatch({ mobile: prev });
        return prev;
      });
      return;
    }
    if (layerId === "primary") {
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
    if (!canEditHeroMediaLayout) {
      return;
    }
    if (layerId === "primary" && adminEditLayer !== "primary") {
      return;
    }
    if (layerId === "overlay" && adminEditLayer !== "overlay") {
      return;
    }
    event.stopPropagation();
    mediaInteractionLayerRef.current = layerId;
    const baseLayout =
      layerId === "primary"
        ? persistLayoutToMobile
          ? mobileEffective.layout
          : heroMediaLayout
        : persistLayoutToMobile
          ? mobileEffective.overlayLayout
          : heroOverlayLayer.layout;
    mediaResizeStart.current = { x: event.clientX, y: event.clientY };
    mediaBaseLayout.current = { ...baseLayout };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleMediaResizeMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!canEditHeroMediaLayout || !mediaResizeStart.current) {
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
    if (persistLayoutToMobile) {
      patchMobileMediaLayout(mediaInteractionLayerRef.current ?? "primary", next);
      return;
    }
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
    const layerId = mediaInteractionLayerRef.current ?? "primary";
    if (persistLayoutToMobile) {
      setHeroMobileOverrides((prev) => {
        void persistHeroVisualPatch({ mobile: prev });
        return prev;
      });
      return;
    }
    if (layerId === "primary") {
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

  const finishHomepageIntro = useCallback((mode: "end" | "skip" = "end") => {
    setIntroPhase((current) => {
      if (current !== "playing") return current;
      const durationMs = mode === "skip" ? 400 : 4500;
      introFinishTimerRef.current = window.setTimeout(() => {
        setIntroPhase("done");
        introFinishTimerRef.current = null;
      }, durationMs);
      return mode === "skip" ? "skip-fading" : "fading";
    });
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add("homepage-intro-experience");
    body.classList.add("homepage-intro-experience");
    if (!initialSkipIntro) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
    return () => {
      root.classList.remove("homepage-intro-experience");
      body.classList.remove("homepage-intro-experience");
    };
  }, [initialSkipIntro]);

  const skipHomepageIntroNow = useCallback(() => {
    if (introFinishTimerRef.current) {
      window.clearTimeout(introFinishTimerRef.current);
      introFinishTimerRef.current = null;
    }
    const root = document.documentElement;
    const body = document.body;
    root.classList.remove("homepage-intro-active", "homepage-intro-fading", "homepage-intro-skip-fading");
    body.classList.remove("homepage-intro-active", "homepage-intro-fading", "homepage-intro-skip-fading");
    setIntroPhase("done");
  }, []);

  useEffect(() => {
    if (initialSkipIntro) skipHomepageIntroNow();
  }, [initialSkipIntro, skipHomepageIntroNow]);

  useEffect(() => {
    const onShop = () => skipHomepageIntroNow();
    window.addEventListener(SCROLL_TO_SHOP_EVENT, onShop);
    if (typeof window !== "undefined" && (window.location.hash === "#shop" || Boolean(initialProductSearch.trim()))) {
      skipHomepageIntroNow();
    }
    return () => window.removeEventListener(SCROLL_TO_SHOP_EVENT, onShop);
  }, [initialProductSearch, skipHomepageIntroNow]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.toggle("homepage-intro-active", introPhase !== "done");
    body.classList.toggle("homepage-intro-active", introPhase !== "done");
    const isFading = introPhase === "fading" || introPhase === "skip-fading";
    root.classList.toggle("homepage-intro-fading", isFading);
    body.classList.toggle("homepage-intro-fading", isFading);
    root.classList.toggle("homepage-intro-skip-fading", introPhase === "skip-fading");
    body.classList.toggle("homepage-intro-skip-fading", introPhase === "skip-fading");
    if (introPhase === "done") {
      root.style.removeProperty("--homepage-intro-reveal");
      return;
    }

    const setReveal = (reveal: number) => {
      root.style.setProperty("--homepage-intro-reveal", reveal.toFixed(4));
      root.classList.toggle("homepage-intro-scroll-revealed", reveal >= 0.9);
      body.classList.toggle("homepage-intro-scroll-revealed", reveal >= 0.9);
    };

    setReveal(isFading ? 1 : introScrollRevealRef.current);
    if (introPhase === "playing") {
      const fadeDistance = Math.min(320, Math.max(220, window.innerHeight * 0.32));
      const homepageHoldDistance = Math.min(480, Math.max(340, window.innerHeight * 0.5));
      let touchY: number | null = null;

      const applyScrollDelta = (deltaY: number) => {
        let remainingDelta = deltaY;

        if (remainingDelta > 0 && introScrollRevealRef.current < 1) {
          const fadePixelsRemaining = (1 - introScrollRevealRef.current) * fadeDistance;
          const fadePixels = Math.min(remainingDelta, fadePixelsRemaining);
          introScrollRevealRef.current += fadePixels / fadeDistance;
          remainingDelta -= fadePixels;
        } else if (remainingDelta < 0 && introScrollHoldRef.current <= 0) {
          introScrollRevealRef.current = Math.max(
            0,
            introScrollRevealRef.current + remainingDelta / fadeDistance
          );
          remainingDelta = 0;
        }

        if (introScrollRevealRef.current >= 1 && remainingDelta !== 0) {
          introScrollHoldRef.current = Math.min(
            homepageHoldDistance,
            Math.max(0, introScrollHoldRef.current + remainingDelta)
          );
        }

        setReveal(introScrollRevealRef.current);
        if (introScrollHoldRef.current >= homepageHoldDistance) {
          setIntroPhase("done");
        }
      };

      const handleWheel = (event: WheelEvent) => {
        event.preventDefault();
        applyScrollDelta(event.deltaY);
      };
      const handleTouchStart = (event: TouchEvent) => {
        touchY = event.touches[0]?.clientY ?? null;
      };
      const handleTouchMove = (event: TouchEvent) => {
        if (touchY === null || !event.touches[0]) return;
        event.preventDefault();
        const nextY = event.touches[0].clientY;
        applyScrollDelta(touchY - nextY);
        touchY = nextY;
      };

      window.addEventListener("wheel", handleWheel, { passive: false });
      window.addEventListener("touchstart", handleTouchStart, { passive: true });
      window.addEventListener("touchmove", handleTouchMove, { passive: false });

      return () => {
        window.removeEventListener("wheel", handleWheel);
        window.removeEventListener("touchstart", handleTouchStart);
        window.removeEventListener("touchmove", handleTouchMove);
        root.classList.remove(
          "homepage-intro-active",
          "homepage-intro-fading",
          "homepage-intro-skip-fading",
          "homepage-intro-scroll-revealed"
        );
        body.classList.remove(
          "homepage-intro-active",
          "homepage-intro-fading",
          "homepage-intro-skip-fading",
          "homepage-intro-scroll-revealed"
        );
      };
    }

    return () => {
      root.classList.remove(
        "homepage-intro-active",
        "homepage-intro-fading",
        "homepage-intro-scroll-revealed"
      );
      body.classList.remove(
        "homepage-intro-active",
        "homepage-intro-fading",
        "homepage-intro-scroll-revealed"
      );
    };
  }, [introPhase]);

  useEffect(
    () => () => {
      if (introFinishTimerRef.current !== null) {
        window.clearTimeout(introFinishTimerRef.current);
      }
    },
    []
  );

  const { hero, carousel, highlights, brand } = content;
  const heroVideoSrcForRender =
    showMobileLayout && hero.video.mobileSrc?.trim() ? hero.video.mobileSrc.trim() : hero.video.src.trim();
  const heroVideoIsBackground = isYouTubeUrl(heroVideoSrcForRender);
  const hasHeroMedia = Boolean(heroVideoSrcForRender || hero.video.poster);

  useEffect(() => {
    if (!heroVideoIsBackground || heroMediaLayout.y >= 0) return;

    const restoredLayout = { x: 72, y: 50, width: 44, height: 78 };
    const restoredSettings = { ...heroPrimarySettings, scale: 0.68, opacity: 1 };
    setHeroMediaLayout(restoredLayout);
    setHeroPrimarySettings(restoredSettings);
    void persistHeroVisualPatch({
      layout: restoredLayout,
      primarySettings: restoredSettings,
    });
  }, [heroVideoIsBackground, heroMediaLayout.y]);
  const hasOverlayMedia = Boolean(heroOverlayLayer.visible && heroOverlayLayer.src);
  // `hero-bg` adds a full-section darkening overlay via CSS (`.hero-bg::before`).
  // Only enable `hero-bg` when there is actually visible hero media.
  const hasAnyHeroVisualLayer =
    backgroundVisible ||
    (hasHeroMedia && heroPrimarySettings.visible && heroPrimarySettings.opacity > 0.01) ||
    (hasOverlayMedia && heroOverlayLayer.visible && heroOverlayLayer.opacity > 0.01);
  const safeHeroSectionHeight = showMobileLayout ? Math.min(heroSectionHeight, 115) : heroSectionHeight;
  const backgroundLayoutForRender = showMobileLayout
    ? mobileEffective.backgroundLayout
    : heroLayout;
  const mobilePrimaryLayout = showMobileLayout ? mobileEffective.layout : heroMediaLayout;
  const mobileOverlayLayout = showMobileLayout
    ? mobileEffective.overlayLayout
    : heroOverlayLayer.layout;
  const mobilePrimaryScale = showMobileLayout
    ? mobileEffective.primaryScale
    : heroPrimarySettings.scale || 1;
  const mobileOverlayScale = showMobileLayout
    ? mobileEffective.overlayScale
    : heroOverlayLayer.scale || 1;
  const copyWidth = showMobileLayout ? Math.min(mobileEffective.heroCopyWidthVw, 92) : heroCopyWidthVw;
  const headlineSizeForRender = showMobileLayout
    ? mobileEffective.headlineSizeRem
    : headlineSizeRem;
  const eyebrowRenderPos = showMobileLayout ? mobileEffective.eyebrowPos : eyebrowPos;
  const headlineRenderPos = showMobileLayout ? mobileEffective.headlinePos : headlinePos;
  const heroActionsRenderPos = showMobileLayout ? mobileEffective.heroActionsPos : heroActionsPos;
  const heroPromoRenderPos = showMobileLayout ? mobileEffective.heroPromoBannerPos : heroPromoBannerPos;
  const heroPromoTopCmForRender = showMobileLayout
    ? mobileEffective.heroPromoBannerTopCm
    : heroPromoBannerTopCm;
  const heroPromoWidthPctForRender = showMobileLayout
    ? mobileEffective.heroPromoBannerWidthPct
    : heroPromoBannerWidthPct;
  const ritualPositionPct = showMobileLayout
    ? mobileEffective.ritualCarouselPosPct
    : ritualCarouselPosPct;
  const ritualPositionPctForRender = showMobileLayout
    ? mobileEffective.ritualCarouselPosPct
    : ritualCarouselPosPct;
  const ritualLiftPx = ritualCarouselPos.y;
  const lovedDividerForRender = showMobileLayout
    ? mobileEffective.lovedDividerOffsetY
    : lovedDividerOffsetY;
  const lovedFloralOffsetForRender = showMobileLayout
    ? mobileEffective.lovedFloralOffsetY
    : lovedFloralOffsetY;
  const lovedTintOpacityForRender = showMobileLayout
    ? mobileEffective.lovedTintOpacity
    : lovedTintOpacity;
  const ritualCarouselScaleForRender =
    showMobileLayout && !persistLayoutToMobile
      ? mobileEffective.ritualCarouselScale
      : ritualCarouselScale;
  const ritualBandLayoutForRender = showMobileLayout
    ? mobileEffective.ritualBandLayout
    : ritualBandLayout;
  const ritualBandScaleForRender = showMobileLayout
    ? mobileEffective.ritualBandScale
    : ritualBandScale;
  const mobileRitualBandVisible =
    typeof heroMobileOverrides.ritualBandVisible === "boolean"
      ? mobileEffective.ritualBandVisible
      : ritualBandVisibleMobile;
  const previewNav = { brand: content.brand, nav: content.nav };
  const artboardClassName = [
    "hero-artboard",
    useMobileDocumentFlow ? "is-mobile-composed" : "",
    adminDesktopEditActive || mobileNudgeActive ? "is-admin-layout" : "",
    heroMediaEditActive ? "is-editing-hero-media" : "",
    adminEditLayer === "background" ? "is-editing-background" : "",
    adminDragEnabled && adminEditLayer === "headline" ? "is-editing-headline" : "",
    adminDragEnabled && adminEditLayer === "eyebrow" ? "is-editing-eyebrow" : "",
    adminDragEnabled && adminEditLayer === "actions" ? "is-editing-actions" : "",
    adminDragEnabled && adminEditLayer === "promo-banner" ? "is-editing-promo-banner" : "",
    livePromoBanners[0] &&
      isPromoModeEnabled(livePromoBanners[0]) &&
      promoStripHidesHeroPrimary(livePromoBanners[0])
      ? "is-promo-21-9-video"
      : "",
    layoutDragging ? "is-layout-dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const heroSectionStackStyle = {
    position: "relative",
    "--hero-section-stack": heroRitualStackZ,
  } as CSSProperties;
  const mobileArtboardCssVars: CSSProperties = useMobileDocumentFlow
    ? {
        ["--hero-nudge-x" as string]: `${headlineRenderPos.x}px`,
        ["--hero-nudge-y" as string]: `${headlineRenderPos.y}px`,
        ["--hero-eyebrow-nudge-x" as string]: `${eyebrowRenderPos.x}px`,
        ["--hero-eyebrow-nudge-y" as string]: `${eyebrowRenderPos.y}px`,
        ["--hero-actions-nudge-x" as string]: `${heroActionsRenderPos.x}px`,
        ["--hero-actions-nudge-y" as string]: `${heroActionsRenderPos.y}px`,
        ["--hero-media-left" as string]: `${mobilePrimaryLayout.x}%`,
        ["--hero-media-top" as string]: `${mobilePrimaryLayout.y}%`,
        ["--hero-media-width" as string]: `${mobilePrimaryLayout.width}%`,
        ["--hero-media-height" as string]: `${mobilePrimaryLayout.height}%`,
        ["--hero-media-transform" as string]: `translate(-50%, -50%) rotate(${heroPrimarySettings.rotateDeg}deg) scale(${mobilePrimaryScale})`,
        ["--hero-primary-scale" as string]: String(mobilePrimaryScale),
        ["--hero-primary-width-pct" as string]: String(mobilePrimaryLayout.width),
        ["--hero-primary-height-pct" as string]: String(mobilePrimaryLayout.height),
        ["--hero-overlay-left" as string]: `${mobileOverlayLayout.x}%`,
        ["--hero-overlay-top" as string]: `${mobileOverlayLayout.y}%`,
        ["--hero-overlay-width" as string]: `${mobileOverlayLayout.width}%`,
        ["--hero-overlay-height" as string]: `${mobileOverlayLayout.height}%`,
        ["--hero-overlay-transform" as string]: `translate(-50%, -50%) rotate(${heroOverlayLayer.rotateDeg}deg) scale(${mobileOverlayScale})`,
        ["--hero-bg-left" as string]: `${backgroundLayoutForRender.x}%`,
        ["--hero-bg-top" as string]: `${backgroundLayoutForRender.y}%`,
        ["--hero-bg-width" as string]: `${backgroundLayoutForRender.width}%`,
        ["--hero-bg-height" as string]: `${backgroundLayoutForRender.height}%`,
      }
    : showMobileLayout
      ? {
          ["--hero-copy-offset-y" as string]: mobileEffective.heroCopyOffsetY,
          ["--hero-nudge-x" as string]: `${headlineRenderPos.x}px`,
          ["--hero-nudge-y" as string]: `${headlineRenderPos.y}px`,
          ["--hero-actions-nudge-x" as string]: `${heroActionsRenderPos.x}px`,
          ["--hero-actions-nudge-y" as string]: `${heroActionsRenderPos.y}px`,
        }
      : {};
  const heroPrimaryPaintZ = heroPromoStackZ + 1;
  const livePromoStripLayout =
    livePromoBanners[0] && isPromoModeEnabled(livePromoBanners[0])
      ? normalizePromoStripFields(livePromoBanners[0])
      : PROMO_STRIP_DEFAULTS;
  const artboardStackStyle = {
    ["--hero-copy-offset-y" as string]: showMobileLayout ? mobileEffective.heroCopyOffsetY : heroCopyOffsetY,
    ["--hero-promo-top-offset" as string]: `${
      heroPromoTopCmForRender + livePromoStripLayout.stripPositionOffsetCm
    }cm`,
    ["--hero-promo-nudge-x" as string]: `${heroPromoRenderPos.x}px`,
    ["--hero-promo-nudge-y" as string]: `${
      livePromoBanners[0] && isPromoModeEnabled(livePromoBanners[0])
        ? livePromoStripLayout.stripPositionOffsetPx
        : heroPromoRenderPos.y + livePromoStripLayout.stripPositionOffsetPx
    }px`,
    ["--hero-promo-width-pct" as string]: `${heroPromoWidthPctForRender}%`,
    ["--hero-z-background" as string]: String(heroBackgroundStackZ),
    ["--hero-z-promo" as string]: String(heroPromoStackZ),
    ["--hero-z-media" as string]: String(heroMediaStackZ),
    ["--hero-z-primary-product" as string]: String(heroPrimaryPaintZ),
    ["--hero-z-copy" as string]: String(heroCopyStackZ),
    ["--hero-z-rituals" as string]: String(heroRitualStackZ),
    ["--hero-ritual-x-pct" as string]: String(ritualPositionPctForRender.x),
    ["--hero-ritual-y-pct" as string]: String(ritualPositionPctForRender.y),
    ["--hero-headline-size" as string]: `${headlineSizeForRender}rem`,
    ...mobileArtboardCssVars,
  } as CSSProperties;
  const lovedStackStyle = {
    "--loved-z-florals": lovedStackZToPaintZ(lovedFloralsStackZ),
    "--loved-z-wash": lovedStackZToPaintZ(lovedWashStackZ),
    "--loved-z-band": lovedStackZToPaintZ(lovedBandStackZ),
    "--loved-z-content": lovedStackZToPaintZ(lovedContentStackZ),
  } as CSSProperties;
  const heroEyebrowClassName = `eyebrow hero-eyebrow${adminDragEnabled || showMobileLayout ? "" : " scroll-zoom"}`;
  const heroHeadlineClassName = `hero-headline${adminDragEnabled || showMobileLayout ? "" : " scroll-zoom"}`;

  const editHeadlinePos = persistLayoutToMobile ? mobileEffective.headlinePos : headlinePos;
  const editHeroActionsPos = persistLayoutToMobile ? mobileEffective.heroActionsPos : heroActionsPos;
  const editHeroPromoPos = persistLayoutToMobile ? mobileEffective.heroPromoBannerPos : heroPromoBannerPos;
  const editHeroPromoTopCm = persistLayoutToMobile
    ? mobileEffective.heroPromoBannerTopCm
    : heroPromoBannerTopCm;
  const editHeroPromoWidthPct = persistLayoutToMobile
    ? mobileEffective.heroPromoBannerWidthPct
    : heroPromoBannerWidthPct;
  const editPrimaryLayout = persistLayoutToMobile ? mobileEffective.layout : heroMediaLayout;
  const editOverlayLayout = persistLayoutToMobile ? mobileEffective.overlayLayout : heroOverlayLayer.layout;
  const editBackgroundLayout = persistLayoutToMobile ? mobileEffective.backgroundLayout : heroLayout;
  const editPrimaryScale = persistLayoutToMobile ? mobileEffective.primaryScale : heroPrimarySettings.scale || 1;
  const editOverlayScale = persistLayoutToMobile ? mobileEffective.overlayScale : heroOverlayLayer.scale || 1;
  const editEyebrowPos = persistLayoutToMobile ? mobileEffective.eyebrowPos : eyebrowPos;
  const editHeadlineSizeRem = persistLayoutToMobile ? mobileEffective.headlineSizeRem : headlineSizeRem;
  const editRitualCarouselPosPct = persistLayoutToMobile
    ? mobileEffective.ritualCarouselPosPct
    : ritualCarouselPosPct;
  const editRitualCarouselScale = ritualCarouselScaleForRender;
  const editRitualBandLayout = persistLayoutToMobile
    ? mobileEffective.ritualBandLayout
    : ritualBandLayout;
  const editRitualBandScale = persistLayoutToMobile
    ? mobileEffective.ritualBandScale
    : ritualBandScale;
  const editRitualBandVisible = persistLayoutToMobile
    ? mobileEffective.ritualBandVisible
    : ritualBandVisible;
  const editLovedDividerOffsetY = persistLayoutToMobile
    ? mobileEffective.lovedDividerOffsetY
    : lovedDividerOffsetY;
  const editLovedFloralOffsetY = persistLayoutToMobile
    ? mobileEffective.lovedFloralOffsetY
    : lovedFloralOffsetY;
  const editLovedTintOpacity = persistLayoutToMobile
    ? mobileEffective.lovedTintOpacity
    : lovedTintOpacity;

  const setHeadlinePosAndSave = (next: { x: number; y: number }) => {
    headlinePosRef.current = next;
    if (persistLayoutToMobile) {
      applyMobilePatch({ headlinePos: next });
      return;
    }
    setHeadlinePos(next);
    void persistHeroVisualPatch({ headlinePos: next });
  };

  const setHeroActionsPosAndSave = (next: { x: number; y: number }) => {
    heroActionsPosRef.current = next;
    if (persistLayoutToMobile) {
      applyMobilePatch({ heroActionsPos: next });
      return;
    }
    setHeroActionsPos(next);
    void persistHeroVisualPatch({ heroActionsPos: next });
  };

  const setHeroPromoPosAndSave = (next: { x: number; y: number }) => {
    heroPromoBannerPosRef.current = next;
    if (persistLayoutToMobile) {
      applyMobilePatch({ heroPromoBannerPos: next });
      return;
    }
    setHeroPromoBannerPos(next);
    void persistHeroVisualPatch({ heroPromoBannerPos: next });
  };

  const setHeroPromoTopCmAndSave = (nextTopCm: number) => {
    const clamped = Math.max(0, Math.min(40, nextTopCm));
    heroPromoBannerTopCmRef.current = clamped;
    if (persistLayoutToMobile) {
      applyMobilePatch({ heroPromoBannerTopCm: clamped });
      return;
    }
    setHeroPromoBannerTopCm(clamped);
    void persistHeroVisualPatch({ heroPromoBannerTopCm: clamped });
  };

  const setHeroPromoWidthPctAndSave = (nextWidthPct: number) => {
    const clamped = Math.max(40, Math.min(100, nextWidthPct));
    if (persistLayoutToMobile) {
      applyMobilePatch({ heroPromoBannerWidthPct: clamped });
      return;
    }
    setHeroPromoBannerWidthPct(clamped);
    void persistHeroVisualPatch({ heroPromoBannerWidthPct: clamped });
  };

  const displayPromoBanners = useMemo(() => {
    if (livePromoBanners.length === 0) return livePromoBanners;
    if (initialPromoPreview) return livePromoBanners;
    const first = {
      ...livePromoBanners[0],
      heroMarqueeStartOffsetCm,
      heroMarqueeStartOffsetPx,
      heroMarqueeEndOffsetCm,
      heroMarqueeEndOffsetPx,
    };
    return [first, ...livePromoBanners.slice(1)];
  }, [
    heroMarqueeEndOffsetCm,
    heroMarqueeEndOffsetPx,
    heroMarqueeStartOffsetCm,
    heroMarqueeStartOffsetPx,
    initialPromoPreview,
    livePromoBanners,
  ]);

  const editPromoStrip = displayPromoBanners[0]
    ? normalizePromoStripFields(displayPromoBanners[0])
    : PROMO_STRIP_DEFAULTS;

  const heroPromoBanners = useMemo(() => {
    const selected = (promoEditorOpen ? promoEditorBanners : displayPromoBanners)[0];
    const enabled = promoEditorOpen && promoEditorModeOverride !== null
      ? promoEditorModeOverride
      : isPromoModeEnabled(selected);
    return selected && enabled ? [selected] : [];
  }, [displayPromoBanners, promoEditorBanners, promoEditorModeOverride, promoEditorOpen]);

  const persistLivePromoStrip = useCallback(async (banner: PromoBanner) => {
    const strip = normalizePromoStripFields(banner);
    const res = await fetch("/api/promos", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...banner,
        ...strip,
      }),
    });
    if (!res.ok) {
      setSaveStatus("error");
      return;
    }
    const data = (await res.json().catch(() => null)) as { banner?: PromoBanner } | null;
    if (data?.banner) {
      livePromoBannersRef.current = [
        data.banner,
        ...livePromoBannersRef.current.filter((item) => item.id !== data.banner?.id),
      ];
      setLivePromoBanners(livePromoBannersRef.current);
    }
  }, []);

  const patchLivePromoStrip = useCallback(
    (patch: Partial<PromoBanner>) => {
      const banner = livePromoBannersRef.current[0];
      if (!banner) return;
      const nextBanner: PromoBanner = {
        ...banner,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      livePromoBannersRef.current = [nextBanner, ...livePromoBannersRef.current.slice(1)];
      setLivePromoBanners(livePromoBannersRef.current);
      if (promoPatchTimerRef.current !== null) {
        window.clearTimeout(promoPatchTimerRef.current);
      }
      promoPatchTimerRef.current = window.setTimeout(() => {
        const latest = livePromoBannersRef.current[0];
        if (latest) void persistLivePromoStrip(latest);
      }, 250);
    },
    [persistLivePromoStrip]
  );

  const snapPromoBetweenHeadlineAndActions = useCallback(() => {
    const artboard = heroArtboardRef.current;
    const headline = headlineElRef.current;
    const actions = heroActionsElRef.current;
    const promo = heroPromoElRef.current;
    if (!artboard || !headline || !actions || !promo) {
      return;
    }
    const artboardRect = artboard.getBoundingClientRect();
    const headlineRect = headline.getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    const promoRect = promo.getBoundingClientRect();
    const targetCenterY = (headlineRect.bottom + actionsRect.top) / 2;
    const promoTopPx = targetCenterY - promoRect.height / 2 - artboardRect.top;
    const anchorPct = showMobileLayout ? 0.22 : 0.14;
    const copyOffsetRaw = showMobileLayout ? mobileEffective.heroCopyOffsetY : heroCopyOffsetY;
    let copyOffsetPx = 0;
    const trimmed = copyOffsetRaw.trim();
    const cmMatch = trimmed.match(/^([\d.]+)cm$/);
    const pxMatch = trimmed.match(/^([\d.]+)px$/);
    if (cmMatch) {
      copyOffsetPx = parseFloat(cmMatch[1]) * 37.7952755906;
    } else if (pxMatch) {
      copyOffsetPx = parseFloat(pxMatch[1]);
    }
    const baseTopPx = artboardRect.height * anchorPct + copyOffsetPx;
    const remainderPx = promoTopPx - baseTopPx - heroPromoRenderPos.y;
    const remainderCm = remainderPx / 37.7952755906;
    setHeroPromoTopCmAndSave(remainderCm);
  }, [
    heroCopyOffsetY,
    heroPromoRenderPos.y,
    mobileEffective.heroCopyOffsetY,
    setHeroPromoTopCmAndSave,
    showMobileLayout,
  ]);

  const centerMobileLayerInFrame = useCallback(
    (
      element: HTMLElement | null,
      current: { x: number; y: number },
      axis: "x" | "y"
    ): { x: number; y: number } => {
      const frame = adminMobilePreviewFrameRef.current;
      if (!useMobileDocumentFlow || !mobileNudgeActive || !element || !frame) {
        return {
          x: axis === "y" ? current.x : 0,
          y: axis === "x" ? current.y : 0,
        };
      }
      const frameRect = frame.getBoundingClientRect();
      const elRect = element.getBoundingClientRect();
      if (axis === "x") {
        const frameCenterX = frameRect.left + frameRect.width / 2;
        const elCenterX = elRect.left + elRect.width / 2;
        return { ...current, x: Math.round(current.x + (frameCenterX - elCenterX)) };
      }
      const frameCenterY = frameRect.top + frameRect.height / 2;
      const elCenterY = elRect.top + elRect.height / 2;
      return { ...current, y: Math.round(current.y + (frameCenterY - elCenterY)) };
    },
    [mobileNudgeActive, useMobileDocumentFlow]
  );

  const mobileNudgeTransformStyle = (
    x: number,
    y: number,
    target: "headline" | "actions" = "headline"
  ): CSSProperties | undefined => {
    if (!showMobileLayout) {
      return undefined;
    }
    if (useMobileDocumentFlow && !mobileNudgeActive) {
      return undefined;
    }
    if (useMobileDocumentFlow && mobileNudgeActive) {
      return {
        position: "relative",
        left: `${x}px`,
        top: `${y}px`,
      };
    }
    if (target === "actions") {
      return {
        ["--hero-actions-nudge-x" as string]: `${x}px`,
        ["--hero-actions-nudge-y" as string]: `${y}px`,
      };
    }
    return heroNudgeStyle(x, y);
  };

  const setPrimaryScaleAndSave = (nextScale: number) => {
    const scale = Math.min(3, Math.max(0.1, nextScale));
    if (persistLayoutToMobile) {
      applyMobilePatch({ primaryScale: scale });
      return;
    }
    setPrimarySettingsAndSave({ ...heroPrimarySettings, scale });
  };

  const setOverlayScaleAndSave = (nextScale: number) => {
    const scale = Math.min(3, Math.max(0.1, nextScale));
    if (persistLayoutToMobile) {
      applyMobilePatch({ overlayScale: scale });
      return;
    }
    setOverlayLayerAndSave({ ...heroOverlayLayer, scale });
  };

  const clampRitualCarouselPosPct = (pos: { x: number; y: number }) => ({
    x: Math.min(100, Math.max(0, pos.x)),
    y: persistLayoutToMobile
      ? Math.min(150, Math.max(0, pos.y))
      : Math.min(100, Math.max(0, pos.y)),
  });

  const setRitualCarouselPosPctAndSave = (next: { x: number; y: number }) => {
    const clamped = clampRitualCarouselPosPct(next);
    if (persistLayoutToMobile) {
      applyMobilePatch({ ritualCarouselPosPct: clamped });
      return;
    }
    setRitualCarouselPosPct(clamped);
    void persistHeroVisualPatch({ ritualCarouselPosPct: clamped });
  };

  const setLovedDividerOffsetYAndSave = (next: number) => {
    lovedPositionCustomizedRef.current = true;
    if (persistLayoutToMobile) {
      applyMobilePatch({ lovedDividerOffsetY: next });
      return;
    }
    lovedDividerOffsetRef.current = next;
    setLovedDividerOffsetY(next);
    void persistHeroVisualPatch({
      lovedDividerOffsetY: next,
      lovedFlowOffsetPx: lovedFlowOffsetRef.current,
      lovedPositionCustomized: true,
    });
  };

  const setLovedFloralOffsetYAndSave = (next: number) => {
    if (persistLayoutToMobile) {
      applyMobilePatch({ lovedFloralOffsetY: next });
      return;
    }
    setLovedFloralOffsetY(next);
    void persistHeroVisualPatch({ lovedFloralOffsetY: next });
  };

  const setLovedTintOpacityAndSave = (next: number) => {
    if (persistLayoutToMobile) {
      applyMobilePatch({ lovedTintOpacity: next });
      return;
    }
    setLovedTintOpacity(next);
    void persistHeroVisualPatch({ lovedTintOpacity: next });
  };

  const setRitualLiftPxAndSave = (nextLiftPx: number) => {
    const clamped = Math.min(240, Math.max(-240, Math.round(nextLiftPx)));
    const next = { ...ritualCarouselPos, y: clamped };
    setRitualCarouselPos(next);
    void persistHeroVisualPatch({ ritualCarouselPos: next });
  };

  const handleRitualDragDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canEditRitualPosition) {
      return;
    }
    ritualDragStart.current = { x: event.clientX, y: event.clientY };
    ritualBasePct.current = persistLayoutToMobile
      ? { ...mobileEffective.ritualCarouselPosPct }
      : { ...ritualCarouselPosPct };
    setLayoutDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleRitualDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canEditRitualPosition || !ritualDragStart.current) {
      return;
    }
    const artboard = heroArtboardRef.current;
    if (!artboard) {
      return;
    }
    const rect = artboard.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      return;
    }
    const dx = event.clientX - ritualDragStart.current.x;
    const dy = event.clientY - ritualDragStart.current.y;
    const basePx = {
      x: (ritualBasePct.current.x / 100) * rect.width,
      y: (ritualBasePct.current.y / 100) * rect.height,
    };
    const nextPct = ritualCarouselPxToPct(
      { x: basePx.x + dx, y: basePx.y + dy },
      { width: rect.width, height: rect.height }
    );
    setRitualCarouselPosPctAndSave(nextPct);
  };

  const handleRitualDragUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (ritualDragStart.current === null) {
      return;
    }
    ritualDragStart.current = null;
    setLayoutDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const clampRitualBandLayout = (layout: HeroMediaLayout): HeroMediaLayout => ({
    x: Math.min(100, Math.max(0, layout.x)),
    y: Math.min(100, Math.max(-200, layout.y)),
    width: Math.min(160, Math.max(20, layout.width)),
    height: Math.min(50, Math.max(6, layout.height)),
  });

  const setRitualBandLayoutAndSave = (next: HeroMediaLayout) => {
    if (persistLayoutToMobile) {
      applyMobilePatch({ ritualBandLayout: clampMobileRitualBandLayout(next) });
      return;
    }
    const clamped = clampRitualBandLayout(next);
    setRitualBandLayout(clamped);
    scheduleRitualBandLayoutServerSave(clamped);
  };

  const handleRitualBandDragDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canEditRitualBand) {
      return;
    }
    ritualBandDragStart.current = { x: event.clientX, y: event.clientY };
    ritualBandBaseLayout.current = { ...editRitualBandLayout };
    setLayoutDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleRitualBandDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canEditRitualBand || !ritualBandDragStart.current) {
      return;
    }
    const stackEl = event.currentTarget.closest<HTMLElement>(".hero-ritual-panel.is-mobile-stack-panel");
    const boundsEl = persistLayoutToMobile ? stackEl : heroArtboardRef.current;
    if (!boundsEl) {
      return;
    }
    const rect = boundsEl.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      return;
    }
    const dx = event.clientX - ritualBandDragStart.current.x;
    const dy = event.clientY - ritualBandDragStart.current.y;
    const boundsWidth = persistLayoutToMobile ? MOBILE_DESIGN_WIDTH_PX : rect.width;
    const stackHeight = persistLayoutToMobile
      ? MOBILE_RITUAL_STACK_REF_HEIGHT_PX
      : stackEl?.getBoundingClientRect().height ?? rect.height;
    const nextPct = ritualCarouselPxToPct(
      {
        x: (ritualBandBaseLayout.current.x / 100) * boundsWidth + dx,
        y: (ritualBandBaseLayout.current.y / 100) * stackHeight + dy,
      },
      { width: boundsWidth, height: stackHeight }
    );
    setRitualBandLayoutAndSave({
      ...ritualBandBaseLayout.current,
      x: nextPct.x,
      y: nextPct.y,
    });
  };

  const handleRitualBandDragUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (ritualBandDragStart.current === null) {
      return;
    }
    ritualBandDragStart.current = null;
    setLayoutDragging(false);
    if (!persistLayoutToMobile) {
      flushImmediateRitualBandServerSave();
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const renderCentreButtons = (
    onCentreH: () => void,
    onCentreV: () => void,
  ) => (
    <div className="floating-admin-centre-row">
      <button type="button" className="button secondary" onClick={onCentreH}>
        Centre horizontally
      </button>
      <button type="button" className="button secondary" onClick={onCentreV}>
        Centre vertically
      </button>
    </div>
  );

  const setHeroStackZAndSave = (next: {
    heroBackgroundStackZ?: number;
    heroMediaStackZ?: number;
    heroRitualStackZ?: number;
    heroRitualBandStackZ?: number;
    heroCopyStackZ?: number;
    heroPromoStackZ?: number;
    lovedFloralsStackZ?: number;
    lovedWashStackZ?: number;
    lovedBandStackZ?: number;
    lovedContentStackZ?: number;
  }) => {
    const patch: HeroVisualApiState = {};
    if (typeof next.heroBackgroundStackZ === "number") {
      const clamped = clampHeroLayerDepth(next.heroBackgroundStackZ, heroBackgroundStackZ);
      setHeroBackgroundStackZ(clamped);
      patch.heroBackgroundStackZ = clamped;
    }
    if (typeof next.heroMediaStackZ === "number") {
      const clamped = clampHeroLayerDepth(next.heroMediaStackZ, heroMediaStackZ);
      setHeroMediaStackZ(clamped);
      patch.heroMediaStackZ = clamped;
    }
    if (typeof next.heroRitualStackZ === "number") {
      const clamped = clampHeroLayerDepth(next.heroRitualStackZ, heroRitualStackZ);
      setHeroRitualStackZ(clamped);
      patch.heroRitualStackZ = clamped;
      patch.ritualCarouselStackRev = RITUAL_CAROUSEL_STACK_REV;
    }
    if (typeof next.heroRitualBandStackZ === "number") {
      const clamped = clampHeroLayerDepth(next.heroRitualBandStackZ, heroRitualBandStackZ);
      setHeroRitualBandStackZ(clamped);
      patch.heroRitualBandStackZ = clamped;
    }
    if (typeof next.heroCopyStackZ === "number") {
      const clamped = clampHeroLayerDepth(next.heroCopyStackZ, heroCopyStackZ);
      setHeroCopyStackZ(clamped);
      patch.heroCopyStackZ = clamped;
    }
    if (typeof next.heroPromoStackZ === "number") {
      const clamped = clampHeroLayerDepth(next.heroPromoStackZ, heroPromoStackZ);
      setHeroPromoStackZ(clamped);
      patch.heroPromoStackZ = clamped;
    }
    if (typeof next.lovedFloralsStackZ === "number") {
      const clamped = clampHeroLayerDepth(next.lovedFloralsStackZ, lovedFloralsStackZ);
      setLovedFloralsStackZ(clamped);
      patch.lovedFloralsStackZ = clamped;
    }
    if (typeof next.lovedWashStackZ === "number") {
      const clamped = clampHeroLayerDepth(next.lovedWashStackZ, lovedWashStackZ);
      setLovedWashStackZ(clamped);
      patch.lovedWashStackZ = clamped;
    }
    if (typeof next.lovedBandStackZ === "number") {
      const clamped = clampHeroLayerDepth(next.lovedBandStackZ, lovedBandStackZ);
      setLovedBandStackZ(clamped);
      patch.lovedBandStackZ = clamped;
    }
    if (typeof next.lovedContentStackZ === "number") {
      const clamped = clampHeroLayerDepth(next.lovedContentStackZ, lovedContentStackZ);
      setLovedContentStackZ(clamped);
      patch.lovedContentStackZ = clamped;
    }
    if (Object.keys(patch).length > 0) {
      void persistHeroVisualPatch(patch);
    }
  };

  const heroStackValues = () => ({
    background: heroBackgroundStackZ,
    media: heroMediaStackZ,
    copy: heroCopyStackZ,
    promo: heroPromoStackZ,
    ritualBand: heroRitualBandStackZ,
    rituals: heroRitualStackZ,
  });

  const lovedStackValues = () => ({
    florals: lovedFloralsStackZ,
    wash: lovedWashStackZ,
    band: lovedBandStackZ,
    content: lovedContentStackZ,
  });

  const stackOrderLayerKey = (layer: StackOrderLayerId): keyof ReturnType<typeof heroStackValues> | keyof ReturnType<typeof lovedStackValues> => {
    if (layer === "background") return "background";
    if (layer === "headline" || layer === "eyebrow" || layer === "actions") return "copy";
    if (layer === "promo-banner") return "promo";
    if (layer === "ritual-band") return "ritualBand";
    if (layer === "rituals") return "rituals";
    if (layer === "loved-florals") return "florals";
    if (layer === "loved-wash") return "wash";
    if (layer === "loved-band") return "band";
    return "content";
  };

  const isLovedStackLayer = (layer: StackOrderLayerId) =>
    layer === "loved-florals" || layer === "loved-wash" || layer === "loved-band" || layer === "loved-section";

  const getStackZForLayer = (layer: StackOrderLayerId): number => {
    const key = stackOrderLayerKey(layer);
    if (isLovedStackLayer(layer)) {
      return lovedStackValues()[key as keyof ReturnType<typeof lovedStackValues>];
    }
    return heroStackValues()[key as keyof ReturnType<typeof heroStackValues>];
  };

  const setStackZForLayer = (layer: StackOrderLayerId, nextZ: number) => {
    const key = stackOrderLayerKey(layer);
    if (isLovedStackLayer(layer)) {
      const patch: Parameters<typeof setHeroStackZAndSave>[0] = {};
      if (key === "florals") patch.lovedFloralsStackZ = nextZ;
      if (key === "wash") patch.lovedWashStackZ = nextZ;
      if (key === "band") patch.lovedBandStackZ = nextZ;
      if (key === "content") patch.lovedContentStackZ = nextZ;
      setHeroStackZAndSave(patch);
      return;
    }
    const patch: Parameters<typeof setHeroStackZAndSave>[0] = {};
    if (key === "background") patch.heroBackgroundStackZ = nextZ;
    if (key === "media") patch.heroMediaStackZ = nextZ;
    if (key === "copy") patch.heroCopyStackZ = nextZ;
    if (key === "promo") patch.heroPromoStackZ = nextZ;
    if (key === "ritualBand") patch.heroRitualBandStackZ = nextZ;
    if (key === "rituals") patch.heroRitualStackZ = nextZ;
    setHeroStackZAndSave(patch);
  };

  const moveStackLayerForward = (layer: StackOrderLayerId) => {
    const current = getStackZForLayer(layer);
    if (current < HERO_LAYER_DEPTH_MAX) {
      setStackZForLayer(layer, current + 1);
    }
  };

  const moveStackLayerBackward = (layer: StackOrderLayerId) => {
    const current = getStackZForLayer(layer);
    if (current > HERO_LAYER_DEPTH_MIN) {
      setStackZForLayer(layer, current - 1);
    }
  };

  const moveStackLayerToFront = (layer: StackOrderLayerId) => {
    setStackZForLayer(layer, HERO_LAYER_DEPTH_MAX);
  };

  const moveStackLayerToBack = (layer: StackOrderLayerId) => {
    setStackZForLayer(layer, HERO_LAYER_DEPTH_MIN);
  };

  const renderStackZSlider = (layer: StackOrderLayerId) => {
    const z = getStackZForLayer(layer);
    const sliderId = `stack-depth-${layer}`;
    return (
      <label className="floating-admin-z-slider" htmlFor={sliderId}>
        Stack depth (1 = back, 10 = front)
        <input
          id={sliderId}
          type="range"
          min={HERO_LAYER_DEPTH_MIN}
          max={HERO_LAYER_DEPTH_MAX}
          step={1}
          value={z}
          onChange={(e) => setStackZForLayer(layer, Number(e.target.value))}
        />
        <span>{z}</span>
      </label>
    );
  };

  const renderMediaZSlider = (kind: HeroLayerId) => {
    const z = heroMediaStackZ;
    return (
      <label className="floating-admin-z-slider">
        Stack depth (1 = back, 10 = front)
        <input
          type="range"
          min={HERO_LAYER_DEPTH_MIN}
          max={HERO_LAYER_DEPTH_MAX}
          step={1}
          value={z}
          onChange={(e) => {
            const nextZ = clampHeroLayerDepth(Number(e.target.value), z);
            setHeroStackZAndSave({ heroMediaStackZ: nextZ });
            if (kind === "primary" && hasOverlayMedia) {
              setPrimarySettingsAndSave({
                ...heroPrimarySettings,
                zIndex: clampHeroLayerDepth(
                  Math.max(nextZ, heroOverlayLayer.zIndex + 1),
                  heroPrimarySettings.zIndex
                ),
              });
            } else if (kind === "overlay" && nextZ >= heroPrimarySettings.zIndex) {
              setOverlayLayerAndSave({
                ...heroOverlayLayer,
                zIndex: clampHeroLayerDepth(
                  Math.min(nextZ, heroPrimarySettings.zIndex - 1),
                  heroOverlayLayer.zIndex
                ),
              });
            }
          }}
        />
        <span>{z}</span>
      </label>
    );
  };

  const toggleRitualBandVisible = () => {
    const next = !ritualBandVisible;
    setRitualBandVisible(next);
    void persistHeroVisualPatch({ ritualBandVisible: next });
  };

  const toggleRitualBandVisibleMobile = () => {
    if (persistLayoutToMobile) {
      applyMobilePatch({ ritualBandVisible: !editRitualBandVisible });
      return;
    }
    const next = !ritualBandVisibleMobile;
    setRitualBandVisibleMobile(next);
    void persistHeroVisualPatch({ ritualBandVisibleMobile: next });
  };

  const showMobileRitualBand = mobileRitualBandVisible;

  const renderRitualBandControls = () => (
    <div className="floating-admin-ritual-controls">
      <p className="floating-admin-section-title">Carousel band</p>
      <div className="floating-admin-layer-row">
        {persistLayoutToMobile ? (
          <button type="button" className="button secondary" onClick={toggleRitualBandVisibleMobile}>
            {editRitualBandVisible ? "Hide band (mobile)" : "Show band (mobile)"}
          </button>
        ) : (
          <button type="button" className="button secondary" onClick={toggleRitualBandVisible}>
            {editRitualBandVisible ? "Hide band (desktop)" : "Show band (desktop)"}
          </button>
        )}
      </div>
      <label>
        X (%)
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={editRitualBandLayout.x}
          onChange={(e) =>
            setRitualBandLayoutAndSave({ ...editRitualBandLayout, x: Number(e.target.value) })
          }
          onMouseUp={persistLayoutToMobile ? undefined : flushImmediateRitualBandServerSave}
          onTouchEnd={persistLayoutToMobile ? undefined : flushImmediateRitualBandServerSave}
        />
        <span>{editRitualBandLayout.x.toFixed(1)}%</span>
      </label>
      <label>
        Y (%; negative moves up toward carousel)
        <input
          type="range"
          min={persistLayoutToMobile ? -200 : 0}
          max={100}
          step={0.5}
          value={editRitualBandLayout.y}
          onChange={(e) =>
            setRitualBandLayoutAndSave({ ...editRitualBandLayout, y: Number(e.target.value) })
          }
          onMouseUp={persistLayoutToMobile ? undefined : flushImmediateRitualBandServerSave}
          onTouchEnd={persistLayoutToMobile ? undefined : flushImmediateRitualBandServerSave}
        />
        <span>{editRitualBandLayout.y.toFixed(1)}%</span>
      </label>
      <label>
        Width (% of viewport)
        <input
          type="range"
          min={persistLayoutToMobile ? 60 : 20}
          max={160}
          step={0.5}
          value={editRitualBandLayout.width}
          onChange={(e) =>
            setRitualBandLayoutAndSave({ ...editRitualBandLayout, width: Number(e.target.value) })
          }
          onMouseUp={persistLayoutToMobile ? undefined : flushImmediateRitualBandServerSave}
          onTouchEnd={persistLayoutToMobile ? undefined : flushImmediateRitualBandServerSave}
        />
        <span>{editRitualBandLayout.width.toFixed(1)}%</span>
      </label>
      <label>
        Height (%)
        <input
          type="range"
          min={persistLayoutToMobile ? 28 : 6}
          max={persistLayoutToMobile ? 75 : 50}
          step={0.5}
          value={editRitualBandLayout.height}
          onChange={(e) =>
            setRitualBandLayoutAndSave({ ...editRitualBandLayout, height: Number(e.target.value) })
          }
          onMouseUp={persistLayoutToMobile ? undefined : flushImmediateRitualBandServerSave}
          onTouchEnd={persistLayoutToMobile ? undefined : flushImmediateRitualBandServerSave}
        />
        <span>{editRitualBandLayout.height.toFixed(1)}%</span>
      </label>
      <label>
        Scale
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.02}
          value={editRitualBandScale}
          onChange={(e) => {
            const next = Math.min(2, Math.max(0.5, Number(e.target.value)));
            if (persistLayoutToMobile) {
              applyMobilePatch({ ritualBandScale: next, ritualCarouselScale: next });
              return;
            }
            setRitualBandScale(next);
            void persistHeroVisualPatch({ ritualBandScale: next });
          }}
        />
        <span>{editRitualBandScale.toFixed(2)}×</span>
      </label>
      <label>
        Opacity
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={ritualBandOpacity}
          onChange={(e) => {
            const next = Math.min(1, Math.max(0, Number(e.target.value)));
            setRitualBandOpacity(next);
            void persistHeroVisualPatch({ ritualBandOpacity: next });
          }}
        />
        <span>{Math.round(ritualBandOpacity * 100)}%</span>
      </label>
      <label>
        Color
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/i.test(ritualBandColor) ? ritualBandColor : "#ffffff"}
          onChange={(e) => {
            const next = e.target.value;
            setRitualBandColor(next);
            void persistHeroVisualPatch({ ritualBandColor: next });
          }}
        />
        <input
          type="text"
          value={ritualBandColor}
          spellCheck={false}
          aria-label="Carousel band color hex"
          onChange={(e) => {
            const next = e.target.value.trim();
            setRitualBandColor(next);
            if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(next)) {
              void persistHeroVisualPatch({ ritualBandColor: next });
            }
          }}
        />
      </label>
      <p className="floating-admin-section-title">Band stack depth</p>
      {renderStackLayerOrderButtons("ritual-band")}
      <span className="floating-admin-hint" style={{ fontSize: "0.72rem" }}>
        Stack depth orders the band vs hero and carousel only. It does not change Height %.
      </span>
    </div>
  );

  const renderRitualCarouselControls = () => (
    <div className="floating-admin-ritual-controls">
      <p className="floating-admin-section-title">Carousel position</p>
      <label>
        X (% of hero width){" "}
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={editRitualCarouselPosPct.x}
          onChange={(e) => {
            setRitualCarouselPosPctAndSave({
              ...editRitualCarouselPosPct,
              x: Number(e.target.value),
            });
          }}
        />{" "}
        <span>{editRitualCarouselPosPct.x.toFixed(1)}%</span>
      </label>
      <label>
        Y (% of hero height){" "}
        <input
          type="range"
          min={0}
          max={persistLayoutToMobile ? 150 : 100}
          step={0.5}
          value={editRitualCarouselPosPct.y}
          onChange={(e) => {
            setRitualCarouselPosPctAndSave({
              ...editRitualCarouselPosPct,
              y: Number(e.target.value),
            });
          }}
        />{" "}
        <span>{editRitualCarouselPosPct.y.toFixed(1)}%</span>
      </label>
      {renderCentreButtons(
        () => setRitualCarouselPosPctAndSave({ ...editRitualCarouselPosPct, x: 50 }),
        () => setRitualCarouselPosPctAndSave({ ...editRitualCarouselPosPct, y: 50 }),
      )}
      <label>
        Fine lift (px; nudge above/below florals)
        <input
          type="range"
          min={-240}
          max={240}
          step={1}
          value={ritualLiftPx}
          onChange={(e) => setRitualLiftPxAndSave(Number(e.target.value))}
        />
        <span>{ritualLiftPx}px</span>
      </label>
      <label>
        Scale
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.02}
          value={editRitualCarouselScale}
          onChange={(e) => {
            const next = Math.min(2, Math.max(0.5, Number(e.target.value)));
            setRitualCarouselScale(next);
            if (persistLayoutToMobile) {
              applyMobilePatch({ ritualCarouselScale: next });
            }
            void persistHeroVisualPatch({ ritualCarouselScale: next });
          }}
        />
        <span>{editRitualCarouselScale.toFixed(2)}×</span>
      </label>
      <p className="floating-admin-section-title">Carousel stack depth</p>
      {renderStackLayerOrderButtons("rituals")}
      <span className="floating-admin-hint">
        Page order: hero {pageShellPaintZ.hero}, band {pageShellPaintZ["ritual-band"]}, carousel{" "}
        {pageShellPaintZ.rituals}, loved {pageShellPaintZ.loved}.
      </span>
    </div>
  );

  const renderStackLayerOrderButtons = (layer: StackOrderLayerId) => (
    <div className="floating-admin-layer-stack">
      {renderStackZSlider(layer)}
      <div className="floating-admin-layer-row">
        <span className="floating-admin-layer-label">Layer order</span>
        <button type="button" className="button secondary" onClick={() => moveStackLayerBackward(layer)}>
          Backward
        </button>
        <button type="button" className="button secondary" onClick={() => moveStackLayerForward(layer)}>
          Forward
        </button>
        <button type="button" className="button secondary" onClick={() => moveStackLayerToBack(layer)}>
          To back
        </button>
        <button type="button" className="button secondary" onClick={() => moveStackLayerToFront(layer)}>
          To front
        </button>
      </div>
    </div>
  );

  const moveMediaLayerForward = (kind: HeroLayerId) => {
    const frameZ = kind === "primary" ? heroPrimarySettings.zIndex : heroOverlayLayer.zIndex;
    const otherZ = kind === "primary" ? heroOverlayLayer.zIndex : heroPrimarySettings.zIndex;
    const otherVisible = kind === "primary" ? hasOverlayMedia : heroPrimarySettings.visible;

    if (otherVisible && kind === "primary" && frameZ < otherZ) {
      setPrimarySettingsAndSave({
        ...heroPrimarySettings,
        zIndex: clampHeroLayerDepth(frameZ + 1, frameZ),
      });
      return;
    }
    if (otherVisible && kind === "overlay" && frameZ <= otherZ) {
      setOverlayLayerAndSave({
        ...heroOverlayLayer,
        zIndex: clampHeroLayerDepth(otherZ + 1, frameZ),
      });
      return;
    }
    if (
      heroMediaStackZ < heroCopyStackZ ||
      heroMediaStackZ < heroRitualStackZ ||
      heroMediaStackZ < heroBackgroundStackZ ||
      heroMediaStackZ < heroPromoStackZ
    ) {
      setHeroStackZAndSave({ heroMediaStackZ: heroMediaStackZ + 1 });
      return;
    }
    if (frameZ < HERO_LAYER_DEPTH_MAX) {
      if (kind === "primary") {
        setPrimarySettingsAndSave({
          ...heroPrimarySettings,
          zIndex: clampHeroLayerDepth(frameZ + 1, frameZ),
        });
      } else {
        setOverlayLayerAndSave({
          ...heroOverlayLayer,
          zIndex: clampHeroLayerDepth(frameZ + 1, frameZ),
        });
      }
    }
  };

  const moveMediaLayerBackward = (kind: HeroLayerId) => {
    const frameZ = kind === "primary" ? heroPrimarySettings.zIndex : heroOverlayLayer.zIndex;
    const otherZ = kind === "primary" ? heroOverlayLayer.zIndex : heroPrimarySettings.zIndex;
    const otherVisible = kind === "primary" ? hasOverlayMedia : heroPrimarySettings.visible;

    if (otherVisible && kind === "overlay" && frameZ > otherZ + 1) {
      setOverlayLayerAndSave({
        ...heroOverlayLayer,
        zIndex: clampHeroLayerDepth(frameZ - 1, frameZ),
      });
      return;
    }
    if (otherVisible && kind === "primary" && frameZ > otherZ && frameZ > HERO_LAYER_DEPTH_MIN) {
      setPrimarySettingsAndSave({
        ...heroPrimarySettings,
        zIndex: clampHeroLayerDepth(frameZ - 1, frameZ),
      });
      return;
    }
    if (
      heroMediaStackZ > heroCopyStackZ ||
      heroMediaStackZ > heroRitualStackZ ||
      heroMediaStackZ > heroBackgroundStackZ ||
      heroMediaStackZ > heroPromoStackZ
    ) {
      if (heroMediaStackZ > HERO_LAYER_DEPTH_MIN) {
        setHeroStackZAndSave({ heroMediaStackZ: heroMediaStackZ - 1 });
        return;
      }
    }
    if (frameZ > HERO_LAYER_DEPTH_MIN) {
      if (kind === "primary") {
        setPrimarySettingsAndSave({
          ...heroPrimarySettings,
          zIndex: clampHeroLayerDepth(frameZ - 1, frameZ),
        });
      } else {
        setOverlayLayerAndSave({
          ...heroOverlayLayer,
          zIndex: clampHeroLayerDepth(frameZ - 1, frameZ),
        });
      }
    }
  };

  const moveMediaLayerToFront = (kind: HeroLayerId) => {
    setHeroStackZAndSave({ heroMediaStackZ: HERO_LAYER_DEPTH_MAX });
    if (kind === "primary") {
      const nextZ = hasOverlayMedia
        ? clampHeroLayerDepth(heroOverlayLayer.zIndex + 1, HERO_LAYER_DEPTH_MAX)
        : HERO_LAYER_DEPTH_MAX;
      setPrimarySettingsAndSave({ ...heroPrimarySettings, zIndex: nextZ });
      return;
    }
    setOverlayLayerAndSave({ ...heroOverlayLayer, zIndex: HERO_LAYER_DEPTH_MAX });
  };

  const moveMediaLayerToBack = (kind: HeroLayerId) => {
    setHeroStackZAndSave({ heroMediaStackZ: HERO_LAYER_DEPTH_MIN });
    if (kind === "primary") {
      setPrimarySettingsAndSave({ ...heroPrimarySettings, zIndex: HERO_LAYER_DEPTH_MIN });
      return;
    }
    setOverlayLayerAndSave({ ...heroOverlayLayer, zIndex: HERO_LAYER_DEPTH_MIN });
  };

  const renderLayerOrderButtons = (kind: HeroLayerId) => (
    <div className="floating-admin-layer-stack">
      {renderMediaZSlider(kind)}
      <div className="floating-admin-layer-row">
        <span className="floating-admin-layer-label">Layer order</span>
        <button type="button" className="button secondary" onClick={() => moveMediaLayerBackward(kind)}>
          Backward
        </button>
        <button type="button" className="button secondary" onClick={() => moveMediaLayerForward(kind)}>
          Forward
        </button>
        <button type="button" className="button secondary" onClick={() => moveMediaLayerToBack(kind)}>
          To back
        </button>
        <button type="button" className="button secondary" onClick={() => moveMediaLayerToFront(kind)}>
          To front
        </button>
      </div>
      {kind === "primary" ? (
        <span className="floating-admin-hint" style={{ fontSize: "0.72rem" }}>
          Stack depth {heroMediaStackZ} · promo {heroPromoStackZ}. Overlay/florals use stack depth.
          The product graphic always sits one layer above the promo strip.
        </span>
      ) : null}
    </div>
  );

  const setHeadlineSizeAndSave = (nextRem: number) => {
    const clamped = Math.min(8, Math.max(1, nextRem));
    if (persistLayoutToMobile) {
      applyMobilePatch({ headlineSizeRem: clamped });
      return;
    }
    setHeadlineSizeRem(clamped);
    void persistHeroVisualPatch({ headlineSizeRem: clamped });
  };

  const heroCopyLayerOffsetStyle = (x: number, y: number): CSSProperties => ({
    position: "relative",
    left: `${x}px`,
    top: `${y}px`
  });

  const heroHeadlineOffsetStyle = (x: number, y: number): CSSProperties => ({
    ...heroCopyLayerOffsetStyle(x, y),
    width: "fit-content",
    maxWidth: "100%",
    alignSelf: "center"
  });

  const heroCopyOffsetStyle = (x: number, y: number): CSSProperties | undefined => {
    if (useMobileDocumentFlow) {
      return undefined;
    }
    return heroCopyLayerOffsetStyle(x, y);
  };

  const heroHeadlineOffsetStyleForRender = (x: number, y: number): CSSProperties | undefined => {
    if (useMobileDocumentFlow) {
      return undefined;
    }
    return heroHeadlineOffsetStyle(x, y);
  };

  const primaryMediaPointerEvents =
    adminDragEnabled && adminEditLayer === "primary" ? "auto" : "none";
  const overlayMediaPointerEvents =
    adminDragEnabled && adminEditLayer === "overlay" ? "auto" : "none";

  const heroMediaFrameLayoutStyle = (
    layout: HeroMediaLayout,
    scale: number,
    rotateDeg: number,
    isOverlay = false
  ): CSSProperties => {
    if (useMobileDocumentFlow && isOverlay) {
      const transform = `translate(-50%, -50%) rotate(${rotateDeg}deg) scale(${scale})`;
      return {
        ["--hero-overlay-left" as string]: `${layout.x}%`,
        ["--hero-overlay-top" as string]: `${layout.y}%`,
        ["--hero-overlay-width" as string]: `${layout.width}%`,
        ["--hero-overlay-height" as string]: `${layout.height}%`,
        ["--hero-overlay-transform" as string]: transform,
      };
    }
    if (useMobileDocumentFlow && !isOverlay) {
      const transform = `translate(-50%, -50%) rotate(${rotateDeg}deg) scale(${scale})`;
      return {
        position: "absolute",
        left: `${layout.x}%`,
        top: `${layout.y}%`,
        width: `${layout.width}%`,
        height: `${layout.height}%`,
        transform,
        ["--hero-media-left" as string]: `${layout.x}%`,
        ["--hero-media-top" as string]: `${layout.y}%`,
        ["--hero-media-width" as string]: `${layout.width}%`,
        ["--hero-media-height" as string]: `${layout.height}%`,
        ["--hero-media-transform" as string]: transform,
      };
    }
    const transform = `translate(-50%, -50%) rotate(${rotateDeg}deg) scale(${scale})`;
    return {
      position: "absolute",
      left: `${layout.x}%`,
      top: `${layout.y}%`,
      width: `${layout.width}%`,
      height: `${layout.height}%`,
      transform,
      ["--hero-media-left" as string]: `${layout.x}%`,
      ["--hero-media-top" as string]: `${layout.y}%`,
      ["--hero-media-width" as string]: `${layout.width}%`,
      ["--hero-media-height" as string]: `${layout.height}%`,
      ["--hero-media-transform" as string]: transform,
    };
  };

  const pageShellPaintZ = resolvePageShellPaintZ({
    heroBackgroundStackZ,
    heroMediaStackZ,
    heroCopyStackZ,
    heroPromoStackZ,
    heroRitualBandStackZ,
    heroRitualStackZ,
    lovedFloralsStackZ,
    lovedWashStackZ,
    lovedBandStackZ,
    lovedContentStackZ,
  });
  const lovedOverlapPaintZ = resolveLovedOverlapPaintZ({
    heroPaintZ: pageShellPaintZ.hero,
    lovedPaintZ: pageShellPaintZ.loved,
    heroPromoStackZ,
    heroMediaStackZ,
    lovedFloralsStackZ,
  });
  const pageStackStyle = {
    ...pageShellStackCssVars(pageShellPaintZ),
    ["--page-layer-z-loved-overlap" as string]: String(lovedOverlapPaintZ),
    ...(useMobileDocumentFlow
      ? {
          ["--mobile-design-width" as string]: `${MOBILE_DESIGN_WIDTH_PX}px`,
          ["--mobile-ritual-card-px" as string]: `${MOBILE_RITUAL_REF_CARD_PX}px`,
        }
      : {}),
  } as CSSProperties;
  const ritualPageLayerHeight =
    ritualPageLayerBounds.height > 0 ? ritualPageLayerBounds.height : showMobileLayout ? 640 : 620;

  /** Band + carousel: document flow on all mobile views; absolute overlay on desktop only. */
  const ritualSharedPageLayerStyle = useMobileDocumentFlow
      ? ({
          position: "relative",
          top: "auto",
          left: 0,
          width: "100%",
          height: "auto",
          pointerEvents: "none",
          overflow: "visible",
        } as CSSProperties)
    : showMobileLayout
      ? ({
          position: "absolute",
          top: ritualPageLayerBounds.top,
          left: 0,
          width: "100%",
          height: ritualPageLayerHeight,
          pointerEvents: "none",
          overflow: "visible",
        } as CSSProperties)
      : ({
          position: "absolute",
          top: ritualPageLayerBounds.top,
          left: "50%",
          width: "100vw",
          marginLeft: "-50vw",
          height: ritualPageLayerHeight,
          pointerEvents: "none",
          overflow: "visible",
        } as CSSProperties);

  const ritualPageLayerStyle = ritualSharedPageLayerStyle;

  const ritualBandPageLayerStyle = ritualSharedPageLayerStyle;

  const mobileFlowRitualBand =
    showMobileLayout && showMobileRitualBand && useMobileDocumentFlow ? (
      <div
        className={`hero-ritual-band is-mobile-flow-band${
          canEditRitualBand ? " is-ritual-band-admin-edit" : ""
        }`}
        style={{
          backgroundColor: ritualBandColor,
          opacity: ritualBandOpacity,
        }}
        aria-hidden="true"
        onPointerDown={canEditRitualBand ? handleRitualBandDragDown : undefined}
        onPointerMove={canEditRitualBand ? handleRitualBandDragMove : undefined}
        onPointerUp={canEditRitualBand ? handleRitualBandDragUp : undefined}
      />
    ) : null;

  const ritualBandLayer =
    ritualsVisible && ritualBandVisible && !showMobileLayout ? (
    <div
      className="hero-ritual-band-page-layer"
      style={{
        ...ritualBandPageLayerStyle,
        ["--ritual-band-scale" as string]: String(ritualBandScale),
      }}
      data-page-layer-z={pageShellPaintZ["ritual-band"]}
    >
      <div
        className={`hero-ritual-band${canEditRitualBand ? " is-ritual-band-admin-edit" : ""}`}
        style={{
          left: `${ritualBandLayoutForRender.x}%`,
          top: `${ritualBandLayoutForRender.y}%`,
          width: `${ritualBandLayoutForRender.width}%`,
          height: `${ritualBandLayoutForRender.height}%`,
          backgroundColor: ritualBandColor,
          opacity: ritualBandOpacity,
          transform: `translateX(-50%) scale(${ritualBandScale})`,
        }}
        aria-hidden="true"
        onPointerDown={canEditRitualBand ? handleRitualBandDragDown : undefined}
        onPointerMove={canEditRitualBand ? handleRitualBandDragMove : undefined}
        onPointerUp={canEditRitualBand ? handleRitualBandDragUp : undefined}
      />
    </div>
  ) : null;

  const ritualCarousel = showMobileLayout ? (
    <RitualFaceTeaser
      products={products}
      positionPct={ritualPositionPctForRender}
      stackZ={heroRitualStackZ}
      scale={ritualCarouselScaleForRender}
      liftPx={ritualLiftPx}
      useArtboardPosition={!useMobileDocumentFlow}
      adminPositionEditable={canEditRitualPosition}
      onAdminPositionPointerDown={handleRitualDragDown}
      onAdminPositionPointerMove={handleRitualDragMove}
      onAdminPositionPointerUp={handleRitualDragUp}
      bandBehind={useMobileDocumentFlow ? mobileFlowRitualBand : undefined}
    />
  ) : null;

  const overlayInHeroMedia = !useMobileDocumentFlow || mobileNudgeActive;
  const renderHeroOverlayFrame = () =>
    hasOverlayMedia ? (
      <div
        className={`hero-media-frame hero-overlay-frame${
          adminDragEnabled && adminEditLayer === "overlay" ? " hero-media-editable" : ""
        }`}
        style={{
          ...heroMediaFrameLayoutStyle(
            mobileOverlayLayout,
            mobileOverlayScale,
            heroOverlayLayer.rotateDeg,
            true
          ),
          opacity: heroOverlayLayer.opacity,
          zIndex: heroOverlayLayer.zIndex,
          pointerEvents: overlayMediaPointerEvents,
        }}
        onPointerDown={(e) => handleMediaDragDown(e, "overlay")}
        onPointerMove={handleMediaDragMove}
        onPointerUp={handleMediaDragUp}
      >
        <img
          className="hero-media-image"
          src={heroOverlayLayer.src}
          alt=""
          aria-hidden="true"
          style={{ objectFit: heroOverlayLayer.fit }}
        />
      </div>
    ) : null;

  const renderHeroPrimaryFrame = () => (
    <div
      className={`hero-media-frame hero-primary-product-frame${
        adminDragEnabled && adminEditLayer === "primary" ? " hero-media-editable" : ""
      }`}
      style={{
        ...heroMediaFrameLayoutStyle(
          mobilePrimaryLayout,
          mobilePrimaryScale,
          heroPrimarySettings.rotateDeg
        ),
        opacity: heroPrimarySettings.opacity,
        zIndex: heroPrimarySettings.zIndex,
        display: !heroPrimarySettings.visible ? "none" : "block",
        pointerEvents: primaryMediaPointerEvents,
      }}
      onPointerDown={(e) => handleMediaDragDown(e, "primary")}
      onPointerMove={handleMediaDragMove}
      onPointerUp={handleMediaDragUp}
    >
      {heroVideoIsBackground ? (
        <img
          className="hero-media-image"
          src="/hero-products-primary.png"
          alt=""
          aria-hidden="true"
          style={{ objectFit: heroPrimarySettings.fit }}
        />
      ) : introPhase === "playing" && !adminDragEnabled && hero.video.poster ? (
        <img
          className="hero-media-image"
          src={hero.video.poster}
          alt=""
          aria-hidden="true"
          style={{ objectFit: heroPrimarySettings.fit }}
        />
      ) : (
        <HeroVideoMedia
          src={heroVideoSrcForRender}
          poster={hero.video.poster}
          objectFit={heroPrimarySettings.fit}
          portrait={Boolean(showMobileLayout && hero.video.mobileSrc?.trim())}
        />
      )}
    </div>
  );

  const promoHomepageActive = heroPromoBanners.length > 0;
  const promoHomepageLayout = promoHomepageActive
    ? normalizePromoStripFields(heroPromoBanners[0])
    : null;
  const hidePrimaryForPromoView =
    promoHomepageActive ||
    (initialPromoPreview &&
      displayPromoBanners[0] &&
      promoStripHidesHeroPrimary(displayPromoBanners[0])) ||
    (adminDragEnabled && adminEditLayer === "promo-banner") ||
    (heroPromoBanners[0] &&
      promoStripHidesHeroPrimary(heroPromoBanners[0]) &&
      !(adminDragEnabled && adminEditLayer === "primary"));
  const showHeroPrimaryProductLayer =
    (hasHeroMedia || adminDragEnabled) && !hidePrimaryForPromoView;
  const showHeroMediaOverlayHost =
    !promoHomepageActive &&
    ((hasOverlayMedia && overlayInHeroMedia) || (adminDragEnabled && hasOverlayMedia));

  const pageHeroStack = (
    <>
      <section
        className={`hero ${hasAnyHeroVisualLayer ? "hero-bg" : ""}${showMobileLayout ? " hero-mobile-layout" : ""}${promoHomepageActive ? " is-promo-homepage" : ""}`}
        id="hero"
        ref={heroSectionRef}
        data-review="Homepage hero"
        data-review-id="home-hero"
        data-review-files="app/home-page-client.tsx,app/components/HeroVideoMedia.tsx"
        data-page-layer-z={pageShellPaintZ.hero}
        style={
          showMobileLayout
            ? heroSectionStackStyle
            : {
                ["--promo-responsive-height" as string]: promoHomepageLayout ? `${promoHomepageLayout.stripHeightPx / 14.4}vw` : undefined,
                minHeight:
                  promoHomepageLayout?.stripAspectRatio === "fixed"
                    ? `${promoHomepageLayout.stripHeightPx}px`
                    : `${safeHeroSectionHeight}vh`,
                ...heroSectionStackStyle,
              }
        }
      >
        <div ref={heroArtboardRef} className={artboardClassName} style={artboardStackStyle}>
        {backgroundVisible && !promoHomepageActive ? (
          <div
            className="hero-background-layer"
            aria-hidden="true"
            onPointerDown={handleBackgroundDragDown}
            onPointerMove={handleBackgroundDragMove}
            onPointerUp={handleBackgroundDragUp}
            style={
              useMobileDocumentFlow && !mobileNudgeActive
                ? {
                    ["--hero-bg-left" as string]: `${backgroundLayoutForRender.x}%`,
                    ["--hero-bg-top" as string]: `${backgroundLayoutForRender.y}%`,
                    ["--hero-bg-width" as string]: `${backgroundLayoutForRender.width}%`,
                    ["--hero-bg-height" as string]: `${backgroundLayoutForRender.height}%`,
                  }
                : {
                    left: `${backgroundLayoutForRender.x}%`,
                    top: `calc(${backgroundLayoutForRender.y}% - var(--hero-nav-lift))`,
                    width: `${backgroundLayoutForRender.width}%`,
                    height: `calc(${backgroundLayoutForRender.height}% + var(--hero-nav-lift))`,
                    ["--hero-bg-left" as string]: `${backgroundLayoutForRender.x}%`,
                    ["--hero-bg-top" as string]: `${backgroundLayoutForRender.y}%`,
                    ["--hero-bg-width" as string]: `${backgroundLayoutForRender.width}%`,
                    ["--hero-bg-height" as string]: `${backgroundLayoutForRender.height}%`,
                  }
            }
          >
            {heroVideoIsBackground && adminDragEnabled ? (
              <HeroVideoMedia
                src={heroVideoSrcForRender}
                poster={hero.video.poster}
                variant="background"
                portrait={Boolean(showMobileLayout && hero.video.mobileSrc?.trim())}
              />
            ) : null}
            <div
              className="hero-background-gradient"
              style={{
                background: `linear-gradient(${bgAngle}deg, ${bgColors.join(", ")})`,
                opacity: heroVideoIsBackground ? 0.28 : 1,
              }}
            />
          </div>
        ) : null}
        {useMobileDocumentFlow && !mobileNudgeActive && !promoHomepageActive ? renderHeroOverlayFrame() : null}
        <HeroPromoBanner
          entranceReady={introPhase === "done" && !initialPromoPreview}
          initialBanners={heroPromoBanners}
          editable={adminDragEnabled && adminEditLayer === "promo-banner"}
          marqueePreviewMode={marqueePreviewMode}
          holdMarquee={initialPromoPreview || introPhase === "playing"}
          ctaDraggable={promoEditorOpen || (adminDragEnabled && adminEditLayer === "promo-cta")}
          thumbnailsDraggable={promoEditorOpen}
          onCtaPositionChange={(position) => {
            const patch = { ctaOffsetX: Math.round(position.x), ctaOffsetY: Math.round(position.y) };
            if (promoEditorOpen && promoEditorBanners[0]) {
              applyPromoEditorPreview({ ...promoEditorBanners[0], ...patch, updatedAt: new Date().toISOString() });
              return;
            }
            patchLivePromoStrip(patch);
          }}
          onThumbnailsPositionChange={(position) => {
            const patch = { thumbnailOffsetX: Math.round(position.x), thumbnailOffsetY: Math.round(position.y) };
            if (promoEditorOpen && promoEditorBanners[0]) {
              applyPromoEditorPreview({ ...promoEditorBanners[0], ...patch, updatedAt: new Date().toISOString() });
            }
          }}
          mediaEditable={promoEditorOpen}
          onMediaLayoutChange={(patch) => {
            if (!promoEditorOpen || !promoEditorBanners[0]) return;
            applyPromoEditorPreview({ ...promoEditorBanners[0], ...patch, updatedAt: new Date().toISOString() });
          }}
          bannerRef={heroPromoElRef}
          onPointerDown={
            adminDragEnabled && (canEditLayout || canEditMobilePreview)
              ? handleHeroPromoPointerDown
              : undefined
          }
          onPointerMove={
            adminDragEnabled && (canEditLayout || canEditMobilePreview)
              ? handleHeroPromoPointerMove
              : undefined
          }
          onPointerUp={
            adminDragEnabled && (canEditLayout || canEditMobilePreview)
              ? handleHeroPromoPointerUp
              : undefined
          }
        />
        {showHeroPrimaryProductLayer ? (
          <div className="hero-primary-product-layer" aria-hidden={!heroPrimarySettings.visible}>
            {renderHeroPrimaryFrame()}
          </div>
        ) : null}
        {showHeroMediaOverlayHost ? (
          <div className="hero-media">{overlayInHeroMedia ? renderHeroOverlayFrame() : null}</div>
        ) : null}
        {!promoHomepageActive ? <div className="hero-copy">
          <div style={showMobileLayout ? { width: "100%", maxWidth: "100%" } : { width: `${copyWidth}vw`, maxWidth: "100%" }}>
          {eyebrowVisible ? (
            <span
              className={heroEyebrowClassName}
              style={
                mobileNudgeActive
                  ? mobileNudgeTransformStyle(eyebrowRenderPos.x, eyebrowRenderPos.y)
                  : useMobileDocumentFlow
                  ? undefined
                  : heroCopyOffsetStyle(eyebrowRenderPos.x, eyebrowRenderPos.y)
              }
            >
              {hero.eyebrow}
            </span>
          ) : null}
          {headlineVisible ? (
            <h1
              ref={headlineElRef}
              className={heroHeadlineClassName}
              style={{
                ...(mobileNudgeActive
                  ? mobileNudgeTransformStyle(headlineRenderPos.x, headlineRenderPos.y)
                  : {}),
                ...(useMobileDocumentFlow
                  ? {}
                  : heroHeadlineOffsetStyleForRender(headlineRenderPos.x, headlineRenderPos.y) ?? {}),
              }}
              onPointerDown={canEditLayout || canEditMobilePreview ? handlePointerDown : undefined}
              onPointerMove={canEditLayout || canEditMobilePreview ? handlePointerMove : undefined}
              onPointerUp={canEditLayout || canEditMobilePreview ? handlePointerUp : undefined}
            >
              {showMobileLayout ? formatHeadlineForMobileStack(hero.headline) : hero.headline}
            </h1>
          ) : null}
          {hero.subhead ? <p className="scroll-zoom">{hero.subhead}</p> : null}
          {actionsVisible ? (
            <div
              ref={heroActionsElRef}
              className={`hero-actions${adminDragEnabled && adminEditLayer === "actions" ? " hero-cta-drag" : ""}`}
              style={{
                ...(mobileNudgeActive
                  ? mobileNudgeTransformStyle(heroActionsRenderPos.x, heroActionsRenderPos.y, "actions")
                  : {}),
                ...(useMobileDocumentFlow
                  ? undefined
                  : heroCopyOffsetStyle(heroActionsRenderPos.x, heroActionsRenderPos.y)),
              }}
              onPointerDown={
                (canEditLayout || canEditMobilePreview) && adminEditLayer === "actions"
                  ? handleHeroActionsPointerDown
                  : undefined
              }
              onPointerMove={
                (canEditLayout || canEditMobilePreview) && adminEditLayer === "actions"
                  ? handleHeroActionsPointerMove
                  : undefined
              }
              onPointerUp={
                (canEditLayout || canEditMobilePreview) && adminEditLayer === "actions"
                  ? handleHeroActionsPointerUp
                  : undefined
              }
            >
              <Link href="/special" className="button primary button-gold">
                {hero.ctaPrimary}
              </Link>
              <Link href="/rituals" className="button primary button-sage">
                {hero.ctaSecondary}
              </Link>
              <Link
                href="/?skipIntro=1#shop"
                className="button secondary"
                onClick={(event) => {
                  event.preventDefault();
                  requestShopScroll();
                }}
              >
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
        </div> : null}
        </div>
      </section>

      {ritualBandLayer}

      {ritualCarousel ? (
        <div
          className={`hero-ritual-page-layer${hasAnyHeroVisualLayer ? " is-hero-bg-context" : ""}${
            useMobileDocumentFlow ? " is-mobile-ritual-stack" : ""
          }${canEditRitualBand && useMobileDocumentFlow ? " is-editing-ritual-band" : ""}${
            mobileNudgeActive && !useMobileDocumentFlow ? " is-ritual-edit-overlay" : ""
          }`}
          style={{
            ...ritualPageLayerStyle,
            "--hero-ritual-x-pct": String(ritualPositionPctForRender.x),
            "--hero-ritual-y-pct": String(ritualPositionPctForRender.y),
            "--hero-ritual-scale": String(ritualCarouselScaleForRender),
            "--hero-ritual-lift": `${ritualLiftPx}px`,
            "--hero-z-rituals": String(heroRitualStackZ),
            ...(useMobileDocumentFlow
              ? {
                  ["--ritual-row-scale" as string]: String(ritualCarouselScaleForRender),
                  ["--ritual-band-size-mult" as string]: "1",
                  ["--ritual-band-x-pct" as string]: String(ritualBandLayoutForRender.x),
                  ["--ritual-band-y-pct" as string]: String(ritualBandLayoutForRender.y),
                  ["--ritual-band-width-pct" as string]: String(ritualBandLayoutForRender.width),
                  ["--ritual-band-height-pct" as string]: String(ritualBandLayoutForRender.height),
                  ["--ritual-band-height-px" as string]: `${mobileRitualBandHeightPx(ritualBandLayoutForRender.height)}px`,
                  ["--ritual-band-y-px" as string]: `${mobileRitualBandYOffsetPx(ritualBandLayoutForRender.y, ritualBandLayoutForRender.height)}px`,
                  ["--ritual-band-width-px" as string]: `${(ritualBandLayoutForRender.width / 100) * MOBILE_DESIGN_WIDTH_PX}px`,
                  ["--ritual-band-x-shift-px" as string]: `${((ritualBandLayoutForRender.x - 50) / 100) * MOBILE_DESIGN_WIDTH_PX}px`,
                }
              : {}),
          } as CSSProperties}
          data-page-layer-z={pageShellPaintZ.rituals}
        >
          {ritualCarousel}
        </div>
      ) : null}

      {lovedSectionVisible ? (
        <HomeCollections
          className={`scroller-loved-for-a-reason${promoHomepageActive ? " is-after-promo" : ""}`}
          initialCategoryBanners={initialCategoryBanners}
          pageLayerZ={lovedOverlapPaintZ}
          adminPositionEditable={(canEditLayout || canEditMobilePreview) && adminEditLayer === "loved-section"}
          onAdminPositionPointerDown={handleLovedSectionDragDown}
          onAdminPositionPointerMove={handleLovedSectionDragMove}
          onAdminPositionPointerUp={handleLovedSectionDragUp}
          sectionStyle={{
            ...lovedStackStyle,
            zIndex: lovedOverlapPaintZ,
            "--loved-flow-offset-y": showMobileLayout ? "0px" : `${lovedFlowOffsetPx}px`,
            "--loved-divider-offset-y": `${lovedDividerForRender}px`,
            "--loved-floral-offset-y": `${lovedFloralOffsetForRender}px`,
            "--loved-floral-opacity": String(lovedFloralsVisible ? lovedFloralOpacity : 0),
            "--loved-tint-offset-x": `${lovedTintOffsetX}px`,
            "--loved-tint-offset-y": `${lovedTintOffsetY}px`,
            "--loved-tint-opacity": String(lovedWashVisible ? lovedTintOpacityForRender : 0),
            "--loved-tint2-offset-x": `${lovedTint2OffsetX}px`,
            "--loved-tint2-offset-y": `${lovedTint2OffsetY}px`,
            "--loved-tint2-opacity": String(lovedBandVisible ? lovedTint2Opacity : 0),
            "--loved-tint2-top-pct": `${lovedTint2TopPct}%`,
            "--loved-tint2-height-pct": `${lovedTint2HeightPct}%`,
            "--loved-tint2-width-pct": `${lovedTint2WidthPct}%`,
            "--loved-tint2-left-pct": `${lovedTint2LeftPct}%`,
          } as CSSProperties}
          title="Collections"
        />
      ) : null}
    </>
  );

  const pageTail = !adminMobilePreviewActive && !initialPromoPreview ? (
    <HomePageBelowFold
      brand={brand}
      products={products}
      productSearch={productSearch}
      productStatus={productStatus}
      onProductSearchChange={setProductSearch}
    />
  ) : null;

  const pageContent = (
    <div
      className={`page maroma${showMobileLayout ? " is-mobile-layout" : ""}${useMobileDocumentFlow ? " is-mobile-document-flow" : ""}${persistLayoutToMobile && useMobileDocumentFlow ? " is-mobile-edit-active" : ""}${adminMobilePreviewActive ? " is-admin-mobile-preview" : ""}${initialPromoPreview ? " is-promo-preview-page" : ""}${introPhase === "playing" ? " is-intro-pending" : ""}`}
      style={{
        ...pageStackStyle,
        ...(introPhase !== "done"
          ? { opacity: "var(--homepage-intro-reveal, 0)" }
          : {}),
      } as CSSProperties}
    >
      {pageHeroStack}
      {pageTail}
    </div>
  );

  return (
    <>
      {introPhase !== "done" ? (
        <div
          className={`homepage-video-intro${introVideoReady ? " is-video-ready" : ""}${introPhase === "fading" || introPhase === "skip-fading" ? " is-fading" : ""}${introPhase === "skip-fading" ? " is-skip-fading" : ""}`}
          role="dialog"
          aria-label="Maroma introduction video"
        >
          <div className="homepage-video-intro__media">
            <HeroVideoMedia
              src={heroVideoSrcForRender}
              poster={hero.video.poster}
              variant="background"
              loop={false}
              onEnded={finishHomepageIntro}
              onPlaying={() => setIntroVideoReady(true)}
              portrait={Boolean(showMobileLayout && hero.video.mobileSrc?.trim())}
            />
          </div>
          <div className="homepage-video-intro__loading" aria-hidden="true">
            <img src="/maroma-logo.png" alt="" />
          </div>
          <button
            type="button"
            className="homepage-video-intro__skip"
            onClick={() => finishHomepageIntro("skip")}
          >
            Skip video
          </button>
        </div>
      ) : null}

      {adminMobilePreviewActive ? (
        <MobilePreviewFrame
          frameRef={adminMobilePreviewFrameRef}
          header={<SiteHeader initialNav={previewNav} initialViewportIsMobile />}
        >
          {pageContent}
        </MobilePreviewFrame>
      ) : (
        pageContent
      )}

      {showFloatingAdmin ? (
      <div
        ref={floatingPanelRef}
        className={`floating-admin-toggle${floatingPanelMinimized ? " is-minimized" : ""}${isMobileViewport ? " is-mobile-controls" : ""}${adminMobilePreviewActive ? " is-preview-docked" : ""}`}
        role="complementary"
        aria-label="Admin controls"
        style={floatingPanelChromeStyle}
      >
        {floatingPanelMinimized ? (
          <div className="floating-admin-mini-actions">
            <button
              type="button"
              className="floating-admin-mini-btn is-admin"
              aria-label="Open admin edit controls"
              onClick={() => {
                setFloatingPanelMinimized(false);
                window.localStorage.setItem("maroma-floating-admin-minimized", "false");
              }}
            >
              Admin
            </button>
            <button
              type="button"
              className="floating-admin-mini-btn"
              aria-label="Edit homepage promo"
              onClick={() => {
                void openPromoEditor();
              }}
            >
              Edit promo
            </button>
          </div>
        ) : (
          <>
            <div className="floating-admin-workspace-switch" role="group" aria-label="Homepage editor">
              <button type="button" className="is-active" aria-pressed="true">Admin</button>
              <button
                type="button"
                aria-pressed="false"
                onClick={() => {
                  setFloatingPanelMinimized(true);
                  window.localStorage.setItem("maroma-floating-admin-minimized", "true");
                  if (!promoEditorOpen) void openPromoEditor();
                }}
              >
                Edit promo
              </button>
            </div>
            <div className="floating-admin-head">
              <div className="floating-admin-head-row">
                <div
                  className="floating-admin-drag-handle"
                  aria-label="Drag admin panel"
                  onPointerDown={handleFloatingPanelPointerDown}
                  onPointerMove={handleFloatingPanelPointerMove}
                  onPointerUp={handleFloatingPanelPointerUp}
                >
                  <span aria-hidden="true">⋮⋮</span>
                </div>
                <label className="floating-admin-mode-toggle">
                  <span className="floating-admin-label">Admin mode</span>
                  <input
                    type="checkbox"
                    checked={adminDragEnabled}
                    onChange={(event) => {
                      const next = event.target.checked;
                      if (!isAdminUser) return;
                      setAdminDragEnabled(next);
                      setAdminDragPreference(next);
                    }}
                    aria-label="Toggle admin mode"
                  />
                  <span className="floating-admin-mode-switch" aria-hidden="true" />
                </label>
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
              {!isNarrowViewport ? (
                <div className="floating-admin-view-toggle" role="group" aria-label="Preview device">
                  <button
                    type="button"
                    className={`floating-admin-view-btn${adminDevicePreview === "desktop" ? " is-active" : ""}`}
                    onClick={() => setDevicePreview("desktop")}
                    disabled={!adminDragEnabled}
                  >
                    Desktop
                  </button>
                  <button
                    type="button"
                    className={`floating-admin-view-btn${adminDevicePreview === "mobile" ? " is-active" : ""}`}
                    onClick={() => setDevicePreview("mobile")}
                    disabled={!adminDragEnabled}
                  >
                    Mobile
                  </button>
                </div>
              ) : null}
            </div>
            <div ref={floatingAdminBodyRef} className="floating-admin-body">
            {adminMobilePreviewActive ? (
              <p className="floating-admin-mobile-hint">
                Editing mobile layout. Changes save to the mobile preset only. Desktop is unchanged.
              </p>
            ) : null}
            <button
              type="button"
              className="button primary floating-admin-save-btn"
              style={{
                width: "100%",
                background:
                  saveStatus === "saved" ? "#10b981" : saveStatus === "error" ? "#dc2626" : "",
              }}
              onClick={handleSaveAll}
              disabled={saveStatus === "saving"}
            >
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "saved"
                  ? "Changes Saved"
                  : saveStatus === "error"
                    ? "Save failed. Sign in as admin"
                    : "SAVE ALL CHANGES"}
            </button>
            <div className="floating-admin-signout">
              <SignOutButton
                onSignedOut={() => {
                  setAdminDragEnabled(false);
                  void refreshSession();
                }}
              />
            </div>

            {adminDragEnabled ? (
              <>
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
                  <option value="promo-banner">Promo banner strip</option>
                  <option value="promo-cta">Promo CTA cluster</option>
                  <option value="ritual-band">Carousel band (behind tiles)</option>
                  <option value="rituals">Ritual carousel</option>
                  <option value="loved-section">Loved section (position)</option>
                  <option value="loved-florals">Layer 1: Loved florals</option>
                  <option value="loved-wash">Layer 2: Loved wash veil</option>
                  <option value="loved-band">Layer 3: Loved band veil</option>
                </select>
              </label>
            </div>

            <div
              ref={floatingAdminCoreRef}
              className="floating-admin-grid floating-admin-core-controls"
            >
              {adminEditLayer === "ritual-band" ? renderRitualBandControls() : null}
              {adminEditLayer === "rituals" ? renderRitualCarouselControls() : null}
              {adminEditLayer === "promo-cta" ? (
                <p className="floating-admin-hint">
                  Drag the product tiles and CTA directly on the homepage. The new position saves automatically.
                </p>
              ) : null}
              {adminEditLayer === "background" && (
                <>
                  <label>
                    X{" "}
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={0.1}
                      value={editBackgroundLayout.x}
                      onChange={(e) =>
                        setBackgroundLayoutAndSave({
                          ...editBackgroundLayout,
                          x: Number(e.target.value)
                        })
                      }
                    />{" "}
                    <span>{editBackgroundLayout.x.toFixed(1)}%</span>
                  </label>
                  <label>
                    Y{" "}
                    <input
                      type="range"
                      min={-150}
                      max={150}
                      step={0.1}
                      value={editBackgroundLayout.y}
                      onChange={(e) =>
                        setBackgroundLayoutAndSave({
                          ...editBackgroundLayout,
                          y: Number(e.target.value)
                        })
                      }
                    />{" "}
                    <span>{editBackgroundLayout.y.toFixed(1)}%</span>
                  </label>
                  {renderCentreButtons(
                    () =>
                      setBackgroundLayoutAndSave({ ...editBackgroundLayout, x: 50 }),
                    () =>
                      setBackgroundLayoutAndSave({ ...editBackgroundLayout, y: 50 }),
                  )}
                  <label>
                    Width (%)
                    <input
                      type="range"
                      min={20}
                      max={200}
                      step={0.5}
                      value={editBackgroundLayout.width}
                      onChange={(e) =>
                        setBackgroundLayoutAndSave({
                          ...editBackgroundLayout,
                          width: Number(e.target.value),
                        })
                      }
                    />{" "}
                    <span>{editBackgroundLayout.width.toFixed(1)}%</span>
                  </label>
                  <label>
                    Height (%)
                    <input
                      type="range"
                      min={20}
                      max={200}
                      step={0.5}
                      value={editBackgroundLayout.height}
                      onChange={(e) =>
                        setBackgroundLayoutAndSave({
                          ...editBackgroundLayout,
                          height: Number(e.target.value),
                        })
                      }
                    />{" "}
                    <span>{editBackgroundLayout.height.toFixed(1)}%</span>
                  </label>
                  {renderStackLayerOrderButtons("background")}
                </>
              )}
              {adminEditLayer === "primary" && (
                <>
                  <label>
                    X{" "}
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={0.1}
                      value={editPrimaryLayout.x}
                      onChange={(e) =>
                        setHeroMediaLayoutAndSave({ ...editPrimaryLayout, x: Number(e.target.value) })
                      }
                    />{" "}
                    <span>{editPrimaryLayout.x.toFixed(1)}%</span>
                  </label>
                  <label>
                    Y{" "}
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={0.1}
                      value={editPrimaryLayout.y}
                      onChange={(e) =>
                        setHeroMediaLayoutAndSave({ ...editPrimaryLayout, y: Number(e.target.value) })
                      }
                    />{" "}
                    <span>{editPrimaryLayout.y.toFixed(1)}%</span>
                  </label>
                  {renderCentreButtons(
                    () => setHeroMediaLayoutAndSave({ ...editPrimaryLayout, x: 50 }),
                    () => setHeroMediaLayoutAndSave({ ...editPrimaryLayout, y: 50 }),
                  )}
                  <div className="floating-admin-stepper">
                    <span>Scale</span>
                    <button type="button" aria-label="Decrease scale" onClick={() => setPrimaryScaleAndSave(editPrimaryScale - 0.05)}>−</button>
                    <span>{editPrimaryScale.toFixed(2)}</span>
                    <button type="button" aria-label="Increase scale" onClick={() => setPrimaryScaleAndSave(editPrimaryScale + 0.05)}>+</button>
                  </div>
                  {renderLayerOrderButtons("primary")}
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
                    X{" "}
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={0.1}
                      value={editOverlayLayout.x}
                      onChange={(e) =>
                        setOverlayLayoutAndSave({ ...editOverlayLayout, x: Number(e.target.value) })
                      }
                    />{" "}
                    <span>{editOverlayLayout.x.toFixed(1)}%</span>
                  </label>
                  <label>
                    Y{" "}
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={0.1}
                      value={editOverlayLayout.y}
                      onChange={(e) =>
                        setOverlayLayoutAndSave({ ...editOverlayLayout, y: Number(e.target.value) })
                      }
                    />{" "}
                    <span>{editOverlayLayout.y.toFixed(1)}%</span>
                  </label>
                  {renderCentreButtons(
                    () => setOverlayLayoutAndSave({ ...editOverlayLayout, x: 50 }),
                    () => setOverlayLayoutAndSave({ ...editOverlayLayout, y: 50 }),
                  )}
                  <div className="floating-admin-stepper">
                    <span>Scale</span>
                    <button type="button" aria-label="Decrease scale" onClick={() => setOverlayScaleAndSave(editOverlayScale - 0.05)}>−</button>
                    <span>{editOverlayScale.toFixed(2)}</span>
                    <button type="button" aria-label="Increase scale" onClick={() => setOverlayScaleAndSave(editOverlayScale + 0.05)}>+</button>
                  </div>
                  {renderLayerOrderButtons("overlay")}
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
                    X{" "}
                    <input
                      type="range"
                      min={-1000}
                      max={1000}
                      step={1}
                      value={editHeadlinePos.x}
                      onChange={(e) =>
                        setHeadlinePosAndSave({ ...editHeadlinePos, x: Number(e.target.value) })
                      }
                    />{" "}
                    <span>{Math.round(editHeadlinePos.x)}px</span>
                  </label>
                  <label>
                    Y{" "}
                    <input
                      type="range"
                      min={-1000}
                      max={1000}
                      step={1}
                      value={editHeadlinePos.y}
                      onChange={(e) =>
                        setHeadlinePosAndSave({ ...editHeadlinePos, y: Number(e.target.value) })
                      }
                    />{" "}
                    <span>{Math.round(editHeadlinePos.y)}px</span>
                  </label>
                  {renderCentreButtons(
                    () =>
                      setHeadlinePosAndSave(
                        centerMobileLayerInFrame(headlineElRef.current, editHeadlinePos, "x")
                      ),
                    () =>
                      setHeadlinePosAndSave(
                        centerMobileLayerInFrame(headlineElRef.current, editHeadlinePos, "y")
                      ),
                  )}
                  <div className="floating-admin-stepper">
                    <span>Scale</span>
                    <button type="button" aria-label="Decrease headline size" onClick={() => setHeadlineSizeAndSave(editHeadlineSizeRem - 0.1)}>−</button>
                    <span>{editHeadlineSizeRem.toFixed(2)}rem</span>
                    <button type="button" aria-label="Increase headline size" onClick={() => setHeadlineSizeAndSave(editHeadlineSizeRem + 0.1)}>+</button>
                  </div>
                  {renderStackLayerOrderButtons("headline")}
                </>
              )}
              {adminEditLayer === "eyebrow" && (
                <>
                  <label>
                    X{" "}
                    <input type="range" min={-1000} max={1000} step={1} value={editEyebrowPos.x} onChange={(e) => setEyebrowXFromPx(Number(e.target.value))} />{" "}
                    <span>{Math.round(editEyebrowPos.x)}px</span>
                  </label>
                  <label>
                    Y{" "}
                    <input type="range" min={-1000} max={1000} step={1} value={editEyebrowPos.y} onChange={(e) => setEyebrowYFromPx(Number(e.target.value))} />{" "}
                    <span>{Math.round(editEyebrowPos.y)}px</span>
                  </label>
                  {renderCentreButtons(
                    () => setEyebrowXFromPx(0),
                    () => setEyebrowYFromPx(0),
                  )}
                  {renderStackLayerOrderButtons("eyebrow")}
                </>
              )}
              {adminEditLayer === "actions" && (
                <>
                  <label>
                    X{" "}
                    <input
                      type="range"
                      min={-1000}
                      max={1000}
                      step={1}
                      value={editHeroActionsPos.x}
                      onChange={(e) =>
                        setHeroActionsPosAndSave({ ...editHeroActionsPos, x: Number(e.target.value) })
                      }
                    />{" "}
                    <span>{Math.round(editHeroActionsPos.x)}px</span>
                  </label>
                  <label>
                    Y{" "}
                    <input
                      type="range"
                      min={-1000}
                      max={1000}
                      step={1}
                      value={editHeroActionsPos.y}
                      onChange={(e) =>
                        setHeroActionsPosAndSave({ ...editHeroActionsPos, y: Number(e.target.value) })
                      }
                    />{" "}
                    <span>{Math.round(editHeroActionsPos.y)}px</span>
                  </label>
                  {renderCentreButtons(
                    () =>
                      setHeroActionsPosAndSave(
                        centerMobileLayerInFrame(heroActionsElRef.current, editHeroActionsPos, "x")
                      ),
                    () =>
                      setHeroActionsPosAndSave(
                        centerMobileLayerInFrame(heroActionsElRef.current, editHeroActionsPos, "y")
                      ),
                  )}
                  {renderStackLayerOrderButtons("actions")}
                </>
              )}
              {adminEditLayer === "promo-banner" && (
                <>
                  <p className="floating-admin-hint">
                    Drag the promo strip up/down on the page (CTAs are locked while editing this layer), or use the
                    Y / Top offset / Height sliders. Width uses the width slider. Click Save All Changes when done.
                  </p>
                  {!promoHomepageActive ? (
                    <label>
                      Top offset (cm){" "}
                      <input
                        type="range"
                        min={0}
                        max={40}
                        step={0.1}
                        value={editHeroPromoTopCm}
                        onChange={(e) => setHeroPromoTopCmAndSave(Number(e.target.value))}
                      />{" "}
                      <span>{editHeroPromoTopCm.toFixed(1)}cm</span>
                    </label>
                  ) : null}
                  <label>
                    X{" "}
                    <input
                      type="range"
                      min={-1000}
                      max={1000}
                      step={1}
                      value={editHeroPromoPos.x}
                      onChange={(e) =>
                        setHeroPromoPosAndSave({ ...editHeroPromoPos, x: Number(e.target.value) })
                      }
                    />{" "}
                    <span>{Math.round(editHeroPromoPos.x)}px</span>
                  </label>
                  <label>
                    {promoHomepageActive ? "Banner Y (saved with this promo)" : "Y"}{" "}
                    <input
                      type="range"
                      min={promoHomepageActive ? PROMO_STRIP_POSITION_PX_MIN : -1000}
                      max={promoHomepageActive ? PROMO_STRIP_POSITION_PX_MAX : 1000}
                      step={1}
                      value={promoHomepageActive ? editPromoStrip.stripPositionOffsetPx : editHeroPromoPos.y}
                      onChange={(e) => {
                        const nextY = Number(e.target.value);
                        if (promoHomepageActive) {
                          patchLivePromoStrip({ stripPositionOffsetPx: nextY });
                          return;
                        }
                        setHeroPromoPosAndSave({ ...editHeroPromoPos, y: nextY });
                      }}
                    />{" "}
                    <span>{Math.round(promoHomepageActive ? editPromoStrip.stripPositionOffsetPx : editHeroPromoPos.y)}px</span>
                  </label>
                  <label>
                    Width (%){" "}
                    <input
                      type="range"
                      min={40}
                      max={100}
                      step={1}
                      value={editHeroPromoWidthPct}
                      onChange={(e) => setHeroPromoWidthPctAndSave(Number(e.target.value))}
                    />{" "}
                    <span>{Math.round(editHeroPromoWidthPct)}%</span>
                  </label>
                  {promoHomepageActive ? (
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        setHeroPromoTopCmAndSave(15);
                        setHeroPromoPosAndSave({ ...editHeroPromoPos, x: 0 });
                        patchLivePromoStrip({ stripPositionOffsetCm: 0, stripPositionOffsetPx: 0 });
                        setHeroPromoWidthPctAndSave(100);
                      }}
                    >
                      Reset banner position
                    </button>
                  ) : null}
                      <button
                        type="button"
                        className="button primary"
                        onClick={() => void openPromoEditor()}
                      >
                        Edit promo on homepage
                      </button>
                      {promoEditorStatus ? (
                        <p className="floating-admin-hint">{promoEditorStatus}</p>
                      ) : null}
                      {livePromoBanners[0] ? (
                    <>
                      <label className="floating-admin-toggle-row">
                        <input
                          type="checkbox"
                          checked={displayPromoBanners[0]?.promoModeEnabled !== false}
                          onChange={(e) =>
                            patchLivePromoStrip({ promoModeEnabled: e.target.checked })
                          }
                        />{" "}
                        Promo mode (off hides strip, shows primary media)
                      </label>
                      <label>
                        Height (px){" "}
                        <input
                          type="range"
                          min={PROMO_STRIP_HEIGHT_MIN}
                          max={PROMO_STRIP_HEIGHT_MAX}
                          step={1}
                          value={editPromoStrip.stripHeightPx}
                          onChange={(e) =>
                            patchLivePromoStrip({ stripHeightPx: Number(e.target.value) })
                          }
                        />{" "}
                        <span>{editPromoStrip.stripHeightPx}px</span>
                      </label>
                      <label>
                        Banner Y (cm){" "}
                        <input
                          type="range"
                          min={PROMO_STRIP_POSITION_CM_MIN}
                          max={PROMO_STRIP_POSITION_CM_MAX}
                          step={0.5}
                          value={editPromoStrip.stripPositionOffsetCm}
                          onChange={(e) =>
                            patchLivePromoStrip({ stripPositionOffsetCm: Number(e.target.value) })
                          }
                        />{" "}
                        <span>{editPromoStrip.stripPositionOffsetCm.toFixed(1)}cm</span>
                      </label>
                      <label>
                        Banner Y fine (px){" "}
                        <input
                          type="range"
                          min={PROMO_STRIP_POSITION_PX_MIN}
                          max={PROMO_STRIP_POSITION_PX_MAX}
                          step={1}
                          value={editPromoStrip.stripPositionOffsetPx}
                          onChange={(e) =>
                            patchLivePromoStrip({ stripPositionOffsetPx: Number(e.target.value) })
                          }
                        />{" "}
                        <span>{editPromoStrip.stripPositionOffsetPx}px</span>
                      </label>
                      {editPromoStrip.stripBackgroundMediaKind === "video" ? (
                      <label className="floating-admin-toggle-row">
                        <input
                          type="checkbox"
                          checked={editPromoStrip.stripAspectRatio === PROMO_STRIP_ASPECT_21_9}
                          onChange={(e) =>
                            patchLivePromoStrip({
                              stripAspectRatio: e.target.checked ? PROMO_STRIP_ASPECT_21_9 : "fixed",
                            })
                          }
                        />{" "}
                        21:9 video strip (taller layout for widescreen video)
                      </label>
                      ) : null}
                    </>
                  ) : null}
                  <button type="button" className="button secondary" onClick={snapPromoBetweenHeadlineAndActions}>
                    Snap between headline and CTAs
                  </button>
                  {renderCentreButtons(
                    () => setHeroPromoPosAndSave({ ...editHeroPromoPos, x: 0 }),
                    () => setHeroPromoPosAndSave({ ...editHeroPromoPos, y: 0 }),
                  )}
                  {renderStackLayerOrderButtons("promo-banner")}
                  <p className="floating-admin-hint" style={{ gridColumn: "1 / -1" }}>
                    Florals tuck behind this strip when their stack depth is lower than promo stack
                    depth (edit Layer 1: Loved florals vs this layer).
                  </p>
                  {livePromoBanners[0] ? (
                    <>
                      <label>
                        Strip opacity{" "}
                        <input
                          type="range"
                          min={0.05}
                          max={1}
                          step={0.01}
                          value={editPromoStrip.stripOpacity}
                          onChange={(e) =>
                            patchLivePromoStrip({ stripOpacity: Number(e.target.value) })
                          }
                        />{" "}
                        <span>{editPromoStrip.stripOpacity.toFixed(2)}</span>
                      </label>
                      <label>
                        Marquee start (cm from product right){" "}
                        <input
                          type="range"
                          min={-5}
                          max={25}
                          step={0.1}
                          value={editPromoStrip.heroMarqueeStartOffsetCm}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            setMarqueePreviewMode("start");
                            setHeroMarqueeStartOffsetCm(next);
                            patchLivePromoStrip({ heroMarqueeStartOffsetCm: next });
                            void persistHeroVisualPatch({ heroMarqueeStartOffsetCm: next });
                          }}
                        />{" "}
                        <span>{editPromoStrip.heroMarqueeStartOffsetCm.toFixed(1)}cm</span>
                      </label>
                      <label>
                        Marquee start fine-tune (px){" "}
                        <input
                          type="range"
                          min={-600}
                          max={600}
                          step={1}
                          value={editPromoStrip.heroMarqueeStartOffsetPx}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            setMarqueePreviewMode("start");
                            setHeroMarqueeStartOffsetPx(next);
                            patchLivePromoStrip({ heroMarqueeStartOffsetPx: next });
                            void persistHeroVisualPatch({ heroMarqueeStartOffsetPx: next });
                          }}
                        />{" "}
                        <span>{editPromoStrip.heroMarqueeStartOffsetPx}px</span>
                      </label>
                      <label>
                        Marquee end (cm from strip center){" "}
                        <input
                          type="range"
                          min={-15}
                          max={15}
                          step={0.1}
                          value={editPromoStrip.heroMarqueeEndOffsetCm}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            setMarqueePreviewMode("end");
                            setHeroMarqueeEndOffsetCm(next);
                            patchLivePromoStrip({ heroMarqueeEndOffsetCm: next });
                            void persistHeroVisualPatch({ heroMarqueeEndOffsetCm: next });
                          }}
                        />{" "}
                        <span>{editPromoStrip.heroMarqueeEndOffsetCm.toFixed(1)}cm</span>
                      </label>
                      <label>
                        Marquee end fine-tune (px){" "}
                        <input
                          type="range"
                          min={-600}
                          max={600}
                          step={1}
                          value={editPromoStrip.heroMarqueeEndOffsetPx}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            setMarqueePreviewMode("end");
                            setHeroMarqueeEndOffsetPx(next);
                            patchLivePromoStrip({ heroMarqueeEndOffsetPx: next });
                            void persistHeroVisualPatch({ heroMarqueeEndOffsetPx: next });
                          }}
                        />{" "}
                        <span>{editPromoStrip.heroMarqueeEndOffsetPx}px</span>
                      </label>
                      <p className="floating-admin-hint" style={{ fontSize: "0.72rem" }}>
                        Text holds still while you adjust. Start sliders move the whole message
                        (higher cm emerges sooner from behind the product). End sliders move only
                        the rest position (positive cm/px is right). Click SAVE ALL CHANGES, then
                        use ↻ on the strip to preview the scroll.
                      </p>
                      <label>
                        Gift offset (cm){" "}
                        <input
                          type="range"
                          min={-10}
                          max={20}
                          step={0.1}
                          value={editPromoStrip.mediaOffsetXCm}
                          onChange={(e) =>
                            patchLivePromoStrip({ mediaOffsetXCm: Number(e.target.value) })
                          }
                        />{" "}
                        <span>{editPromoStrip.mediaOffsetXCm.toFixed(1)}cm</span>
                      </label>
                      <label className="floating-admin-toggle-row">
                        <input
                          type="checkbox"
                          checked={editPromoStrip.marqueeForceScroll}
                          onChange={(e) =>
                            patchLivePromoStrip({ marqueeForceScroll: e.target.checked })
                          }
                        />{" "}
                        Always scroll message
                      </label>
                      {displayPromoBanners[0]?.stripBackgroundMediaKind === "video" &&
                      displayPromoBanners[0]?.stripBackgroundImageUrl ? (
                        <label className="floating-admin-toggle-row">
                          <input
                            type="checkbox"
                            checked={editPromoStrip.stripBackgroundVideoLoop}
                            onChange={(e) =>
                              patchLivePromoStrip({ stripBackgroundVideoLoop: e.target.checked })
                            }
                          />{" "}
                          Loop strip video
                        </label>
                      ) : null}
                      <p className="floating-admin-hint" style={{ gridColumn: "1 / -1" }}>
                        <button
                          type="button"
                          className="floating-admin-inline-button"
                          onClick={() => void openPromoEditor()}
                        >
                          Edit banner content, frames, and schedule here
                        </button>
                      </p>
                    </>
                  ) : (
                    <p className="floating-admin-hint" style={{ gridColumn: "1 / -1" }}>
                      No live banner.{" "}
                      <button
                        type="button"
                        className="floating-admin-inline-button"
                        onClick={() => void openPromoEditor()}
                      >
                        Create a promo banner here
                      </button>
                    </p>
                  )}
                </>
              )}
              {adminEditLayer === "loved-section" && (
                <>
                <label>
                  Y{" "}
                  <input
                    type="range"
                    min={-500}
                    max={500}
                    step={1}
                    value={editLovedDividerOffsetY}
                    onChange={(e) => {
                      setLovedDividerOffsetYAndSave(Number(e.target.value));
                    }}
                  />{" "}
                  <span>{editLovedDividerOffsetY}px</span>
                </label>
                {renderStackLayerOrderButtons("loved-section")}
                </>
              )}
              {adminEditLayer === "loved-florals" && (
                <>
                  <label>
                    Y{" "}
                    <input
                      type="range"
                      min={-500}
                      max={500}
                      step={1}
                      value={editLovedFloralOffsetY}
                      onChange={(e) => {
                        setLovedFloralOffsetYAndSave(Number(e.target.value));
                      }}
                    />{" "}
                    <span>{editLovedFloralOffsetY}px</span>
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
                  {renderStackLayerOrderButtons("loved-florals")}
                  <p className="floating-admin-hint" style={{ gridColumn: "1 / -1" }}>
                    Stack depth lower than the promo strip (Layer: Promo banner strip) tucks florals
                    behind the teal banner. Raise florals depth above promo depth to paint over the
                    strip.
                  </p>
                </>
              )}
              {adminEditLayer === "loved-wash" && (
                <>
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
                  {renderStackLayerOrderButtons("loved-wash")}
                </>
              )}
              {adminEditLayer === "loved-band" && (
                <>
                  <label>
                    Top position (%){" "}
                    <input
                      type="range"
                      min={0}
                      max={80}
                      step={0.5}
                      value={lovedTint2TopPct}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setLovedTint2TopPct(next);
                        void persistHeroVisualPatch({ lovedTint2TopPct: next });
                      }}
                    />{" "}
                    <span>{lovedTint2TopPct.toFixed(1)}%</span>
                  </label>
                  <label>
                    Height (%){" "}
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={0.5}
                      value={lovedTint2HeightPct}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setLovedTint2HeightPct(next);
                        void persistHeroVisualPatch({ lovedTint2HeightPct: next });
                      }}
                    />{" "}
                    <span>{lovedTint2HeightPct.toFixed(1)}%</span>
                  </label>
                  <label>
                    Width (%){" "}
                    <input
                      type="range"
                      min={20}
                      max={100}
                      step={0.5}
                      value={lovedTint2WidthPct}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setLovedTint2WidthPct(next);
                        void persistHeroVisualPatch({ lovedTint2WidthPct: next });
                      }}
                    />{" "}
                    <span>{lovedTint2WidthPct.toFixed(1)}%</span>
                  </label>
                  <label>
                    Left edge (%){" "}
                    <input
                      type="range"
                      min={0}
                      max={80}
                      step={0.5}
                      value={lovedTint2LeftPct}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setLovedTint2LeftPct(next);
                        void persistHeroVisualPatch({ lovedTint2LeftPct: next });
                      }}
                    />{" "}
                    <span>{lovedTint2LeftPct.toFixed(1)}%</span>
                  </label>
                  <label>
                    Fine nudge X (px){" "}
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
                    Fine nudge Y (px){" "}
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
                  <span className="floating-admin-hint" style={{ gridColumn: "1 / -1", fontSize: "0.72rem" }}>
                    Lower Top % moves the band up. Reset fine nudge Y to 0 if you hit the −500px limit.
                  </span>
                  {renderStackLayerOrderButtons("loved-band")}
                </>
              )}
              {adminEditLayer !== "rituals" && adminEditLayer !== "ritual-band" ? (
                <span className="floating-admin-hint" style={{ gridColumn: "1 / -1", fontSize: "0.72rem" }}>
                  {adminEditLayer === "primary" || adminEditLayer === "overlay"
                    ? "Layer order moves this image vs background, copy, rituals, and the other media layer."
                    : isLovedStackLayer(adminEditLayer)
                      ? "Layer order moves this loved-section layer vs florals, wash, band, and content."
                      : "Layer order moves this block vs background, media, rituals, and copy."}
                </span>
              ) : null}
            </div>

            <div className="floating-admin-more">
              <button
                type="button"
                className="floating-admin-more-toggle"
                aria-expanded={adminMoreOpen}
                onClick={() => setAdminMoreOpen((open) => !open)}
              >
                More controls
                <span className="floating-admin-more-icon" aria-hidden="true">{adminMoreOpen ? "−" : "+"}</span>
              </button>
              {adminMoreOpen ? (
                <div className="floating-admin-more-body">
                  <label className="floating-admin-upload">
                    Upload image/video for selected media layer
                    <input type="file" accept="image/*,video/*" onChange={handleHeroMediaUpload} />
                  </label>
                  <div className="floating-admin-grid">
                    <label>
                      Layer visible{" "}
                      <input
                        type="checkbox"
                        checked={
                          adminEditLayer === "primary"
                            ? heroPrimarySettings.visible
                            : adminEditLayer === "overlay"
                              ? heroOverlayLayer.visible
                              : adminEditLayer === "background"
                                ? backgroundVisible
                                : adminEditLayer === "headline"
                                  ? headlineVisible
                                  : adminEditLayer === "eyebrow"
                                    ? eyebrowVisible
                                    : adminEditLayer === "actions"
                                      ? actionsVisible
                                      : adminEditLayer === "ritual-band"
                                        ? editRitualBandVisible
                                        : adminEditLayer === "rituals"
                                          ? ritualsVisible
                                          : adminEditLayer === "loved-section"
                                          ? lovedSectionVisible
                                          : adminEditLayer === "loved-florals"
                                            ? lovedFloralsVisible
                                            : adminEditLayer === "loved-wash"
                                              ? lovedWashVisible
                                              : lovedBandVisible
                        }
                        onChange={(e) => {
                          const next = e.target.checked;
                          if (adminEditLayer === "primary") {
                            setPrimarySettingsAndSave({ ...heroPrimarySettings, visible: next });
                          } else if (adminEditLayer === "overlay") {
                            setOverlayLayerAndSave({ ...heroOverlayLayer, visible: next });
                          } else if (adminEditLayer === "background") {
                            setBackgroundVisible(next);
                            void persistHeroVisualPatch({ backgroundVisible: next });
                          } else if (adminEditLayer === "headline") {
                            setHeadlineVisible(next);
                            void persistHeroVisualPatch({ headlineVisible: next });
                          } else if (adminEditLayer === "eyebrow") {
                            setEyebrowVisible(next);
                            void persistHeroVisualPatch({ eyebrowVisible: next });
                          } else if (adminEditLayer === "actions") {
                            setActionsVisible(next);
                            void persistHeroVisualPatch({ actionsVisible: next });
                          } else if (adminEditLayer === "ritual-band") {
                            if (persistLayoutToMobile) {
                              applyMobilePatch({ ritualBandVisible: next });
                            } else {
                              setRitualBandVisible(next);
                              void persistHeroVisualPatch({ ritualBandVisible: next });
                            }
                          } else if (adminEditLayer === "rituals") {
                            setRitualsVisible(next);
                            void persistHeroVisualPatch({ ritualsVisible: next });
                          } else if (adminEditLayer === "loved-section") {
                            setLovedSectionVisible(next);
                            void persistHeroVisualPatch({ lovedSectionVisible: next });
                          } else if (adminEditLayer === "loved-florals") {
                            setLovedFloralsVisible(next);
                            void persistHeroVisualPatch({ lovedFloralsVisible: next });
                          } else if (adminEditLayer === "loved-wash") {
                            setLovedWashVisible(next);
                            void persistHeroVisualPatch({ lovedWashVisible: next });
                          } else {
                            setLovedBandVisible(next);
                            void persistHeroVisualPatch({ lovedBandVisible: next });
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="floating-admin-grid">
                    <span className="floating-admin-hint" style={{ color: "var(--soft-ink)", gridColumn: "1 / -1" }}>
                      Panel position & opacity (this browser only).
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
                      Top offset{" "}
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
                      const reset = { ...HERO_RITUAL_DEFAULT_POS_PCT };
                      setRitualCarouselPosPct(reset);
                      void persistHeroVisualPatch({ ritualCarouselPosPct: reset });
                      setRitualCarouselPos({ x: 0, y: 0 });
                      clearSavedVisualPositions();
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
                </div>
              ) : null}
            </div>

              </>
            ) : (
              <p className="floating-admin-hint">Turn on admin mode to edit layers.</p>
            )}
            </div>
          </>
        )}
      </div>
      ) : null}
      {promoEditorOpen && floatingPanelMinimized && promoEditorBanners[0] ? (
        <HomepagePromoQuickEditor
          banner={promoEditorBanners[0]}
          savedBanners={promoEditorBanners}
          status={promoEditorStatus}
          onChange={applyPromoEditorPreview}
          onModeChange={setPromoEditorModeOverride}
          onSaved={(banner) => {
            applyPromoEditorPreview(banner);
            setPromoEditorModeOverride(banner.promoModeEnabled !== false);
            setPromoPublishSucceeded(true);
            setPromoEditorStatus(banner.active ? "Published live." : "Draft saved.");
          }}
          onLibrarySaved={(banner) => {
            setPromoEditorBanners((current) => [
              current[0],
              banner,
              ...current.slice(1).filter((item) => item.id !== banner.id),
            ]);
          }}
          onLoadBanner={(banner) => {
            const loaded = {
              ...banner,
              presentation: "static" as const,
              animation: banner.animation === "marquee" ? "fade" as const : banner.animation,
            };
            setPromoEditorModeOverride(loaded.promoModeEnabled !== false);
            applyPromoEditorPreview(loaded);
            setPromoEditorStatus(`Loaded “${loaded.adminName || loaded.title || "Saved promo"}”.`);
          }}
          onCreateNew={() => {
            const fresh = createHomepagePromoDraft();
            setPromoEditorModeOverride(true);
            applyPromoEditorPreview(fresh);
            setPromoEditorStatus("New promo ready. Name it, design it, then save or publish.");
          }}
          onClose={() => {
            setPromoEditorOpen(false);
            setPromoEditorModeOverride(null);
            void refreshLivePromoBanners();
          }}
        />
      ) : null}
      {initialPromoPreview ? (
        <a
          className="homepage-promo-preview-edit"
          href="/?skipIntro=1&openPromoEditor=1"
          target="_top"
        >
          Edit promo
        </a>
      ) : null}
    </>
  );
}
