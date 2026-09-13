import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import { reconcileNewsletterCanvasState } from "./canvas-reconcile-stories";
import { syncAllBlocksToLegacy } from "./newsletter-block-legacy-sync";
import { buildMigratedNewsletterBlocks } from "./newsletter-migrate-legacy-blocks";
import { parseStoryImageFrame } from "./story-image-frame";
import { parseStorySpacingGaps } from "./story-spacing-gaps";
import {
  DEFAULT_BLOCK_IMAGE_TRANSFORM,
  DEFAULT_BLOCK_TEXT_STYLE,
  DEFAULT_TEXT_BOX_STYLE,
  DEFAULT_NEWSLETTER_LAYOUT_DIVIDER_PRESET,
  STORIES_STORAGE_KEY,
  type NewsletterBlock,
  type NewsletterBlockImageTransform,
  type NewsletterBlockTextStyle,
  type NewsletterCtaBlock,
  type NewsletterDecorativeLineBlock,
  type NewsletterDividerBlock,
  type NewsletterHeadingBlock,
  type NewsletterImageBlock,
  type NewsletterSpacerBlock,
  type NewsletterStoryBlock,
  type NewsletterTextBlock,
  type NewsletterTextBoxBlock,
  type NewsletterTextBoxStyle,
  type StoriesState,
  type StoryRecord,
  type StorySource,
  type NewsletterElementStyle,
  type NewsletterImageTransform,
  type NewsletterImageTransforms,
  type NewsletterLayoutDivider,
  type NewsletterLayoutDividerPreset,
  type NewsletterLayoutSectionId,
  type NewsletterBlockSync
} from "./story-types";

const storageDir = path.join(process.cwd(), "data");
const storagePath = path.join(storageDir, "stories.json");
const storiesKvKey = "maroma:stories";
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const defaultState: StoriesState = {
  stories: [],
  socialSources: {
    instagram: "https://www.instagram.com/maromaindia/",
    facebook: "https://www.facebook.com/maromaindia"
  },
  rssFeedUrls: [],
  newsletterTitle: "Newsletter",
  newsletterIntro: "Welcome to the latest issue from Maroma.",
  newsletterTopImageUrl: "",
  newsletterLogoUrl: "",
  newsletterPortraitUrl: "",
  newsletterHeroImageUrl: "",
  newsletterMission: "",
  newsletterMissionHtml: "",
  newsletterMissionHeading: "Maroma mission",
  newsletterWelcomeLaura: "",
  newsletterWelcomeLauraHtml: "",
  newsletterGreetingHeading: "Greeting from CEO",
  newsletterTextAlign: "center",
  newsletterBackgroundColor: "#10151c",
  newsletterFontFamily: "serif",
  newsletterSectionHeadingSizeRem: 0.86,
  newsletterIssueHeadingSizeRem: 3,
  newsletterBodyFontSizeRem: 1.04,
  newsletterElementStyles: {
    issueHeading: {
      fontFamily: "inherit",
      fontSizeRem: 3,
      textAlign: "center",
      fontWeight: 700,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: "",
      offsetX: 0,
      offsetY: 0
    },
    missionHeading: {
      fontFamily: "inherit",
      fontSizeRem: 0.86,
      textAlign: "center",
      fontWeight: 600,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: "",
      offsetX: 0,
      offsetY: 0
    },
    missionBody: {
      fontFamily: "inherit",
      fontSizeRem: 1.04,
      textAlign: "center",
      fontWeight: 400,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: "",
      offsetX: 0,
      offsetY: 0
    },
    greetingHeading: {
      fontFamily: "inherit",
      fontSizeRem: 0.86,
      textAlign: "center",
      fontWeight: 600,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: "",
      offsetX: 0,
      offsetY: 0
    },
    greetingBody: {
      fontFamily: "inherit",
      fontSizeRem: 1.04,
      textAlign: "center",
      fontWeight: 400,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: "",
      offsetX: 0,
      offsetY: 0
    },
    executiveBriefTitle: {
      fontFamily: "inherit",
      fontSizeRem: 0.95,
      textAlign: "center",
      fontWeight: 600,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: "",
      offsetX: 0,
      offsetY: 0
    },
    executiveBriefBody: {
      fontFamily: "inherit",
      fontSizeRem: 0.92,
      textAlign: "left",
      fontWeight: 400,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: "",
      offsetX: 0,
      offsetY: 0
    },
    executiveBriefLink: {
      fontFamily: "inherit",
      fontSizeRem: 0.82,
      textAlign: "left",
      fontWeight: 600,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: "",
      offsetX: 0,
      offsetY: 0
    },
    executiveBriefSection: {
      fontFamily: "inherit",
      fontSizeRem: 1,
      textAlign: "left",
      fontWeight: 400,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: "",
      offsetX: 0,
      offsetY: 0
    },
    storyTitle: {
      fontFamily: "inherit",
      fontSizeRem: 1.6,
      textAlign: "center",
      fontWeight: 600,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: "",
      offsetX: 0,
      offsetY: 0
    },
    storyExcerpt: {
      fontFamily: "inherit",
      fontSizeRem: 1,
      textAlign: "center",
      fontWeight: 400,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: "",
      offsetX: 0,
      offsetY: 0
    },
    storyBody: {
      fontFamily: "inherit",
      fontSizeRem: 1,
      textAlign: "left",
      fontWeight: 400,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: "",
      offsetX: 0,
      offsetY: 0
    },
    storyMeta: {
      fontFamily: "inherit",
      fontSizeRem: 0.82,
      textAlign: "center",
      fontWeight: 400,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: "",
      offsetX: 0,
      offsetY: 0
    },
    storyCta: {
      fontFamily: "inherit",
      fontSizeRem: 0.85,
      textAlign: "center",
      fontWeight: 600,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: "",
      offsetX: 0,
      offsetY: 0
    }
  },
  newsletterImageTransforms: {
    topImage: { x: 0, y: 0, zoom: 1, borderRadius: 14, zIndex: 0 },
    logo: { x: 0, y: 0, zoom: 1, borderRadius: 0, zIndex: 0 },
    portrait: { x: 0, y: 0, zoom: 1, borderRadius: 9999, zIndex: 2 },
    hero: { x: 0, y: 0, zoom: 1, borderRadius: 14, zIndex: 1 }
  },
  newsletterLayoutDividers: [],
  newsletterLayoutDividerPreset: { ...DEFAULT_NEWSLETTER_LAYOUT_DIVIDER_PRESET },
  newsletterStoryTextColor: "",
  newsletterBlocks: [],
  newsletterBlocksMigrationVersion: 0,
  executiveBriefTitle: "Top Stories This Month",
  executiveBriefStoryIds: ["", "", ""],
  executiveBriefImageOverrides: ["", "", ""],
  executiveBriefImageTransforms: [
    { x: 0, y: 0, zoom: 1, borderRadius: 12, zIndex: 0 },
    { x: 0, y: 0, zoom: 1, borderRadius: 12, zIndex: 0 },
    { x: 0, y: 0, zoom: 1, borderRadius: 12, zIndex: 0 }
  ],
  newsletterShowDate: true,
  newsletterCanvas: { enabled: false, elements: [] },
  newsletterIssueTemplate: null
};

