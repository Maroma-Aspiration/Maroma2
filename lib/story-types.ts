export type StorySource = "manual" | "instagram" | "facebook" | "web" | "rss";

/** Framing for a story’s single hero image (ignored when 2+ gallery images use a montage). */
export type StoryImageFrame = {
  /** CSS `aspect-ratio` value, e.g. `4 / 3`. Empty = no fixed ratio (height follows image, capped by max height). */
  aspectRatio: string;
  /** `contain` shows the full image inside the frame; `cover` fills the frame and may crop. */
  objectFit: "contain" | "cover";
  /** Maximum frame height in px. `0` = default theme cap (~360px). */
  maxHeightPx: number;
  /** Horizontal nudge of the image inside its frame, in px. Defaults to 0. */
  offsetX?: number;
  /** Vertical nudge of the image inside its frame, in px. Defaults to 0. */
  offsetY?: number;
  /** Image zoom inside the frame (1 = fit, >1 zooms in). Defaults to 1. */
  zoom?: number;
};

export const DEFAULT_STORY_IMAGE_FRAME: StoryImageFrame = {
  aspectRatio: "",
  objectFit: "cover",
  maxHeightPx: 0,
  offsetX: 0,
  offsetY: 0,
  zoom: 1
};

export type StoryRecord = {
  id: string;
  kind?: "story" | "divider" | "text";
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  imageUrl: string;
  /** Optional gallery — when 2+ entries are present, the story renders as a montage. images[0] mirrors imageUrl for backward compatibility. */
  images?: string[];
  /** Single-image layout; omitted = legacy newsletter/blog behavior. */
  imageFrame?: StoryImageFrame;
  sourceUrl: string;
  source: StorySource;
  ctaLabel: string;
  ctaUrl: string;
  publishedAt: string;
  updatedAt: string;
  featured?: boolean;
  /** Per-story horizontal nudge in px. Translates the entire story article. */
  articleOffsetX?: number;
  /** Per-story vertical nudge in px. Translates the entire story article. */
  articleOffsetY?: number;
  /** Per-story title nudge X/Y (px), independent of the global story title style. */
  titleOffsetX?: number;
  titleOffsetY?: number;
  /** Per-story excerpt nudge X/Y (px). */
  excerptOffsetX?: number;
  excerptOffsetY?: number;
  /** Per-story image block nudge X/Y (px), independent of crop/zoom inside the frame. */
  imageOffsetX?: number;
  imageOffsetY?: number;
  /** Per-story body nudge X/Y (px). */
  bodyOffsetX?: number;
  bodyOffsetY?: number;
  /** Per-story meta (date / source) nudge X/Y (px). */
  metaOffsetX?: number;
  metaOffsetY?: number;
  /** Per-story buttons / CTA nudge X/Y (px). */
  ctaOffsetX?: number;
  ctaOffsetY?: number;
};

export type StoriesState = {
  stories: StoryRecord[];
  socialSources: {
    instagram: string;
    facebook: string;
  };
  /** RSS / Atom feed URLs (e.g. third-party aggregator). Use only where terms allow. */
  rssFeedUrls: string[];
  /** Issue headline prefix (renders as `{title} | {month year}`). */
  newsletterTitle: string;
  /** Legacy fallback welcome line if `newsletterWelcomeLaura` is empty. */
  newsletterIntro: string;
  /** Optional decorative image rendered above the logo. */
  newsletterTopImageUrl: string;
  /** Header logo — empty uses `/maroma-logo.png`. */
  newsletterLogoUrl: string;
  /** Circular portrait (e.g. Laura); optional. */
  newsletterPortraitUrl: string;
  /** Large hero image below the portrait; optional. */
  newsletterHeroImageUrl: string;
  /** Mission statement block (below hero). */
  newsletterMission: string;
  /** Rich formatted mission statement HTML, used when present. */
  newsletterMissionHtml: string;
  /** Mission section heading label. */
  newsletterMissionHeading: string;
  /** Welcome message signed / from Laura (below issue title). */
  newsletterWelcomeLaura: string;
  /** Rich formatted CEO greeting HTML, used when present. */
  newsletterWelcomeLauraHtml: string;
  /** Greeting section heading label. */
  newsletterGreetingHeading: string;
  /** Newsletter text alignment preference. */
  newsletterTextAlign: "left" | "center";
  /** Newsletter shell background color (CSS color string, e.g. "#10151c"). */
  newsletterBackgroundColor: string;
  /**
   * Newsletter body font preference.
   *  - "serif"            = Cormorant Garamond
   *  - "sans"             = Montserrat (regular)
   *  - "montserrat-light" = Montserrat 300
   *  - "raleway-light"    = Raleway 200 (ExtraLight)
   *  - "josefin-light"    = Josefin Sans 300 (Light)
   */
  newsletterFontFamily:
    | "serif"
    | "sans"
    | "montserrat-light"
    | "raleway-light"
    | "josefin-light";
  /** Section heading size in rem. */
  newsletterSectionHeadingSizeRem: number;
  /** Issue heading size in rem. */
  newsletterIssueHeadingSizeRem: number;
  /** Body copy size in rem. */
  newsletterBodyFontSizeRem: number;
  /** Per-element style controls for newsletter. */
  newsletterElementStyles: Record<string, NewsletterElementStyle>;
  /** Per-image crop/position controls for newsletter assets. */
  newsletterImageTransforms: NewsletterImageTransforms;
  /** Decorative lines placed before/after sections in the header / body shell. */
  newsletterLayoutDividers: NewsletterLayoutDivider[];
  /** Default style for newly inserted decorative lines. Saved per-newsletter. */
  newsletterLayoutDividerPreset: NewsletterLayoutDividerPreset;
  /** Optional shared text color applied to story title/excerpt/body/meta. Empty = use theme defaults. */
  newsletterStoryTextColor: string;
  /** Modular newsletter blocks rendered in document order. */
  newsletterBlocks: NewsletterBlock[];
  /**
   * 0 = not migrated yet (first load will build blocks from legacy layout).
   * 1 = modular layout active; legacy chrome hidden in the editor.
   */
  newsletterBlocksMigrationVersion: number;
  /** Executive Brief pane heading (e.g. "Top Stories This Month"). Empty hides pane in preview. */
  executiveBriefTitle: string;
  /** Three story slots for the executive brief; each is a story id, or "" for auto-pick by order. */
  executiveBriefStoryIds: string[];
  /** Optional override image URL per executive brief slot. Empty = use the slot's story image. */
  executiveBriefImageOverrides: string[];
  /** Per-slot crop/zoom/position transforms for executive brief images. */
  executiveBriefImageTransforms: NewsletterImageTransform[];
  /** When false the "| Month Year" date is hidden from the issue heading. Defaults to true. */
  newsletterShowDate: boolean;
  /** Free-form canvas layout. When enabled replaces the legacy section layout. */
  newsletterCanvas: NewsletterCanvas;
  /** Optional saved baseline reused by "Create new issue". Null = use the current issue as the fallback template. */
  newsletterIssueTemplate?: StoriesState | null;
};

// ─── Canvas layout types ───────────────────────────────────────────────────

export type CanvasTextEl = {
  id: string;
  kind: "text";
  x: number;
  y: number;
  w: number;
  zIndex: number;
  locked?: boolean;
  /** User-placed Y — skip auto spacing until ⇕ Apply spacing. */
  spacingLocked?: boolean;
  html: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  textAlign: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  bg: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  shadow: boolean;
};

export type CanvasImageEl = {
  id: string;
  kind: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex: number;
  locked?: boolean;
  /** User-placed Y — skip auto spacing until ⇕ Apply spacing. */
  spacingLocked?: boolean;
  src: string;
  borderRadius: number;
  objectFit: "contain" | "cover";
  objectPositionX: number;
  objectPositionY: number;
  imageZoom: number;
  shadow: boolean;
  /** ID of the montage group this image belongs to (shared with all siblings) */
  montageGroup?: string;
  /** Number of columns in the montage grid */
  montageCols?: number;
  /** Zero-based index of this image within the montage */
  montageIndex?: number;
  /** Ungrouped from montage — keep free position, skip auto-stack / story slot. */
  montageDetached?: boolean;
  /** Custom montage frame width (px) — relayout preserves mosaic grid. */
  montageFrameW?: number;
  /** Custom montage frame height (px). */
  montageFrameH?: number;
};

export type CanvasDividerEl = {
  id: string;
  kind: "divider";
  x: number;
  y: number;
  w: number;
  zIndex: number;
  locked?: boolean;
  /** User-placed Y — skip auto spacing until ⇕ Apply spacing. */
  spacingLocked?: boolean;
  color: string;
  thickness: number;
  lineStyle: "solid" | "dashed" | "dotted";
};