const ALLOWED_LAYOUT_SECTIONS: ReadonlyArray<NewsletterLayoutSectionId> = [
  "logo",
  "topImage",
  "portraitHero",
  "issueHeading",
  "mission",
  "greeting",
  "stories"
];

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const STORY_SOURCES: ReadonlyArray<StorySource> = ["manual", "instagram", "facebook", "web", "rss"];

const newRandomId = (prefix: string): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

function parseBlockTextStyle(input: unknown, fallback: NewsletterBlockTextStyle = DEFAULT_BLOCK_TEXT_STYLE): NewsletterBlockTextStyle {
  if (!input || typeof input !== "object") return { ...fallback };
  const raw = input as Record<string, unknown>;
  return {
    fontFamily: typeof raw.fontFamily === "string" && raw.fontFamily.trim() ? raw.fontFamily : fallback.fontFamily,
    fontSizeRem: clampNumber(raw.fontSizeRem, 0.5, 6, fallback.fontSizeRem),
    fontWeight: clampNumber(raw.fontWeight, 100, 900, fallback.fontWeight),
    color: typeof raw.color === "string" ? raw.color.trim() : fallback.color,
    textAlign:
      raw.textAlign === "left" || raw.textAlign === "center" || raw.textAlign === "right"
        ? raw.textAlign
        : fallback.textAlign,
    italic: Boolean(raw.italic),
    underline: Boolean(raw.underline),
    lineHeight: clampNumber(raw.lineHeight, 0.7, 4, fallback.lineHeight),
    letterSpacingEm: clampNumber(raw.letterSpacingEm, -0.2, 1, fallback.letterSpacingEm),
    marginTopRem: clampNumber(raw.marginTopRem, 0, 12, fallback.marginTopRem),
    marginBottomRem: clampNumber(raw.marginBottomRem, 0, 12, fallback.marginBottomRem),
    maxWidthRem: clampNumber(raw.maxWidthRem, 0, 200, fallback.maxWidthRem)
  };
}

function parseBlockImageTransform(
  input: unknown,
  fallback: NewsletterBlockImageTransform = DEFAULT_BLOCK_IMAGE_TRANSFORM
): NewsletterBlockImageTransform {
  if (!input || typeof input !== "object") return { ...fallback };
  const raw = input as Record<string, unknown>;
  return {
    x: clampNumber(raw.x, -500, 500, fallback.x),
    y: clampNumber(raw.y, -500, 500, fallback.y),
    zoom: clampNumber(raw.zoom, 0.01, 3, fallback.zoom),
    borderRadius: clampNumber(raw.borderRadius, 0, 9999, fallback.borderRadius),
    zIndex:
      typeof raw.zIndex === "number" && Number.isFinite(raw.zIndex)
        ? Math.min(999, Math.max(-999, Math.round(raw.zIndex)))
        : fallback.zIndex,
    widthPercent: clampNumber(raw.widthPercent, 10, 100, fallback.widthPercent),
    aspectRatio: typeof raw.aspectRatio === "string" ? raw.aspectRatio.trim() : fallback.aspectRatio,
    objectFit: raw.objectFit === "contain" ? "contain" : "cover",
    maxFrameHeightPx: clampNumber(raw.maxFrameHeightPx, 0, 2000, fallback.maxFrameHeightPx),
    marginTopRem: clampNumber(raw.marginTopRem, 0, 12, fallback.marginTopRem),
    marginBottomRem: clampNumber(raw.marginBottomRem, 0, 12, fallback.marginBottomRem)
  };
}