export type CanvasStoryCardData = {
  storyId?: string;
  title: string;
  imageUrl?: string;
  excerpt?: string;
};

export type CanvasStoryGridEl = {
  id: string;
  kind: "story-grid";
  x: number;
  y: number;
  w: number;
  zIndex: number;
  locked?: boolean;
  columns: 2 | 3;
  headingText: string;
  headingColor: string;
  cardBg: string;
  textColor: string;
  stories: CanvasStoryCardData[];
};

export type CanvasCtaEl = {
  id: string;
  kind: "cta";
  x: number;
  y: number;
  w: number;
  zIndex: number;
  locked?: boolean;
  /** User-placed Y — skip auto spacing until ⇕ Apply spacing. */
  spacingLocked?: boolean;
  label: string;
  href: string;
  bgFrom: string;
  bgTo: string;
  textColor: string;
  borderRadius: number;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
};

export type CanvasEl = CanvasTextEl | CanvasImageEl | CanvasDividerEl | CanvasStoryGridEl | CanvasCtaEl;

export type DividerDefaults = {
  color: string;
  thickness: number;
  lineStyle: "solid" | "dashed" | "dotted";
};

export type NewsletterCanvas = {
  enabled: boolean;
  elements: CanvasEl[];
  dividerDefaults?: DividerDefaults;
  /** DOM-measured block heights from the editor — keeps email export aligned with canvas. */
  measuredHeights?: Record<string, number>;
  /** Story spacing slider values — saved with the newsletter. */
  storySpacingGaps?: import("./story-spacing-gaps").StorySpacingGaps;
};

export const STORIES_STORAGE_KEY = "maroma-stories-state";

/** Logical newsletter regions that can have a decorative line above/below them. */
export type NewsletterLayoutSectionId =
  | "logo"
  | "topImage"
  | "portraitHero"
  | "issueHeading"
  | "mission"
  | "greeting"
  | "stories";

/** A user-placed decorative horizontal rule attached to a section. */
export type NewsletterLayoutDivider = {
  id: string;
  sectionId: NewsletterLayoutSectionId;
  placement: "before" | "after";
  /** Horizontal nudge in px. */
  offsetX: number;
  /** Vertical nudge in px. */
  offsetY: number;
  /** Space above the line in px. */
  marginTop: number;
  /** Space below the line in px. */
  marginBottom: number;
  /** Stroke thickness in px. */
  thickness: number;
  /** CSS color string. */
  color: string;
  /** Width of the line as a percent of the available column (10-100). */
  widthPercent: number;
  /** Border style. */
  lineStyle: "solid" | "dashed" | "double";
};

/** Style preset reused for every newly inserted decorative line. */
export type NewsletterLayoutDividerPreset = Pick<
  NewsletterLayoutDivider,
  | "offsetX"
  | "offsetY"
  | "marginTop"
  | "marginBottom"
  | "thickness"
  | "color"
  | "widthPercent"
  | "lineStyle"
>;

export const DEFAULT_NEWSLETTER_LAYOUT_DIVIDER_PRESET: NewsletterLayoutDividerPreset = {
  offsetX: 0,
  offsetY: 0,
  marginTop: 14,
  marginBottom: 14,
  thickness: 1,
  color: "rgba(230, 245, 239, 0.55)",
  widthPercent: 72,
  lineStyle: "solid"
};

export type NewsletterElementStyle = {
  fontFamily: string;
  fontSizeRem: number;
  textAlign: "left" | "center";
  fontWeight: number;
  isQuoteBox: boolean;
  quoteBoxColor: string;
  /** Optional text color (CSS color string). Empty falls back to inherited theme color. */
  color: string;
  /** Horizontal nudge in px (positive = right). */
  offsetX: number;
  /** Vertical nudge in px (positive = down). */
  offsetY: number;
};

export type NewsletterImageTransform = {
  x: number;
  y: number;
  zoom: number;
  /** Corner radius in pixels (>=0). Defaults vary per image type. */
  borderRadius: number;
  /** Stacking order. Higher values render on top. Defaults to 0. */
  zIndex: number;
};