function parseTextBoxStyle(
  input: unknown,
  fallback: NewsletterTextBoxStyle = DEFAULT_TEXT_BOX_STYLE
): NewsletterTextBoxStyle {
  if (!input || typeof input !== "object") return { ...fallback };
  const raw = input as Record<string, unknown>;
  return {
    offsetX: clampNumber(raw.offsetX, -2000, 2000, fallback.offsetX),
    offsetY: clampNumber(raw.offsetY, -2000, 2000, fallback.offsetY),
    widthPercent: clampNumber(raw.widthPercent, 10, 100, fallback.widthPercent),
    paddingRem: clampNumber(raw.paddingRem, 0, 8, fallback.paddingRem),
    backgroundColor:
      typeof raw.backgroundColor === "string" ? raw.backgroundColor.trim() : fallback.backgroundColor,
    outlineColor:
      typeof raw.outlineColor === "string" ? raw.outlineColor.trim() : fallback.outlineColor,
    outlineWidthPx: clampNumber(raw.outlineWidthPx, 0, 24, fallback.outlineWidthPx),
    borderRadiusPx: clampNumber(raw.borderRadiusPx, 0, 200, fallback.borderRadiusPx),
    shadowColor:
      typeof raw.shadowColor === "string" ? raw.shadowColor.trim() : fallback.shadowColor,
    shadowBlurPx: clampNumber(raw.shadowBlurPx, 0, 120, fallback.shadowBlurPx),
    shadowOffsetX: clampNumber(raw.shadowOffsetX, -120, 120, fallback.shadowOffsetX),
    shadowOffsetY: clampNumber(raw.shadowOffsetY, -120, 120, fallback.shadowOffsetY),
    marginTopRem: clampNumber(raw.marginTopRem, 0, 12, fallback.marginTopRem),
    marginBottomRem: clampNumber(raw.marginBottomRem, 0, 12, fallback.marginBottomRem)
  };
}

function parseBlockSync(raw: Record<string, unknown>): NewsletterBlockSync | undefined {
  const s = raw.sync;
  if (!s || typeof s !== "object") return undefined;
  const o = s as Record<string, unknown>;
  const kind = o.kind;
  if (kind === "issueTitle" || kind === "missionHeading" || kind === "greetingHeading") {
    return { kind } as NewsletterBlockSync;
  }
  if (kind === "missionBody" || kind === "greetingBody") {
    return { kind } as NewsletterBlockSync;
  }
  if (kind === "asset") {
    const slot = o.slot;
    if (slot === "topImage" || slot === "logo" || slot === "portrait" || slot === "hero") {
      return { kind: "asset", slot };
    }
  }
  return undefined;
}