export type NewsletterImageTransforms = {
  topImage: NewsletterImageTransform;
  logo: NewsletterImageTransform;
  portrait: NewsletterImageTransform;
  hero: NewsletterImageTransform;
};

/** Shared text-styling controls available on every text-bearing block. */
export type NewsletterBlockTextStyle = {
  /** Font family CSS string ("inherit" honours newsletter default). */
  fontFamily: string;
  /** Font size in rem. */
  fontSizeRem: number;
  /** Font weight (300, 400, 500, 600, 700, 800). */
  fontWeight: number;
  /** CSS color string ("" honours newsletter default / inherited story color). */
  color: string;
  /** Text alignment. */
  textAlign: "left" | "center" | "right";
  /** Italic. */
  italic: boolean;
  /** Underline. */
  underline: boolean;
  /** Vertical line spacing as a CSS line-height number (e.g. 1.0–2.5). */
  lineHeight: number;
  /** Inter-letter tracking in em (e.g. -0.05 tight → 0.30 expanded). */
  letterSpacingEm: number;
  /** Top margin in rem (block above space). */
  marginTopRem: number;
  /** Bottom margin in rem (block below space). */
  marginBottomRem: number;
  /** Maximum readable width in rem (0 = full width). */
  maxWidthRem: number;
};

export const DEFAULT_BLOCK_TEXT_STYLE: NewsletterBlockTextStyle = {
  fontFamily: "inherit",
  fontSizeRem: 1.04,
  fontWeight: 400,
  color: "",
  textAlign: "center",
  italic: false,
  underline: false,
  lineHeight: 1.55,
  letterSpacingEm: 0,
  marginTopRem: 0.6,
  marginBottomRem: 0.6,
  maxWidthRem: 0
};

/** Per-image transform on a block. */
export type NewsletterBlockImageTransform = {
  /** Horizontal position as percent (-500 to 500). */
  x: number;
  /** Vertical position as percent (-500 to 500). */
  y: number;
  /** Zoom factor (0.01 to 3). */
  zoom: number;
  /** Corner radius in pixels (0 to 9999). */
  borderRadius: number;
  /** Stacking order when overlapping (matches header image transforms). */
  zIndex: number;
  /** Width as percent of available column (10 to 100). */
  widthPercent: number;
  /** Aspect ratio "width / height" CSS string (empty = natural). */
  aspectRatio: string;
  /** How the bitmap fills the frame when aspect ratio is set (or max height caps the box). */
  objectFit: "contain" | "cover";
  /** Max height of the image frame in px; `0` = no extra cap beyond CSS defaults. */
  maxFrameHeightPx: number;
  /** Top margin in rem. */
  marginTopRem: number;
  /** Bottom margin in rem. */
  marginBottomRem: number;
};

export const DEFAULT_BLOCK_IMAGE_TRANSFORM: NewsletterBlockImageTransform = {
  x: 0,
  y: 0,
  zoom: 1,
  borderRadius: 14,
  zIndex: 0,
  widthPercent: 100,
  aspectRatio: "",
  objectFit: "cover",
  maxFrameHeightPx: 0,
  marginTopRem: 0.6,
  marginBottomRem: 0.6
};

/** Bidirectional sync between a block and legacy newsletter fields (API / imports). */
export type NewsletterBlockSync =
  | { kind: "issueTitle" }
  | { kind: "missionHeading" }
  | { kind: "missionBody" }
  | { kind: "greetingHeading" }
  | { kind: "greetingBody" }
  | { kind: "asset"; slot: "topImage" | "logo" | "portrait" | "hero" };

export type NewsletterHeadingBlock = {
  id: string;
  kind: "heading";
  level: 1 | 2 | 3 | 4;
  text: string;
  style: NewsletterBlockTextStyle;
  /** When set, edits mirror legacy fields (e.g. newsletterTitle). */
  sync?: NewsletterBlockSync;
};

export type NewsletterTextBlock = {
  id: string;
  kind: "text";
  /** Sanitised rich HTML body. */
  html: string;
  style: NewsletterBlockTextStyle;
  sync?: NewsletterBlockSync;
};

/** Visual container controls for rich text boxes. */
export type NewsletterTextBoxStyle = {
  /** Horizontal nudge in px. */
  offsetX: number;
  /** Vertical nudge in px. */
  offsetY: number;
  /** Width as percent of available newsletter body. */
  widthPercent: number;
  /** Inner padding in rem. */
  paddingRem: number;
  /** Background fill color. Empty = transparent. */
  backgroundColor: string;
  /** Outline/border color. Empty = transparent. */
  outlineColor: string;
  /** Outline/border thickness in px. */
  outlineWidthPx: number;
  /** Corner radius in px. */
  borderRadiusPx: number;
  /** Shadow color. Empty or fully transparent = no visible shadow. */
  shadowColor: string;
  /** Shadow blur in px. */
  shadowBlurPx: number;
  /** Shadow horizontal offset in px. */
  shadowOffsetX: number;
  /** Shadow vertical offset in px. */
  shadowOffsetY: number;
  /** Top margin in rem. */
  marginTopRem: number;
  /** Bottom margin in rem. */
  marginBottomRem: number;
};

export const DEFAULT_TEXT_BOX_STYLE: NewsletterTextBoxStyle = {
  offsetX: 0,
  offsetY: 0,
  widthPercent: 92,
  paddingRem: 1.1,
  backgroundColor: "rgba(255, 255, 255, 0.08)",
  outlineColor: "rgba(112, 201, 217, 0.55)",
  outlineWidthPx: 1,
  borderRadiusPx: 18,
  shadowColor: "rgba(0, 0, 0, 0.22)",
  shadowBlurPx: 24,
  shadowOffsetX: 0,
  shadowOffsetY: 12,
  marginTopRem: 1,
  marginBottomRem: 1
};

export type NewsletterTextBoxBlock = {
  id: string;
  kind: "text-box";
  /** Sanitised rich HTML body. */
  html: string;
  /** Text controls for the editable content inside the box. */
  textStyle: NewsletterBlockTextStyle;
  /** Visual controls for the box itself. */
  boxStyle: NewsletterTextBoxStyle;
};

export type NewsletterImageBlock = {
  id: string;
  kind: "image";
  /** One or more image URLs (data: or remote). 2+ renders as a tasteful montage. */
  images: string[];
  /** Required SEO/accessibility alt text (empty allowed but discouraged). */
  alt: string;
  /** Optional caption rendered below the image. */
  caption: string;
  transform: NewsletterBlockImageTransform;
  /** Caption style. */
  captionStyle: NewsletterBlockTextStyle;
  /** When set, URLs and transforms sync with legacy header assets. */
  sync?: Extract<NewsletterBlockSync, { kind: "asset" }>;
  /** Pair portrait + hero side-by-side in the top grid. */
  pairRole?: "portraitHeroLeft" | "portraitHeroRight";
};

export type NewsletterCtaBlock = {
  id: string;
  kind: "cta";
  label: string;
  url: string;
  variant: "primary" | "secondary" | "ghost";
  textAlign: "left" | "center" | "right";
  marginTopRem: number;
  marginBottomRem: number;
};

export type NewsletterDividerBlock = {
  id: string;
  kind: "divider";
  /** Full horizontal rule. */
  marginTopRem: number;
  marginBottomRem: number;
};

export type NewsletterDecorativeLineBlock = {
  id: string;
  kind: "decorative-line";
  preset: NewsletterLayoutDividerPreset;
};

export type NewsletterSpacerBlock = {
  id: string;
  kind: "spacer";
  heightRem: number;
};

export type NewsletterStoryBlock = {
  id: string;
  kind: "story";
  /** Source story id, optionally referencing `state.stories[]`. */
  storyId: string;
  /** Pinned story snapshot for SEO and email rendering. */
  snapshot: {
    title: string;
    excerpt: string;
    body: string;
    images: string[];
    alt: string;
    publishedAt: string;
    source: StorySource;
    sourceUrl: string;
    ctaLabel: string;
    ctaUrl: string;
    slug: string;
    imageFrame?: StoryImageFrame;
    /** Per-story image crop frame + pan/zoom (newsletter view). Falls back to defaults when omitted. */
    imageTransform?: NewsletterBlockImageTransform;
  };
};

export type NewsletterBlock =
  | NewsletterHeadingBlock
  | NewsletterTextBlock
  | NewsletterTextBoxBlock
  | NewsletterImageBlock
  | NewsletterCtaBlock
  | NewsletterDividerBlock
  | NewsletterDecorativeLineBlock
  | NewsletterSpacerBlock
  | NewsletterStoryBlock;

export type NewsletterBlockKind = NewsletterBlock["kind"];