function parseBlock(input: unknown): NewsletterBlock | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const kind = raw.kind;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : newRandomId("blk");
  if (kind === "heading") {
    const level = raw.level === 1 || raw.level === 2 || raw.level === 3 || raw.level === 4 ? raw.level : 2;
    const headingDefaults: NewsletterBlockTextStyle = {
      ...DEFAULT_BLOCK_TEXT_STYLE,
      fontWeight: 700,
      fontSizeRem: level === 1 ? 2.6 : level === 2 ? 1.6 : level === 3 ? 1.2 : 1
    };
    const block: NewsletterHeadingBlock = {
      id,
      kind: "heading",
      level,
      text: typeof raw.text === "string" ? raw.text : "",
      style: parseBlockTextStyle(raw.style, headingDefaults)
    };
    const sync = parseBlockSync(raw);
    if (
      sync &&
      (sync.kind === "issueTitle" || sync.kind === "missionHeading" || sync.kind === "greetingHeading")
    ) {
      block.sync = sync;
    }
    return block;
  }
  if (kind === "text") {
    const block: NewsletterTextBlock = {
      id,
      kind: "text",
      html: typeof raw.html === "string" ? raw.html : "",
      style: parseBlockTextStyle(raw.style)
    };
    const sync = parseBlockSync(raw);
    if (sync && (sync.kind === "missionBody" || sync.kind === "greetingBody")) {
      block.sync = sync;
    }
    return block;
  }
  if (kind === "text-box") {
    const block: NewsletterTextBoxBlock = {
      id,
      kind: "text-box",
      html:
        typeof raw.html === "string"
          ? raw.html
          : "<p>Click inside this box to edit text. Paste from Word, Docs, or the web to keep formatting.</p>",
      textStyle: parseBlockTextStyle(raw.textStyle, {
        ...DEFAULT_BLOCK_TEXT_STYLE,
        textAlign: "left",
        maxWidthRem: 0,
        marginTopRem: 0,
        marginBottomRem: 0
      }),
      boxStyle: parseTextBoxStyle(raw.boxStyle)
    };
    return block;
  }
  if (kind === "image") {
    const images = Array.isArray(raw.images)
      ? raw.images.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 12)
      : [];
    const block: NewsletterImageBlock = {
      id,
      kind: "image",
      images,
      alt: typeof raw.alt === "string" ? raw.alt : "",
      caption: typeof raw.caption === "string" ? raw.caption : "",
      transform: parseBlockImageTransform(raw.transform),
      captionStyle: parseBlockTextStyle(raw.captionStyle, {
        ...DEFAULT_BLOCK_TEXT_STYLE,
        fontSizeRem: 0.84,
        marginTopRem: 0.4,
        marginBottomRem: 0.4
      })
    };
    const sync = parseBlockSync(raw);
    if (sync && sync.kind === "asset") {
      block.sync = sync;
    }
    if (raw.pairRole === "portraitHeroLeft" || raw.pairRole === "portraitHeroRight") {
      block.pairRole = raw.pairRole;
    }
    return block;
  }
  if (kind === "cta") {
    const block: NewsletterCtaBlock = {
      id,
      kind: "cta",
      label: typeof raw.label === "string" ? raw.label : "Read more",
      url: typeof raw.url === "string" ? raw.url : "",
      variant:
        raw.variant === "primary" || raw.variant === "secondary" || raw.variant === "ghost"
          ? raw.variant
          : "primary",
      textAlign:
        raw.textAlign === "left" || raw.textAlign === "center" || raw.textAlign === "right"
          ? raw.textAlign
          : "center",
      marginTopRem: clampNumber(raw.marginTopRem, 0, 12, 0.6),
      marginBottomRem: clampNumber(raw.marginBottomRem, 0, 12, 0.6)
    };
    return block;
  }
  if (kind === "divider") {
    const block: NewsletterDividerBlock = {
      id,
      kind: "divider",
      marginTopRem: clampNumber(raw.marginTopRem, 0, 12, 1.2),
      marginBottomRem: clampNumber(raw.marginBottomRem, 0, 12, 1.2)
    };
    return block;
  }
  if (kind === "decorative-line") {
    const block: NewsletterDecorativeLineBlock = {
      id,
      kind: "decorative-line",
      preset: parseLayoutDividerPreset(raw.preset)
    };
    return block;
  }
  if (kind === "spacer") {
    const block: NewsletterSpacerBlock = {
      id,
      kind: "spacer",
      heightRem: clampNumber(raw.heightRem, 0, 24, 1.5)
    };
    return block;
  }
  if (kind === "story") {
    const snapRaw = raw.snapshot && typeof raw.snapshot === "object" ? (raw.snapshot as Record<string, unknown>) : {};
    const block: NewsletterStoryBlock = {
      id,
      kind: "story",
      storyId: typeof raw.storyId === "string" ? raw.storyId : "",
      snapshot: {
        title: typeof snapRaw.title === "string" ? snapRaw.title : "",
        excerpt: typeof snapRaw.excerpt === "string" ? snapRaw.excerpt : "",
        body: typeof snapRaw.body === "string" ? snapRaw.body : "",
        images: Array.isArray(snapRaw.images)
          ? snapRaw.images.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 12)
          : [],
        alt: typeof snapRaw.alt === "string" ? snapRaw.alt : "",
        publishedAt: typeof snapRaw.publishedAt === "string" ? snapRaw.publishedAt : new Date().toISOString(),
        source: STORY_SOURCES.includes(snapRaw.source as StorySource) ? (snapRaw.source as StorySource) : "manual",
        sourceUrl: typeof snapRaw.sourceUrl === "string" ? snapRaw.sourceUrl : "",
        ctaLabel: typeof snapRaw.ctaLabel === "string" ? snapRaw.ctaLabel : "Read more",
        ctaUrl: typeof snapRaw.ctaUrl === "string" ? snapRaw.ctaUrl : "",
        slug: typeof snapRaw.slug === "string" ? snapRaw.slug : ""
      }
    };
    if (snapRaw.imageTransform && typeof snapRaw.imageTransform === "object") {
      block.snapshot.imageTransform = parseBlockImageTransform(snapRaw.imageTransform);
    }
    const imageFrame = parseStoryImageFrame(snapRaw.imageFrame);
    if (imageFrame) block.snapshot.imageFrame = imageFrame;
    return block;
  }
  return null;
}

function parseLayoutDividerPreset(input: unknown): NewsletterLayoutDividerPreset {
  const fallback = DEFAULT_NEWSLETTER_LAYOUT_DIVIDER_PRESET;
  if (!input || typeof input !== "object") return { ...fallback };
  const raw = input as Record<string, unknown>;
  const lineStyle =
    raw.lineStyle === "dashed" || raw.lineStyle === "double" ? raw.lineStyle : fallback.lineStyle;
  const color =
    typeof raw.color === "string" && raw.color.trim() ? raw.color.trim() : fallback.color;
  return {
    offsetX: clampNumber(raw.offsetX, -2000, 2000, fallback.offsetX),
    offsetY: clampNumber(raw.offsetY, -2000, 2000, fallback.offsetY),
    marginTop: clampNumber(raw.marginTop, 0, 200, fallback.marginTop),
    marginBottom: clampNumber(raw.marginBottom, 0, 200, fallback.marginBottom),
    thickness: clampNumber(raw.thickness, 1, 12, fallback.thickness),
    color,
    widthPercent: clampNumber(raw.widthPercent, 10, 100, fallback.widthPercent),
    lineStyle
  };
}

function parseLayoutDivider(input: unknown): NewsletterLayoutDivider | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const sectionId = ALLOWED_LAYOUT_SECTIONS.includes(raw.sectionId as NewsletterLayoutSectionId)
    ? (raw.sectionId as NewsletterLayoutSectionId)
    : null;
  if (!sectionId) return null;
  const placement = raw.placement === "before" ? "before" : "after";
  const lineStyle =
    raw.lineStyle === "dashed" || raw.lineStyle === "double" ? raw.lineStyle : "solid";
  const color =
    typeof raw.color === "string" && raw.color.trim() ? raw.color.trim() : "rgba(230, 245, 239, 0.55)";
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `divider-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`);
  return {
    id,
    sectionId,
    placement,
    offsetX: clampNumber(raw.offsetX, -2000, 2000, 0),
    offsetY: clampNumber(raw.offsetY, -2000, 2000, 0),
    marginTop: clampNumber(raw.marginTop, 0, 200, 12),
    marginBottom: clampNumber(raw.marginBottom, 0, 200, 12),
    thickness: clampNumber(raw.thickness, 1, 12, 1),
    color,
    widthPercent: clampNumber(raw.widthPercent, 10, 100, 72),
    lineStyle
  };
}

function parseElementStyle(input: unknown, fallback: NewsletterElementStyle): NewsletterElementStyle {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    fontFamily: typeof raw.fontFamily === "string" && raw.fontFamily.trim() ? raw.fontFamily : fallback.fontFamily,
    fontSizeRem:
      typeof raw.fontSizeRem === "number" ? Math.min(5, Math.max(0.6, raw.fontSizeRem)) : fallback.fontSizeRem,
    textAlign: raw.textAlign === "left" ? "left" : raw.textAlign === "center" ? "center" : fallback.textAlign,
    fontWeight:
      typeof raw.fontWeight === "number" ? Math.min(800, Math.max(300, raw.fontWeight)) : fallback.fontWeight,
    isQuoteBox: Boolean(raw.isQuoteBox),
    quoteBoxColor:
      typeof raw.quoteBoxColor === "string" && raw.quoteBoxColor.trim()
        ? raw.quoteBoxColor
        : fallback.quoteBoxColor,
    color: typeof raw.color === "string" ? raw.color.trim() : fallback.color,
    offsetX:
      typeof raw.offsetX === "number" && Number.isFinite(raw.offsetX)
        ? Math.min(2000, Math.max(-2000, raw.offsetX))
        : fallback.offsetX,
    offsetY:
      typeof raw.offsetY === "number" && Number.isFinite(raw.offsetY)
        ? Math.min(2000, Math.max(-2000, raw.offsetY))
        : fallback.offsetY
  };
}

function parseImageTransforms(input: unknown, fallback: NewsletterImageTransforms): NewsletterImageTransforms {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const parseOne = (key: "topImage" | "logo" | "portrait" | "hero") => {
    const value = raw[key];
    const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return {
      x: typeof item.x === "number" ? Math.min(500, Math.max(-500, item.x)) : fallback[key].x,
      y: typeof item.y === "number" ? Math.min(500, Math.max(-500, item.y)) : fallback[key].y,
      zoom:
        typeof item.zoom === "number" && Number.isFinite(item.zoom)
          ? Math.min(3, Math.max(0.01, item.zoom))
          : fallback[key].zoom,
      borderRadius:
        typeof item.borderRadius === "number" && Number.isFinite(item.borderRadius)
          ? Math.min(9999, Math.max(0, item.borderRadius))
          : fallback[key].borderRadius,
      zIndex:
        typeof item.zIndex === "number" && Number.isFinite(item.zIndex)
          ? Math.min(999, Math.max(-999, Math.round(item.zIndex)))
          : fallback[key].zIndex
    };
  };
  return {
    topImage: parseOne("topImage"),
    logo: parseOne("logo"),
    portrait: parseOne("portrait"),
    hero: parseOne("hero")
  };
}

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "story";

const normalizeStory = (story: Partial<StoryRecord>): StoryRecord => {
  const now = new Date().toISOString();
  const kind: "story" | "divider" | "text" =
    story.kind === "divider" ? "divider" : story.kind === "text" ? "text" : "story";
  const title = (story.title ?? "").trim() || (kind === "text" ? "" : "Untitled story");
  const id = story.id ?? crypto.randomUUID();
  const slugSeed = story.slug?.trim() ? story.slug.trim() : title || kind;
  if (kind === "divider") {
    return {
      id,
      kind,
      slug: story.slug?.trim() || `divider-${id}`,
      title: "Divider",
      excerpt: "",
      body: "",
      imageUrl: "",
      sourceUrl: "",
      source: "manual",
      ctaLabel: "",
      ctaUrl: "",
      publishedAt: story.publishedAt ?? now,
      updatedAt: now,
      featured: Boolean(story.featured)
    };
  }
  if (kind === "text") {
    return {
      id,
      kind,
      slug: story.slug?.trim() || `text-${id}`,
      title,
      excerpt: (story.excerpt ?? "").trim(),
      body: (story.body ?? "").trim(),
      imageUrl: "",
      sourceUrl: "",
      source: "manual",
      ctaLabel: "",
      ctaUrl: "",
      publishedAt: story.publishedAt ?? now,
      updatedAt: now,
      featured: Boolean(story.featured)
    };
  }
  const rawImages = Array.isArray(story.images) ? story.images : [];
  const cleanedImages: string[] = [];
  for (const item of rawImages) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    cleanedImages.push(trimmed);
    if (cleanedImages.length >= 12) break;
  }
  const primary = (story.imageUrl ?? "").trim();
  if (primary && !cleanedImages.includes(primary)) cleanedImages.unshift(primary);
  const images = cleanedImages;
  const imageUrl = images[0] ?? primary;
  const imageFrame = parseStoryImageFrame((story as Record<string, unknown>).imageFrame);
  const out: StoryRecord = {
    id,
    kind,
    slug: toSlug(slugSeed),
    title,
    excerpt: (story.excerpt ?? "").trim(),
    body: (story.body ?? "").trim(),
    imageUrl,
    images: images.length > 0 ? images : undefined,
    sourceUrl: (story.sourceUrl ?? "").trim(),
    source: story.source ?? "manual",
    ctaLabel: (story.ctaLabel ?? "Read more").trim() || "Read more",
    ctaUrl: (story.ctaUrl ?? "").trim(),
    publishedAt: story.publishedAt ?? now,
    updatedAt: now,
    featured: Boolean(story.featured)
  };
  if (imageFrame) out.imageFrame = imageFrame;
  if (typeof story.articleOffsetX === "number" && Number.isFinite(story.articleOffsetX)) {
    out.articleOffsetX = story.articleOffsetX;
  }
  if (typeof story.articleOffsetY === "number" && Number.isFinite(story.articleOffsetY)) {
    out.articleOffsetY = story.articleOffsetY;
  }
  const passNum = (key: keyof StoryRecord) => {
    const v = (story as Record<string, unknown>)[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      (out as Record<string, unknown>)[key] = v;
    }
  };
  passNum("titleOffsetX");
  passNum("titleOffsetY");
  passNum("excerptOffsetX");
  passNum("excerptOffsetY");
  passNum("imageOffsetX");
  passNum("imageOffsetY");
  passNum("bodyOffsetX");
  passNum("bodyOffsetY");
  passNum("metaOffsetX");
  passNum("metaOffsetY");
  passNum("ctaOffsetX");
  passNum("ctaOffsetY");
  return out;
};

const parseState = (value: unknown): StoriesState => {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const stories = Array.isArray(raw.stories)
    ? raw.stories
        .map((s) => normalizeStory(s as Partial<StoryRecord>))
        .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    : [];
  const socialSources = raw.socialSources && typeof raw.socialSources === "object"
    ? (raw.socialSources as { instagram?: string; facebook?: string })
    : {};
  const rssFeedUrls = Array.isArray(raw.rssFeedUrls)
    ? raw.rssFeedUrls
        .filter((u): u is string => typeof u === "string")
        .map((u) => u.trim())
        .filter(Boolean)
    : defaultState.rssFeedUrls;

  const newsletterLayoutDividersParsed = Array.isArray(raw.newsletterLayoutDividers)
    ? raw.newsletterLayoutDividers
        .map((d) => parseLayoutDivider(d))
        .filter((d): d is NewsletterLayoutDivider => d !== null)
    : defaultState.newsletterLayoutDividers;
  const newsletterBlocksParsed = Array.isArray(raw.newsletterBlocks)
    ? raw.newsletterBlocks
        .map((b) => parseBlock(b))
        .filter((b): b is NewsletterBlock => b !== null)
    : defaultState.newsletterBlocks;

  const base: StoriesState = {
    stories,
    socialSources: {
      instagram: socialSources.instagram ?? defaultState.socialSources.instagram,
      facebook: socialSources.facebook ?? defaultState.socialSources.facebook
    },
    rssFeedUrls,
    newsletterTitle: typeof raw.newsletterTitle === "string" ? raw.newsletterTitle : defaultState.newsletterTitle,
    newsletterIntro: typeof raw.newsletterIntro === "string" ? raw.newsletterIntro : defaultState.newsletterIntro,
    newsletterTopImageUrl:
      typeof raw.newsletterTopImageUrl === "string" ? raw.newsletterTopImageUrl : defaultState.newsletterTopImageUrl,
    newsletterLogoUrl:
      typeof raw.newsletterLogoUrl === "string" ? raw.newsletterLogoUrl : defaultState.newsletterLogoUrl,
    newsletterPortraitUrl:
      typeof raw.newsletterPortraitUrl === "string" ? raw.newsletterPortraitUrl : defaultState.newsletterPortraitUrl,
    newsletterHeroImageUrl:
      typeof raw.newsletterHeroImageUrl === "string"
        ? raw.newsletterHeroImageUrl
        : defaultState.newsletterHeroImageUrl,
    newsletterMission:
      typeof raw.newsletterMission === "string" ? raw.newsletterMission : defaultState.newsletterMission,
    newsletterMissionHtml:
      typeof raw.newsletterMissionHtml === "string" ? raw.newsletterMissionHtml : defaultState.newsletterMissionHtml,
    newsletterMissionHeading:
      typeof raw.newsletterMissionHeading === "string"
        ? raw.newsletterMissionHeading
        : defaultState.newsletterMissionHeading,
    newsletterWelcomeLaura:
      typeof raw.newsletterWelcomeLaura === "string"
        ? raw.newsletterWelcomeLaura
        : defaultState.newsletterWelcomeLaura,
    newsletterWelcomeLauraHtml:
      typeof raw.newsletterWelcomeLauraHtml === "string"
        ? raw.newsletterWelcomeLauraHtml
        : defaultState.newsletterWelcomeLauraHtml,
    newsletterGreetingHeading:
      typeof raw.newsletterGreetingHeading === "string"
        ? raw.newsletterGreetingHeading
        : defaultState.newsletterGreetingHeading,
    newsletterTextAlign:
      raw.newsletterTextAlign === "left" || raw.newsletterTextAlign === "center"
        ? raw.newsletterTextAlign
        : defaultState.newsletterTextAlign,
    newsletterBackgroundColor:
      typeof raw.newsletterBackgroundColor === "string" && raw.newsletterBackgroundColor.trim()
        ? raw.newsletterBackgroundColor.trim()
        : defaultState.newsletterBackgroundColor,
    newsletterFontFamily:
      raw.newsletterFontFamily === "serif" ||
      raw.newsletterFontFamily === "sans" ||
      raw.newsletterFontFamily === "montserrat-light" ||
      raw.newsletterFontFamily === "raleway-light" ||
      raw.newsletterFontFamily === "josefin-light"
        ? raw.newsletterFontFamily
        : defaultState.newsletterFontFamily,
    newsletterSectionHeadingSizeRem:
      typeof raw.newsletterSectionHeadingSizeRem === "number"
        ? Math.min(2, Math.max(0.6, raw.newsletterSectionHeadingSizeRem))
        : defaultState.newsletterSectionHeadingSizeRem,
    newsletterIssueHeadingSizeRem:
      typeof raw.newsletterIssueHeadingSizeRem === "number"
        ? Math.min(5, Math.max(1.5, raw.newsletterIssueHeadingSizeRem))
        : defaultState.newsletterIssueHeadingSizeRem,
    newsletterBodyFontSizeRem:
      typeof raw.newsletterBodyFontSizeRem === "number"
        ? Math.min(2.4, Math.max(0.8, raw.newsletterBodyFontSizeRem))
        : defaultState.newsletterBodyFontSizeRem,
    newsletterElementStyles: {
      issueHeading: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.issueHeading,
        defaultState.newsletterElementStyles.issueHeading
      ),
      missionHeading: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.missionHeading,
        defaultState.newsletterElementStyles.missionHeading
      ),
      missionBody: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.missionBody,
        defaultState.newsletterElementStyles.missionBody
      ),
      greetingHeading: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.greetingHeading,
        defaultState.newsletterElementStyles.greetingHeading
      ),
      greetingBody: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.greetingBody,
        defaultState.newsletterElementStyles.greetingBody
      ),
      executiveBriefTitle: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.executiveBriefTitle,
        defaultState.newsletterElementStyles.executiveBriefTitle
      ),
      executiveBriefBody: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.executiveBriefBody,
        defaultState.newsletterElementStyles.executiveBriefBody
      ),
      executiveBriefLink: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.executiveBriefLink,
        defaultState.newsletterElementStyles.executiveBriefLink
      ),
      executiveBriefSection: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.executiveBriefSection,
        defaultState.newsletterElementStyles.executiveBriefSection
      ),
      storyTitle: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.storyTitle,
        defaultState.newsletterElementStyles.storyTitle
      ),
      storyExcerpt: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.storyExcerpt,
        defaultState.newsletterElementStyles.storyExcerpt
      ),
      storyBody: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.storyBody,
        defaultState.newsletterElementStyles.storyBody
      ),
      storyMeta: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.storyMeta,
        defaultState.newsletterElementStyles.storyMeta
      ),
      storyCta: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.storyCta,
        defaultState.newsletterElementStyles.storyCta
      )
    },
    newsletterImageTransforms: parseImageTransforms(raw.newsletterImageTransforms, defaultState.newsletterImageTransforms),
    newsletterLayoutDividers: newsletterLayoutDividersParsed,
    newsletterLayoutDividerPreset: parseLayoutDividerPreset(raw.newsletterLayoutDividerPreset),
    newsletterStoryTextColor:
      typeof raw.newsletterStoryTextColor === "string" ? raw.newsletterStoryTextColor.trim() : "",
    newsletterBlocks: newsletterBlocksParsed,
    newsletterBlocksMigrationVersion:
      typeof raw.newsletterBlocksMigrationVersion === "number" && raw.newsletterBlocksMigrationVersion >= 1 ? 1 : 0,
    executiveBriefTitle:
      typeof raw.executiveBriefTitle === "string"
        ? raw.executiveBriefTitle
        : defaultState.executiveBriefTitle,
    executiveBriefStoryIds: (() => {
      const arr = Array.isArray(raw.executiveBriefStoryIds) ? raw.executiveBriefStoryIds : [];
      const out = ["", "", ""];
      for (let i = 0; i < 3; i++) out[i] = typeof arr[i] === "string" ? (arr[i] as string) : "";
      return out;
    })(),
    executiveBriefImageOverrides: (() => {
      const arr = Array.isArray(raw.executiveBriefImageOverrides) ? raw.executiveBriefImageOverrides : [];
      const out = ["", "", ""];
      for (let i = 0; i < 3; i++) out[i] = typeof arr[i] === "string" ? (arr[i] as string) : "";
      return out;
    })(),
    executiveBriefImageTransforms: (() => {
      const arr = Array.isArray(raw.executiveBriefImageTransforms) ? raw.executiveBriefImageTransforms : [];
      const fallback = defaultState.executiveBriefImageTransforms;
      const parseOne = (item: unknown, fb: NewsletterImageTransform): NewsletterImageTransform => {
        const it = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return {
          x: typeof it.x === "number" ? Math.min(500, Math.max(-500, it.x)) : fb.x,
          y: typeof it.y === "number" ? Math.min(500, Math.max(-500, it.y)) : fb.y,
          zoom:
            typeof it.zoom === "number" && Number.isFinite(it.zoom)
              ? Math.min(3, Math.max(0.01, it.zoom))
              : fb.zoom,
          borderRadius:
            typeof it.borderRadius === "number" && Number.isFinite(it.borderRadius)
              ? Math.min(9999, Math.max(0, it.borderRadius))
              : fb.borderRadius,
          zIndex:
            typeof it.zIndex === "number" && Number.isFinite(it.zIndex)
              ? Math.min(999, Math.max(-999, Math.round(it.zIndex)))
              : fb.zIndex
        };
      };
      return [0, 1, 2].map((i) => parseOne(arr[i], fallback[i] ?? fallback[0]));
    })(),
    newsletterShowDate: typeof raw.newsletterShowDate === "boolean" ? raw.newsletterShowDate : true,
    newsletterIssueTemplate: null,
    newsletterCanvas: (() => {
      const c = raw.newsletterCanvas as Record<string, unknown> | null | undefined;
      if (!c || typeof c !== "object") return defaultState.newsletterCanvas;
      const dd = c.dividerDefaults as Record<string, unknown> | null | undefined;
      return {
        enabled: typeof c.enabled === "boolean" ? c.enabled : false,
        elements: Array.isArray(c.elements) ? c.elements : [],
        dividerDefaults: dd && typeof dd === "object" ? {
          color: typeof dd.color === "string" ? dd.color : "rgba(120,170,160,0.85)",
          thickness: typeof dd.thickness === "number" ? dd.thickness : 1,
          lineStyle: (dd.lineStyle === "solid" || dd.lineStyle === "dashed" || dd.lineStyle === "dotted")
            ? dd.lineStyle : "solid",
        } : undefined,
        measuredHeights:
          c.measuredHeights && typeof c.measuredHeights === "object" && !Array.isArray(c.measuredHeights)
            ? (c.measuredHeights as Record<string, number>)
            : undefined,
        storySpacingGaps: parseStorySpacingGaps(c.storySpacingGaps),
      };
    })()
  };

  if (raw.newsletterIssueTemplate && typeof raw.newsletterIssueTemplate === "object") {
    base.newsletterIssueTemplate = parseState({
      ...(raw.newsletterIssueTemplate as Record<string, unknown>),
      newsletterIssueTemplate: null,
    });
  }

  return base;
};

export function migrateLegacyToModular(state: StoriesState): StoriesState {
  if ((state.newsletterBlocksMigrationVersion ?? 0) >= 1) return state;
  return {
    ...state,
    newsletterBlocks: buildMigratedNewsletterBlocks({ ...state, newsletterBlocks: [] }),
    newsletterLayoutDividers: [],
    newsletterBlocksMigrationVersion: 1
  };
}

export async function readStoriesState(): Promise<StoriesState> {
  let parsed: StoriesState;
  if (hasKvConfig) {
    try {
      const stored = await kv.get(storiesKvKey);
      if (stored) {
        parsed = parseState(stored);
        const reconciled = reconcileNewsletterCanvasState(parsed);
        if (newsletterCanvasRepaired(parsed, reconciled)) {
          return writeStoriesState(reconciled);
        }
        return reconciled;
      }
    } catch {
      // fall back to file state
    }
  }
  try {
    const raw = await fs.readFile(storagePath, "utf8");
    parsed = parseState(JSON.parse(raw));
  } catch {
    parsed = parseState({ ...defaultState });
  }
  const reconciled = reconcileNewsletterCanvasState(parsed);
  if (newsletterCanvasRepaired(parsed, reconciled)) {
    return writeStoriesState(reconciled);
  }
  return reconciled;
}

function newsletterCanvasRepaired(before: StoriesState, after: StoriesState): boolean {
  const afterCanvas = after.newsletterCanvas;
  if (!afterCanvas?.enabled) return false;
  const beforeIds = new Set((before.newsletterCanvas?.elements ?? []).map((e) => e.id));
  const addedElement = (afterCanvas.elements ?? []).some((e) => !beforeIds.has(e.id));
  const beforeStories = (before.stories ?? []).filter((s) => !s.kind || s.kind === "story").length;
  const afterStories = (after.stories ?? []).filter((s) => !s.kind || s.kind === "story").length;
  return addedElement || afterStories > beforeStories;
}

export async function writeStoriesState(state: StoriesState): Promise<StoriesState> {
  const merged = syncAllBlocksToLegacy({ ...state, newsletterBlocks: state.newsletterBlocks ?? [] });
  const parsed = parseState(merged);
  if (hasKvConfig) {
    try {
      await kv.set(storiesKvKey, parsed);
      return parsed;
    } catch {
      // fall back to file state
    }
  }
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(parsed, null, 2), "utf8");
  return parsed;
}

export function mergeStoryById(existing: StoryRecord[], incoming: StoryRecord[]): StoryRecord[] {
  const next = new Map(existing.map((s) => [s.id, s]));
  for (const story of incoming) {
    next.set(story.id, story);
  }
  return Array.from(next.values()).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export { defaultState as defaultStoriesState, normalizeStory, parseState, toSlug };
export { STORIES_STORAGE_KEY };
