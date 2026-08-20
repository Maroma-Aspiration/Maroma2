/**
 * canvas-to-email.ts
 *
 * Converts a NewsletterCanvas into HTML email: preserve editor layout (WYSIWYG Y),
 * paint-order layers, absolute positioning scaled from 716px canvas to 600px email width.
 */

import type {
  NewsletterCanvas,
  CanvasEl,
  CanvasTextEl,
  CanvasImageEl,
  CanvasDividerEl,
  CanvasStoryGridEl,
  CanvasCtaEl,
  StoriesState,
} from "./story-types";
import {
  ISSUE_GREETING_HD_PAD_TOP,
  canvasExportHeightCanvasPx,
  canvasExportMinY,
  canvasLayoutOrder,
  effectiveStoryGridHeight,
  MASTHEAD_PORTRAIT_SIZE,
  measureElementHeight,
  NEWSLETTER_CANVAS_WIDTH,
} from "./canvas-layout";
import {
  layoutNewsletterCanvas,
  normalizeCanvasVisualsForEmail,
  snapStoryCtasForEmailRender,
} from "./canvas-render-layout";
import {
  isFullBleedCanvasImage,
  montageImageBorderRadius,
  montageLayoutSpec,
  MONTAGE_EMAIL_GAP,
} from "./canvas-montage";
import {
  DEFAULT_STORY_SPACING_GAPS,
  STORY_BODY_TO_CTA_GAP,
  gapBetweenStoryElements,
  type StorySpacingGaps,
} from "./story-spacing-gaps";

const CANVAS_W = 716;
const EMAIL_W = 600;

const MASTHEAD_LAYER_IDS = new Set([
  "migrated-top",
  "migrated-logo",
  "migrated-portrait",
  "migrated-hero",
]);

const MISSION_LAYER_IDS = new Set(["migrated-mission-hd", "migrated-mission"]);

/** ~1mm gap between masthead banner and hero (same scale as story spacing). */
const MASTHEAD_IMAGE_GAP_PX = Math.round(STORY_BODY_TO_CTA_GAP / 35);
/** ~2mm gap from masthead hero to mission text on mobile. */
const MASTHEAD_MOBILE_BODY_GAP_PX = Math.round((STORY_BODY_TO_CTA_GAP / 35) * 2);
const MASTHEAD_MOBILE_PORTRAIT_PX = Math.round(72 * 0.66 * 1.2);
const MASTHEAD_DESKTOP_PORTRAIT_PX = Math.round((MASTHEAD_PORTRAIT_SIZE / CANVAS_W) * EMAIL_W);
/** Typical stacked-email width on phone — for portrait overlap math. */
const MASTHEAD_MOBILE_EMAIL_W = 390;
/** ~1mm gap below masthead hero before mission text (mobile). */
const MASTHEAD_MOBILE_HERO_TEXT_GAP_PX = MASTHEAD_IMAGE_GAP_PX;

/** Extra breathing room below story images in stacked email (px, pre-scale). */
const EMAIL_IMAGE_GAP_EXTRA = 12;
/** Extra space above/below CTA buttons in stacked email (px, pre-scale). */
const EMAIL_CTA_GAP_EXTRA = 20;

export type CanvasEmailOptions = {
  subject?: string;
  previewText?: string;
  siteUrl?: string;
  tracking?: EmailTrackingUrls;
  backgroundColor?: string;
  fontFamily?: StoriesState["newsletterFontFamily"];
  allowDataUrls?: boolean;
  /** Match story-spacing sliders / email-preview panel (defaults when omitted). */
  storySpacingGaps?: StorySpacingGaps;
  /** Fallback when canvas is missing migrated-mission elements. */
  missionHeading?: string;
  missionHtml?: string;
  missionPlain?: string;
  /** Keep absolute canvas layout (editor parity). Default true so send/preview match the edit page. */
  preserveDesktopLayout?: boolean;
};

export function canvasEmailOptionsFromState(
  state: StoriesState,
  overrides: Partial<CanvasEmailOptions> = {}
): CanvasEmailOptions {
  return {
    backgroundColor: state.newsletterBackgroundColor || "#10151c",
    fontFamily: state.newsletterFontFamily ?? "serif",
    allowDataUrls: false,
    storySpacingGaps:
      state.newsletterCanvas?.storySpacingGaps ?? DEFAULT_STORY_SPACING_GAPS,
    missionHeading: state.newsletterMissionHeading,
    missionHtml: state.newsletterMissionHtml,
    missionPlain: state.newsletterMission,
    // WYSIWYG: email uses the same absolute positions as the canvas editor.
    preserveDesktopLayout: true,
    ...overrides,
  };
}

function fontStack(family: StoriesState["newsletterFontFamily"] = "serif"): string {
  switch (family) {
    case "sans":
      return "'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif";
    case "montserrat-light":
      return "'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif";
    case "raleway-light":
      return "'Raleway', 'Helvetica Neue', Helvetica, Arial, sans-serif";
    case "josefin-light":
      return "'Josefin Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
    default:
      return "Georgia, 'Cormorant Garamond', 'Times New Roman', serif";
  }
}

function fontWeight(family: StoriesState["newsletterFontFamily"] = "serif"): number {
  switch (family) {
    case "montserrat-light":
      return 300;
    case "raleway-light":
      return 200;
    case "josefin-light":
      return 300;
    default:
      return 400;
  }
}

/** When true, email HTML uses canvas-native px (716) — matches editor WYSIWYG. */
let renderNativeCanvas = false;
/** When true, emit static stacked blocks (send/view) instead of absolute canvas coords. */
let stackedEmailLayout = false;
/** Bottom margin for the current stacked block (set before each render call). */
let stackedMarginBottom = 14;

function outputEmailWidth(): number {
  return renderNativeCanvas ? CANVAS_W : EMAIL_W;
}

function scale(x: number): number {
  if (renderNativeCanvas) return Math.round(x);
  return Math.round((x / CANVAS_W) * EMAIL_W);
}

function scaleFont(px: number): number {
  if (renderNativeCanvas) return px;
  return Math.max(11, Math.round((px / CANVAS_W) * EMAIL_W));
}

type RenderCtx = {
  font: string;
  fontWt: number;
  allowDataUrls: boolean;
  siteUrl: string;
  muted: string;
  defaultText: string;
  emailBg: string;
  yShift: number;
  storySpacingGaps: StorySpacingGaps;
};

/** Absolute HTTPS URL for email clients (Gmail/WhatsApp block relative/data URLs). */
function resolveImageSrc(src: string, ctx: RenderCtx): string {
  if (!src?.trim()) return "";
  if (src.startsWith("data:")) return ctx.allowDataUrls ? src : "";
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("/")) {
    const base = ctx.siteUrl.replace(/\/$/, "");
    return `${base}${src}`;
  }
  return src;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailRenderedCropSrc(src: string, el: CanvasImageEl, ctx: RenderCtx): string {
  const fit = el.objectFit === "contain" ? "contain" : "cover";
  const ox = scale(el.objectPositionX ?? 0);
  const oy = scale(el.objectPositionY ?? 0);
  const zoom = el.imageZoom ?? 1;
  // Outbound (stacked) email: use the public Firebase/Blob URL directly.
  // Wrapping every image in /api/newsletter/render-image breaks in inboxes when
  // preview auth or email clients cannot reach that proxy.
  if (stackedEmailLayout) return src;
  const needsFlatten =
    !isCircleImage(el) &&
    (fit === "contain" ||
      ox !== 0 ||
      oy !== 0 ||
      zoom !== 1);
  if (!needsFlatten) return src;
  const base = ctx.siteUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    src,
    w: String(scale(el.w)),
    h: String(scale(el.h)),
    fit,
    ox: String(ox),
    oy: String(oy),
    zoom: String(zoom),
  });
  return `${base}/api/newsletter/render-image?${params.toString()}`;
}

function sanitiseHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function px(n: number): string {
  return `${Math.round(n)}px`;
}

function safeColor(c: string, fallback = "#e8f3f0"): string {
  return c && c !== "transparent" ? c : fallback;
}

function layerClasses(el: CanvasEl, kind: string): string {
  const id = el.id.replace(/[^a-z0-9-]/gi, "-");
  const masthead = MASTHEAD_LAYER_IDS.has(el.id) ? " email-layer--masthead" : "";
  const montage =
    el.kind === "image" && (el as CanvasImageEl).montageGroup ? " email-layer--montage-tile" : "";
  return `email-layer email-layer-${kind} email-layer--${id}${masthead}${montage}`;
}

/** Fluid horizontal % from 716px canvas; fixed top for desktop absolute stack. */
function absShell(
  el: CanvasEl,
  ctx: RenderCtx,
  extraStyle = "",
  opts?: { fullWidth?: boolean },
): string {
  const top = scale(el.y + ctx.yShift);
  const fullWidth = opts?.fullWidth ?? false;
  const left = fullWidth ? "0" : `${((el.x / CANVAS_W) * 100).toFixed(4)}%`;
  const width = fullWidth ? "100%" : `${((el.w / CANVAS_W) * 100).toFixed(4)}%`;
  const style = [
    "position:absolute",
    `left:${left}`,
    `top:${px(top)}`,
    `width:${width}`,
    `z-index:${el.zIndex ?? 1}`,
    "box-sizing:border-box",
    extraStyle,
  ]
    .filter(Boolean)
    .join(";");
  return `class="${layerClasses(el, el.kind)}" style="${style}"`;
}

/** Absolute stack (preview) or static block flow (sent email). */
function elShell(
  el: CanvasEl,
  ctx: RenderCtx,
  extraStyle = "",
  opts?: { fullWidth?: boolean },
): string {
  if (stackedEmailLayout) {
    return `class="${layerClasses(el, el.kind)}" style="display:block;width:100%;max-width:100%;box-sizing:border-box;margin:0 0 ${px(stackedMarginBottom)} 0;overflow:visible;${extraStyle}"`;
  }
  return absShell(el, ctx, extraStyle, opts);
}

function isMastheadElement(el: CanvasEl): boolean {
  return MASTHEAD_LAYER_IDS.has(el.id);
}

function isMissionElement(el: CanvasEl): boolean {
  return MISSION_LAYER_IDS.has(el.id);
}

function defaultMissionTextEl(
  id: "migrated-mission-hd" | "migrated-mission",
  html: string,
  opts: Partial<CanvasTextEl>,
): CanvasTextEl {
  return {
    id,
    kind: "text",
    x: opts.x ?? 28,
    y: 0,
    w: opts.w ?? 660,
    zIndex: 5,
    html,
    fontSize: opts.fontSize ?? 16,
    fontFamily: opts.fontFamily ?? "inherit",
    fontWeight: opts.fontWeight ?? 400,
    color: opts.color ?? "#4a8a82",
    textAlign: opts.textAlign ?? "center",
    lineHeight: opts.lineHeight ?? 1.7,
    letterSpacing: opts.letterSpacing ?? 0,
    bg: "",
    borderColor: "rgba(189,208,201,0.4)",
    borderWidth: 0,
    borderRadius: 0,
    shadow: false,
  };
}

/** Ensure mission blocks exist on canvas (from stored state when canvas elements are missing). */
function ensureMissionElements(
  elements: CanvasEl[],
  opts: Pick<CanvasEmailOptions, "missionHeading" | "missionHtml" | "missionPlain">,
): CanvasEl[] {
  const out = [...elements];
  const hasBody = out.some((e) => e.id === "migrated-mission");
  const hasHd = out.some((e) => e.id === "migrated-mission-hd");
  const bodyHtml =
    opts.missionHtml?.trim() ||
    (opts.missionPlain?.trim() ? `<p>${esc(opts.missionPlain.trim())}</p>` : "");
  const heading = opts.missionHeading?.trim() ?? "";

  if (!hasHd && heading) {
    out.push(
      defaultMissionTextEl("migrated-mission-hd", `<p>${esc(heading)}</p>`, {
        fontSize: 11,
        fontWeight: 600,
        color: "#a7c7bc",
        letterSpacing: 2,
        lineHeight: 1.4,
      }),
    );
  }
  if (!hasBody && bodyHtml) {
    out.push(
      defaultMissionTextEl("migrated-mission", bodyHtml, {
        x: 60,
        w: 596,
        fontSize: 16,
        textAlign: "center",
        color: "#4a8a82",
        lineHeight: 1.7,
      }),
    );
  } else if (bodyHtml) {
    return out.map((e) =>
      e.id === "migrated-mission" && e.kind === "text" && !(e as CanvasTextEl).html?.trim()
        ? ({ ...e, html: bodyHtml } as CanvasEl)
        : e,
    );
  }
  return out;
}

/** Id used for gapBetweenStoryElements (montage hero tile keeps migrated-si-N). */
function gapLookupId(el: CanvasEl): string {
  if (el.kind === "image") {
    const img = el as CanvasImageEl;
    if (img.montageGroup) {
      const idx = img.montageIndex ?? 0;
      if (idx === 0) return img.id;
    }
  }
  return el.id;
}

function isStoryImageEl(el: CanvasEl): boolean {
  if (el.kind !== "image") return false;
  const img = el as CanvasImageEl;
  return /^migrated-si-\d+$/.test(img.id) || !!img.montageGroup;
}

function stackedEmailMarginBottom(
  current: CanvasEl,
  next: CanvasEl | undefined,
  gaps: StorySpacingGaps,
): number {
  const cur = { id: gapLookupId(current) };
  const nxt = next ? { id: gapLookupId(next) } : undefined;
  let gap = gapBetweenStoryElements(cur, nxt, gaps);

  if (isStoryImageEl(current) || current.id.startsWith("montage-group-")) {
    gap += EMAIL_IMAGE_GAP_EXTRA;
  }
  if (current.kind === "cta" || current.id.startsWith("migrated-cta-")) {
    gap += EMAIL_CTA_GAP_EXTRA;
  }
  if (nxt && nxt.id.startsWith("migrated-cta-")) {
    gap = Math.max(gap, gaps.aboveButton + EMAIL_CTA_GAP_EXTRA);
  }

  return scale(gap);
}

/** Flat list of elements rendered in stacked email (for margin lookup). */
function stackedRenderSequence(
  canvas: NewsletterCanvas,
  elements: CanvasEl[],
): CanvasEl[] {
  const domOrder = emailDomOrder(elements);
  const seq: CanvasEl[] = [];
  const emittedMontages = new Set<string>();

  for (const el of domOrder) {
    if (isMastheadElement(el)) continue;

    if (el.kind === "image" && (el as CanvasImageEl).montageGroup) {
      const group = (el as CanvasImageEl).montageGroup!;
      if (emittedMontages.has(group)) continue;
      emittedMontages.add(group);
      const members = elements.filter(
        (e) => e.kind === "image" && (e as CanvasImageEl).montageGroup === group,
      ) as CanvasImageEl[];
      if (members.length >= 2) {
        seq.push(members.find((m) => (m.montageIndex ?? 0) === 0) ?? members[0]);
        continue;
      }
    }
    if (shouldSkipEmailElement(el, canvas)) continue;
    seq.push(el);
  }
  return seq;
}

function mobileEmailCss(preserveDesktopLayout = false): string {
  if (preserveDesktopLayout) {
    return `
    .email-mobile-viewport { container-type: inline-size; container-name: email-canvas; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-canvas-cell { overflow: hidden !important; }
      .email-mobile-viewport {
        width: 100% !important;
        max-width: 100% !important;
        position: relative !important;
        height: 0 !important;
        padding-bottom: calc(var(--canvas-h) / var(--canvas-w) * 100%) !important;
        overflow: hidden !important;
      }
      .email-canvas-root {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: calc(var(--canvas-w) * 1px) !important;
        max-width: none !important;
        height: calc(var(--canvas-h) * 1px) !important;
        transform: scale(calc(100vw / (var(--canvas-w) * 1px)));
        transform: scale(calc(100cqw / var(--canvas-w)));
        transform-origin: top left !important;
      }
      .email-layer-cta a {
        white-space: nowrap !important;
      }
    }
    `;
  }
  const desktopPortrait = MASTHEAD_DESKTOP_PORTRAIT_PX;
  const mobilePortrait = MASTHEAD_MOBILE_PORTRAIT_PX;
  const mobileHeroTextGap = MASTHEAD_MOBILE_HERO_TEXT_GAP_PX;
  return `
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-layer-text,
      .email-layer-divider,
      .email-layer-cta,
      .email-layer-story-grid {
        padding-left: 16px !important;
        padding-right: 16px !important;
      }
      .email-layer-text > div,
      .email-layer-text p {
        max-width: 100% !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
      }
      .email-layer-image:not(.email-montage-group) {
        padding-left: 16px !important;
        padding-right: 16px !important;
      }
      .email-layer-image:not(.email-montage-group) .email-img-el {
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
      }
      .email-montage-group {
        padding-left: 16px !important;
        padding-right: 16px !important;
      }
      .email-masthead-portrait-img {
        width: ${mobilePortrait}px !important;
        height: ${mobilePortrait}px !important;
        max-width: ${mobilePortrait}px !important;
      }
      .email-masthead-hero-img {
        position: relative !important;
        z-index: 1 !important;
      }
      .email-masthead-banner-img {
        position: relative !important;
        z-index: 1 !important;
      }
      .email-mission-block {
        position: relative !important;
        z-index: 5 !important;
      }
      .email-masthead-table {
        margin-bottom: ${mobileHeroTextGap}px !important;
      }
      .email-story-grid-inner {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 16px !important;
      }
      .email-story-card {
        display: flex !important;
        flex-direction: column !important;
        width: auto !important;
        min-width: 0 !important;
        margin-bottom: 0 !important;
      }
      .email-story-card-img {
        height: 56px !important;
      }
      .email-layer-story-grid {
        padding-left: 10px !important;
        padding-right: 10px !important;
      }
      .email-layer-story-grid .email-story-card p {
        font-size: 10px !important;
        line-height: 1.35 !important;
      }
      .email-layer-cta {
        text-align: center !important;
      }
      .email-layer-cta a {
        display: inline-block !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
    }
    @media only screen and (min-width: 621px) {
      .email-masthead-portrait-img {
        width: ${desktopPortrait}px !important;
        height: ${desktopPortrait}px !important;
        max-width: ${desktopPortrait}px !important;
      }
      .email-masthead-hero-text-gap {
        display: none !important;
        height: 0 !important;
        max-height: 0 !important;
        overflow: hidden !important;
      }
    }
  `;
}

function shouldSkipEmailImage(el: CanvasImageEl, canvas: NewsletterCanvas): boolean {
  if (el.id === "migrated-logo") {
    return canvas.elements.some((e) => e.kind === "image" && e.id === "migrated-top");
  }
  if (el.montageGroup) {
    const members = canvas.elements.filter(
      (e) => e.kind === "image" && (e as CanvasImageEl).montageGroup === el.montageGroup,
    );
    return members.length >= 2;
  }
  return false;
}

function shouldSkipEmailElement(el: CanvasEl, canvas: NewsletterCanvas): boolean {
  if (el.kind !== "image") return false;
  return shouldSkipEmailImage(el as CanvasImageEl, canvas);
}

function enrichStoryGrid(
  el: CanvasStoryGridEl,
  allElements: CanvasEl[],
  ctx: RenderCtx,
): CanvasStoryGridEl {
  const imgById = new Map<string, CanvasImageEl>();
  for (const e of allElements) {
    if (e.kind === "image") imgById.set(e.id, e as CanvasImageEl);
  }
  return {
    ...el,
    stories: el.stories.map((s, cardIdx) => {
      const frame = imgById.get(`migrated-si-${cardIdx}`);
      const frameSrc = frame?.src ? resolveImageSrc(frame.src, ctx) : "";
      const storySrc = s.imageUrl ? resolveImageSrc(s.imageUrl, ctx) : "";
      const liveSrc = frameSrc || storySrc;
      return liveSrc ? { ...s, imageUrl: liveSrc } : s;
    }),
  };
}

function isCircleImage(img: CanvasImageEl): boolean {
  return img.borderRadius >= Math.min(img.w, img.h) / 2 - 2 && Math.abs(img.w - img.h) < 8;
}

function renderVisualText(el: CanvasTextEl, ctx: RenderCtx): string {
  const hasBg = el.bg && el.bg !== "transparent";
  const hasBorder = el.borderWidth > 0;
  const shell = elShell(
    el,
    ctx,
    [
      hasBg ? `background-color:${el.bg}` : null,
      hasBg || hasBorder ? "padding:12px 14px" : null,
      hasBorder ? `border:${el.borderWidth}px solid ${el.borderColor}` : null,
      hasBorder && el.borderRadius ? `border-radius:${px(scale(el.borderRadius))}` : null,
      el.shadow ? "box-shadow:0 4px 24px rgba(0,0,0,0.28)" : null,
      el.id === "migrated-title" ? `padding-bottom:${px(scale(12))}` : null,
      el.id === "migrated-greeting-hd"
        ? `padding-top:${px(scale(ISSUE_GREETING_HD_PAD_TOP))}`
        : null,
    ]
      .filter(Boolean)
      .join(";")
  );

  const innerStyle = [
    `font-family:${el.fontFamily || ctx.font}`,
    `font-size:${px(scaleFont(el.fontSize))}`,
    `font-weight:${el.fontWeight || ctx.fontWt}`,
    `color:${safeColor(el.color, ctx.defaultText)}`,
    `text-align:${el.textAlign}`,
    `line-height:${el.lineHeight}`,
    el.letterSpacing ? `letter-spacing:${px(scale(el.letterSpacing))}` : null,
    "margin:0",
  ].join(";");

  const isStoryBody = /^migrated-sb-\d+$/.test(el.id);
  const bodyHtml = sanitiseHtml(el.html);
  const pCount = isStoryBody ? (bodyHtml.match(/<p[\s>]/gi) ?? []).length : 0;

  const pStyle =
    el.id === "migrated-title"
      ? "margin:0;mso-margin-bottom-alt:0;"
      : "margin:0 0 0.65em 0;mso-margin-bottom-alt:8px;";
  const pFollowStyle =
    el.id === "migrated-title"
      ? `margin:${px(scale(12))} 0 0 0;mso-margin-top-alt:${px(scale(12))};`
      : pStyle;
  let paraIndex = 0;
  const html = bodyHtml.replace(/<p(\s[^>]*)?>/gi, (match) => {
    if (/style\s*=/i.test(match)) return match;
    let style: string;
    if (el.id === "migrated-title" && paraIndex > 0) style = pFollowStyle;
    else if (isStoryBody && pCount > 0 && paraIndex === pCount - 1) {
      style = "margin:0;mso-margin-bottom-alt:0;";
    } else if (isStoryBody) {
      style = "margin:0 0 0.65em 0;mso-margin-bottom-alt:8px;";
    } else {
      style = pStyle;
    }
    paraIndex += 1;
    return match.replace(/<p/i, `<p style="${style}"`);
  });

  return `<div ${shell}><div style="${innerStyle}">${html}</div></div>`;
}

function renderVisualImage(el: CanvasImageEl, ctx: RenderCtx, allElements: CanvasEl[]): string {
  const resolvedSrc = resolveImageSrc(el.src, ctx);
  const src = emailRenderedCropSrc(resolvedSrc, el, ctx);
  if (!src) return "";
  const w = scale(el.w);
  const h = scale(el.h);
  const circle = isCircleImage(el);
  const portraitCircle = el.id === "migrated-portrait" && circle;
  const fullBleed = isFullBleedCanvasImage(el);
  const brCss = montageImageBorderRadius(el, allElements, scale);
  const br = circle
    ? "border-radius:50%;"
    : brCss
      ? `border-radius:${brCss};`
      : "";
  const border = "";
  const sh = el.shadow || circle
    ? "box-shadow:0 10px 32px rgba(0,0,0,0.42);"
    : "";
  const objPos = portraitCircle
    ? "object-position:center center;"
    : `object-position:calc(50% + ${px(scale(el.objectPositionX ?? 0))}) calc(50% + ${px(scale(el.objectPositionY ?? 0))});`;
  const zoom =
    !portraitCircle && el.imageZoom && el.imageZoom !== 1
      ? `transform:scale(${el.imageZoom});transform-origin:center center;`
      : "";

  const stackedNatural = stackedEmailLayout && !circle;
  const shellExtra = stackedNatural
    ? `overflow:hidden;line-height:0;font-size:0;${br}${sh}`
    : `height:${px(h)};overflow:hidden;${br}${sh}`;
  const shell = elShell(el, ctx, shellExtra, { fullWidth: fullBleed });
  const imgRadius = br && !circle ? `border-radius:${brCss};` : br;
  const isMontage = !!el.montageGroup;
  const fit = el.objectFit === "contain" ? "contain" : "cover";
  const flattenedCropSrc = src !== resolvedSrc;
  const imgSizing = stackedNatural
    ? `width:100%;max-width:100%;height:auto;display:block;`
    : stackedEmailLayout && circle
      ? `width:${px(w)};max-width:100%;height:${px(h)};display:block;margin:0 auto;`
      : !isMontage
        ? `width:100%;max-width:100%;height:auto;`
        : `width:100%;height:100%;min-height:100%;`;
  const minH =
    stackedEmailLayout ? "" : isMontage ? "" : `min-height:${px(Math.min(h, scale(140)))};`;
  const heightAttr = stackedNatural || (stackedEmailLayout && flattenedCropSrc) ? "" : `height="${h}"`;
  const objectFitCss =
    flattenedCropSrc || stackedNatural ? "" : `object-fit:${fit};${objPos}${zoom}`;
  return `<div ${shell}>
    <img class="email-img-el" src="${esc(src)}" width="${fullBleed ? EMAIL_W : w}" ${heightAttr} alt=""
      style="${imgSizing}${minH}${objectFitCss}${border}${imgRadius}" />
  </div>`;
}

function renderVisualDivider(el: CanvasDividerEl, ctx: RenderCtx): string {
  if (el.thickness === 0 || el.color === "transparent") return "";
  const border = `${el.thickness}px ${el.lineStyle} ${safeColor(el.color, "rgba(167,199,188,0.4)")}`;
  const shell = elShell(
    el,
    ctx,
    `height:${px(Math.max(scale(el.thickness + 8), scale(12)))};display:flex;align-items:center;`
  );
  return `<div ${shell}><hr style="width:100%;border:none;border-top:${border};margin:0;" /></div>`;
}

function renderVisualCta(el: CanvasCtaEl, ctx: RenderCtx): string {
  if (!el.href && !el.label) return "";
  const bgFrom = safeColor(el.bgFrom, "#2a7060");
  const bgTo = safeColor(el.bgTo, "#4a9080");
  const textColor = safeColor(el.textColor, "#ffffff");
  const style = [
    "display:inline-block",
    `background:${bgFrom}`,
    `background:linear-gradient(90deg,${bgFrom},${bgTo})`,
    `color:${textColor}`,
    `font-family:${ctx.font}`,
    `font-size:${px(scaleFont(el.fontSize || 15))}`,
    `font-weight:${el.fontWeight || 600}`,
    el.letterSpacing ? `letter-spacing:${px(scale(el.letterSpacing))}` : null,
    `border-radius:${px(scale(el.borderRadius || 8))}`,
    "padding:16px 44px",
    "text-decoration:none",
    "text-align:center",
    "white-space:nowrap",
  ]
    .filter(Boolean)
    .join(";");

  const link = `<a href="${esc(el.href || "#")}" style="${style}">${esc(el.label || "Read more")}</a>`;
  const ctaPad = stackedEmailLayout
    ? `display:flex;justify-content:center;padding-top:${px(Math.round(scale(12)))};padding-bottom:${px(Math.round(scale(12)))};`
    : "display:flex;justify-content:center;";
  const shell = elShell(el, ctx, ctaPad);
  return `<div ${shell}>${link}</div>`;
}

const GRID_H_PAD = 56;
const GRID_CARD_GAP = 12;

function storyGridCardImageHeightCanvas(columns: number): number {
  const cardW = (NEWSLETTER_CANVAS_WIDTH - GRID_H_PAD - (columns - 1) * GRID_CARD_GAP) / columns;
  return Math.round(cardW * 0.75);
}

function renderVisualStoryGrid(
  el: CanvasStoryGridEl,
  ctx: RenderCtx,
  allElements: CanvasEl[],
  heightOf: (el: CanvasEl) => number,
): string {
  const enriched = enrichStoryGrid(el, allElements, ctx);
  const gridH = scale(effectiveStoryGridHeight(el, heightOf));
  const gridPad = `padding:${px(scale(36))} ${px(scale(28))} ${px(scale(40))};box-sizing:border-box;`;
  const shell = elShell(
    el,
    ctx,
    stackedEmailLayout
      ? `overflow:visible;${gridPad}`
      : `height:${px(gridH)};overflow:hidden;${gridPad}`,
  );
  const headingColor = safeColor(enriched.headingColor, "#a7c7bc");
  const cardBg = safeColor(enriched.cardBg, "rgba(255,255,255,0.08)");
  const textColor = safeColor(enriched.textColor, "#e8f3f0");
  const cols = enriched.columns ?? 3;
  const gap = scale(12);
  const cardRadius = px(scale(14));
  const cardImgH = scale(storyGridCardImageHeightCanvas(cols));

  const heading = enriched.headingText
    ? `<p style="margin:0 0 ${px(scale(28))};font-family:${ctx.font};font-size:${px(scaleFont(22))};font-weight:800;letter-spacing:${px(scale(2.5))};text-align:center;text-transform:uppercase;color:${headingColor};line-height:1.2;">${esc(enriched.headingText)}</p>`
    : "";

  const cards = enriched.stories
    .map((s) => {
      const src = s.imageUrl ? resolveImageSrc(s.imageUrl, ctx) : "";
      const imgHtml = src
        ? `<div class="email-story-card-img" style="width:100%;height:${px(cardImgH)};overflow:hidden;line-height:0;background:${cardBg};">
            <img class="email-img-el" src="${esc(src)}" alt="${esc(s.title)}" width="${scale(560)}" height="${cardImgH}"
              style="display:block;width:100%;height:100%;object-fit:cover;border:0;" />
          </div>`
        : "";
      const excerptHtml = s.excerpt
        ? `<p style="margin:0;font-size:${px(scaleFont(12))};line-height:1.5;color:${textColor};opacity:0.78;flex:1;">${esc(s.excerpt)}</p>`
        : "";
      return `<div class="email-story-card" style="border-radius:${cardRadius};overflow:hidden;box-shadow:0 4px 22px rgba(0,0,0,0.18),0 1px 4px rgba(0,0,0,0.10);display:flex;flex-direction:column;background:${cardBg};">
        ${imgHtml}
        <div style="padding:${px(scale(14))} ${px(scale(16))} ${px(scale(16))};display:flex;flex-direction:column;gap:${px(scale(10))};flex:1;">
          <p style="margin:0;font-size:${px(scaleFont(14))};font-weight:700;line-height:1.35;color:${textColor};">${esc(s.title)}</p>
          ${excerptHtml}
        </div>
      </div>`;
    })
    .join("");

  const gridStyle = `display:grid;grid-template-columns:repeat(${cols},1fr);gap:${px(gap)};`;

  return `<div ${shell}>${heading}<div class="email-story-grid-inner" style="${gridStyle}">${cards}</div></div>`;
}

/** Table-based masthead: banner → portrait on seam → hero (natural image heights, no absolute coords). */
function mastheadImageRadius(el: CanvasImageEl, allElements: CanvasEl[]): string {
  if (isCircleImage(el)) return "border-radius:50%;";
  const brCss = montageImageBorderRadius(el, allElements, scale);
  return brCss ? `border-radius:${brCss};` : "border-radius:14px;";
}

/**
 * Pull portrait up from below the hero so its top matches the editor.
 * Prefer offset vs hero.y — email banner/hero use height:auto and often don't match canvas crop heights.
 */
function portraitPullFromHero(
  portrait: CanvasImageEl | undefined,
  hero: CanvasImageEl | undefined,
  heroEmailH: number,
  imageGap: number,
): number {
  if (!portrait) return Math.round(heroEmailH / 2);
  if (!hero) return 0;
  const aboveHeroCanvas = Math.max(0, hero.y - portrait.y);
  return Math.max(0, Math.round(heroEmailH + imageGap + scale(aboveHeroCanvas)));
}

function renderEmailMastheadTable(
  elements: CanvasEl[],
  ctx: RenderCtx,
  allElements: CanvasEl[],
): string {
  const top = elements.find((e) => e.id === "migrated-top" && e.kind === "image") as
    | CanvasImageEl
    | undefined;
  const logo = elements.find((e) => e.id === "migrated-logo" && e.kind === "image") as
    | CanvasImageEl
    | undefined;
  const hero = elements.find((e) => e.id === "migrated-hero" && e.kind === "image") as
    | CanvasImageEl
    | undefined;
  const portrait = elements.find((e) => e.id === "migrated-portrait" && e.kind === "image") as
    | CanvasImageEl
    | undefined;

  const banner = top ?? logo;
  if (!banner && !hero && !portrait) return "";

  const imageGap = 0;
  const portraitPx = Math.round(
    ((portrait?.w || MASTHEAD_PORTRAIT_SIZE) / CANVAS_W) * EMAIL_W,
  );
  const mobilePortraitPx = Math.round(portraitPx * (MASTHEAD_MOBILE_EMAIL_W / EMAIL_W));
  const bodyGap = px(MASTHEAD_MOBILE_BODY_GAP_PX);

  // Lock masthead heights to canvas aspect so layout matches the editor (not intrinsic photo ratio).
  const bannerH =
    banner?.w && banner?.h ? Math.round((banner.h / banner.w) * EMAIL_W) : 0;
  const heroH = hero?.w && hero?.h ? Math.round((hero.h / hero.w) * EMAIL_W) : 0;
  const bannerHMobile =
    banner?.w && banner?.h ? Math.round((banner.h / banner.w) * MASTHEAD_MOBILE_EMAIL_W) : 0;
  const heroHMobile =
    hero?.w && hero?.h ? Math.round((hero.h / hero.w) * MASTHEAD_MOBILE_EMAIL_W) : 0;

  const portraitPullDesktop = portraitPullFromHero(portrait, hero, heroH, imageGap);
  const portraitPullMobile = portraitPullFromHero(portrait, hero, heroHMobile, imageGap);

  const bannerSrc = banner?.src ? resolveImageSrc(banner.src, ctx) : "";
  const heroSrc = hero?.src ? resolveImageSrc(hero.src, ctx) : "";
  const portraitSrc = portrait?.src ? resolveImageSrc(portrait.src, ctx) : "";

  const bannerBr = "border-radius:0;";
  const heroBr =
    hero && hero.borderRadius > 0
      ? `border-radius:${Math.round((hero.borderRadius / CANVAS_W) * EMAIL_W)}px;`
      : "border-radius:0;";
  // Edit window: drop shadow only — no aqua outline on the portrait.
  const portraitShadow = "box-shadow:0 10px 32px rgba(0,0,0,0.42);";

  const bannerRow = bannerSrc
    ? `<tr>
        <td align="center" style="padding:0;line-height:0;font-size:0;mso-line-height-rule:exactly;">
          <img class="email-img-el email-masthead-banner-img" src="${esc(bannerSrc)}" alt="" width="${EMAIL_W}"
            ${bannerH ? `height="${bannerH}"` : ""}
            style="display:block;width:100%;max-width:100%;${bannerH ? `height:${bannerH}px;` : "height:auto;"}object-fit:cover;object-position:center center;border:0;outline:none;${bannerBr}" />
        </td>
      </tr>`
    : "";

  const portraitImg = portraitSrc
    ? `<div class="email-masthead-portrait-wrap" style="margin:-${portraitPullDesktop}px auto 0 auto;width:${portraitPx}px;height:${portraitPx}px;max-width:${portraitPx}px;border-radius:50%;overflow:hidden;position:relative;z-index:10;line-height:0;font-size:0;border:0;outline:none;${portraitShadow}">
        <img class="email-img-el email-masthead-portrait-img" src="${esc(portraitSrc)}" alt=""
          width="${portraitPx}" height="${portraitPx}"
          style="display:block;width:${portraitPx}px;height:${portraitPx}px;max-width:${portraitPx}px;border:0;outline:none;border-radius:50%;object-fit:cover;object-position:center center;" />
      </div>`
    : "";

  const heroPortraitBlock =
    heroSrc || portraitImg
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
          style="width:100%;border-collapse:collapse;margin:0;padding:0;">
          ${
            heroSrc
              ? `<tr>
                  <td class="email-masthead-hero-cell" align="center" style="padding:0;line-height:0;font-size:0;mso-line-height-rule:exactly;">
                    <img class="email-img-el email-masthead-hero-img" src="${esc(heroSrc)}" alt="" width="${EMAIL_W}" ${heroH ? `height="${heroH}"` : ""}
                      style="display:block;width:100%;max-width:100%;${heroH ? `height:${heroH}px;` : "height:auto;"}object-fit:cover;object-position:center center;border:0;outline:none;position:relative;z-index:1;${heroBr}" />
                  </td>
                </tr>`
              : ""
          }
          ${
            portraitImg
              ? `<tr>
                  <td align="center" style="padding:0;line-height:0;font-size:0;mso-line-height-rule:exactly;">
                    ${portraitImg}
                  </td>
                </tr>`
              : ""
          }
          <tr>
            <td class="email-masthead-hero-text-gap" height="${MASTHEAD_MOBILE_HERO_TEXT_GAP_PX}" style="height:${MASTHEAD_MOBILE_HERO_TEXT_GAP_PX}px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td>
          </tr>
        </table>`
      : "";

  const heroRow = heroPortraitBlock
    ? `<tr>
        <td align="center" style="padding:0;line-height:0;font-size:0;mso-line-height-rule:exactly;">
          ${heroPortraitBlock}
        </td>
      </tr>`
    : "";

  const portraitMobileCss = portraitSrc
    ? `<style type="text/css">
    @media only screen and (max-width:620px) {
      .email-masthead-table .email-masthead-banner-img {
        ${bannerHMobile ? `height:${bannerHMobile}px !important;` : ""}
        object-fit:cover !important;
      }
      .email-masthead-table .email-masthead-hero-img {
        ${heroHMobile ? `height:${heroHMobile}px !important;` : ""}
        object-fit:cover !important;
        position:relative !important;
        z-index:1 !important;
      }
      .email-masthead-table .email-masthead-portrait-wrap {
        width:${mobilePortraitPx}px !important;
        height:${mobilePortraitPx}px !important;
        max-width:${mobilePortraitPx}px !important;
        margin-top:-${portraitPullMobile}px !important;
      }
      .email-masthead-table .email-masthead-portrait-img {
        width:${mobilePortraitPx}px !important;
        height:${mobilePortraitPx}px !important;
        max-width:${mobilePortraitPx}px !important;
        border:0 !important;
        outline:none !important;
      }
      .email-masthead-table .email-masthead-banner-img {
        position:relative !important;
        z-index:1 !important;
      }
      .email-masthead-table {
        margin-bottom:${MASTHEAD_MOBILE_HERO_TEXT_GAP_PX}px !important;
      }
      .email-masthead-table .email-masthead-hero-text-gap {
        display:block !important;
        height:${MASTHEAD_MOBILE_HERO_TEXT_GAP_PX}px !important;
        max-height:${MASTHEAD_MOBILE_HERO_TEXT_GAP_PX}px !important;
      }
    }
  </style>`
    : "";

  return `${portraitMobileCss}<table class="email-masthead-table email-layer email-layer--masthead" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
    style="width:100%;max-width:100%;border-collapse:collapse;margin:0 0 ${bodyGap} 0;padding:0;">
    ${bannerRow}
    ${heroRow}
  </table>`;
}

/** Mission statement block — rendered immediately after masthead so it is not collapsed under the hero. */
function renderEmailMissionBlock(
  elements: CanvasEl[],
  ctx: RenderCtx,
  stackedMarginById: Map<string, number>,
): string {
  const hd = elements.find((e) => e.id === "migrated-mission-hd" && e.kind === "text") as
    | CanvasTextEl
    | undefined;
  const body = elements.find((e) => e.id === "migrated-mission" && e.kind === "text") as
    | CanvasTextEl
    | undefined;
  if (!hd?.html?.trim() && !body?.html?.trim()) return "";

  const parts: string[] = [];
  if (hd?.html?.trim()) {
    stackedMarginBottom = stackedMarginById.get(hd.id) ?? scale(8);
    parts.push(renderVisualText(hd, ctx));
  }
  if (body?.html?.trim()) {
    stackedMarginBottom = stackedMarginById.get(body.id) ?? scale(16);
    parts.push(renderVisualText(body, ctx));
  }
  if (!parts.length) return "";

  return `<div class="email-mission-block email-layer email-layer--mission" style="position:relative;z-index:5;width:100%;max-width:100%;">${parts.join("")}</div>`;
}

function montageGroupBounds(members: CanvasImageEl[]) {
  const minX = Math.min(...members.map((m) => m.x));
  const minY = Math.min(...members.map((m) => m.y));
  const maxX = Math.max(...members.map((m) => m.x + m.w));
  const maxY = Math.max(...members.map((m) => m.y + m.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function montageSlotStyle(slot: { c: number; r: number; cs?: number; rs?: number }): string {
  const cs = slot.cs ?? 1;
  const rs = slot.rs ?? 1;
  return `grid-column:${slot.c + 1}/span ${cs};grid-row:${slot.r + 1}/span ${rs};overflow:hidden;min-height:0;`;
}

function renderVisualMontageGroup(
  members: CanvasImageEl[],
  ctx: RenderCtx,
  allElements: CanvasEl[],
): string {
  const spec = montageLayoutSpec(members.length);
  const bounds = montageGroupBounds(members);
  const zIndex = Math.max(...members.map((m) => m.zIndex ?? 1));
  const anchor: CanvasImageEl = {
    ...members[0],
    id: `montage-group-${members[0].montageGroup}`,
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    zIndex,
  };

  const scaledH = scale(bounds.h);
  const top = scale(anchor.y + ctx.yShift);
  const left = `${((anchor.x / CANVAS_W) * 100).toFixed(4)}%`;
  const width = `${((anchor.w / CANVAS_W) * 100).toFixed(4)}%`;
  const gap = px(scale(MONTAGE_EMAIL_GAP));
  const colTemplate = spec.cols.map((c) => `${c}fr`).join(" ");
  const rowTemplate = spec.rows.map(() => "1fr").join(" ");

  const byIndex = new Map<number, CanvasImageEl>();
  for (const m of members) byIndex.set(m.montageIndex ?? 0, m);
  const ordered = [...members].sort((a, b) => (a.montageIndex ?? 0) - (b.montageIndex ?? 0));

  const slots: Array<{ slot: (typeof spec)["hero"]; tile: CanvasImageEl | undefined }> = [
    { slot: spec.hero, tile: byIndex.get(0) ?? ordered[0] },
  ];
  spec.sats.forEach((slot, i) => {
    slots.push({ slot, tile: byIndex.get(i + 1) ?? ordered[i + 1] });
  });

  const cells = slots
    .map(({ slot, tile }) => {
      if (!tile) return "";
      const resolvedTileSrc = resolveImageSrc(tile.src, ctx);
      if (!resolvedTileSrc) return "";
      const src = emailRenderedCropSrc(resolvedTileSrc, tile, ctx);
      const tileFlattened = src !== resolvedTileSrc;
      const tw = scale(tile.w);
      const brCss = montageImageBorderRadius(tile, allElements, scale);
      const br = brCss ? `border-radius:${brCss};` : "";
      const objPos = `object-position:calc(50% + ${px(scale(tile.objectPositionX ?? 0))}) calc(50% + ${px(scale(tile.objectPositionY ?? 0))});`;
      if (stackedEmailLayout) {
        return `<div style="${montageSlotStyle(slot)}overflow:hidden;line-height:0;font-size:0;"><img class="email-img-el" src="${esc(src)}" alt="" width="${tw}" style="display:block;width:100%;height:auto;border:0;${br}" /></div>`;
      }
      const fitCss = tileFlattened ? "" : `object-fit:cover;${objPos}`;
      return `<div style="${montageSlotStyle(slot)}"><img class="email-img-el" src="${esc(src)}" alt="" width="100%" style="display:block;width:100%;height:100%;${fitCss}${br}" /></div>`;
    })
    .filter(Boolean)
    .join("");

  const gridStyle = [
    "display:grid",
    `grid-template-columns:${colTemplate}`,
    `grid-template-rows:${rowTemplate}`,
    `gap:${gap}`,
    "width:100%",
    "height:100%",
    `aspect-ratio:${spec.aspect}`,
  ].join(";");

  const idClass = anchor.id.replace(/[^a-z0-9-]/gi, "-");
  if (stackedEmailLayout) {
    return `<div class="email-layer email-layer-image email-montage-group email-layer--${idClass}" style="display:block;width:100%;max-width:100%;box-sizing:border-box;margin:0 0 ${px(stackedMarginBottom)} 0;overflow:visible;"><div style="${gridStyle}">${cells}</div></div>`;
  }
  return `<div class="email-layer email-layer-image email-montage-group email-layer--${idClass}" style="position:absolute;left:${left};top:${px(top)};width:${width};height:${px(scaledH)};z-index:${zIndex};box-sizing:border-box;overflow:hidden;"><div style="${gridStyle}">${cells}</div></div>`;
}

function renderVisualElement(
  el: CanvasEl,
  ctx: RenderCtx,
  allElements: CanvasEl[],
  heightOf: (el: CanvasEl) => number,
): string {
  switch (el.kind) {
    case "text":
      return renderVisualText(el as CanvasTextEl, ctx);
    case "image":
      return renderVisualImage(el as CanvasImageEl, ctx, allElements);
    case "divider":
      return renderVisualDivider(el as CanvasDividerEl, ctx);
    case "story-grid":
      return renderVisualStoryGrid(el as CanvasStoryGridEl, ctx, allElements, heightOf);
    case "cta":
      return renderVisualCta(el as CanvasCtaEl, ctx);
    default:
      return "";
  }
}

/** DOM reading order for email — montage tiles stay grouped for mobile flow. */
function emailDomOrder(elements: CanvasEl[]): CanvasEl[] {
  const sorted = [...elements].sort((a, b) => {
    const oa = canvasLayoutOrder(a);
    const ob = canvasLayoutOrder(b);
    if (oa !== ob) return oa - ob;
    return a.y - b.y;
  });

  const out: CanvasEl[] = [];
  const emittedMontage = new Set<string>();

  for (const el of sorted) {
    if (el.kind === "image" && (el as CanvasImageEl).montageGroup) {
      const group = (el as CanvasImageEl).montageGroup!;
      if (emittedMontage.has(group)) continue;
      emittedMontage.add(group);
      const members = sorted
        .filter((e) => e.kind === "image" && (e as CanvasImageEl).montageGroup === group)
        .sort(
          (a, b) =>
            ((a as CanvasImageEl).montageIndex ?? 0) - ((b as CanvasImageEl).montageIndex ?? 0),
        );
      out.push(...members);
      continue;
    }
    out.push(el);
  }
  return out;
}

function renderVisualEmailBody(
  canvas: NewsletterCanvas,
  ctx: RenderCtx,
  elements: CanvasEl[],
  heightOf: (el: CanvasEl) => number,
): string {
  const nativeHeightPx = canvasExportHeightCanvasPx(elements, heightOf);
  const canvasW = outputEmailWidth();
  const heightPx = renderNativeCanvas ? nativeHeightPx : scale(nativeHeightPx);

  const domOrder = emailDomOrder(elements);

  const emittedMontages = new Set<string>();
  const layers: string[] = [];
  let deferredPortraitHtml: string | null = null;

  const stackedSeq = stackedEmailLayout ? stackedRenderSequence(canvas, elements) : [];
  const stackedMarginById = new Map<string, number>();
  if (stackedEmailLayout) {
    for (let i = 0; i < stackedSeq.length; i++) {
      stackedMarginById.set(
        stackedSeq[i].id,
        stackedEmailMarginBottom(stackedSeq[i], stackedSeq[i + 1], ctx.storySpacingGaps),
      );
    }
  }

  if (stackedEmailLayout) {
    const masthead = renderEmailMastheadTable(elements, ctx, elements);
    if (masthead) layers.push(masthead);
    const mission = renderEmailMissionBlock(elements, ctx, stackedMarginById);
    if (mission) layers.push(mission);
  }

  for (const el of domOrder) {
    if (stackedEmailLayout && (isMastheadElement(el) || isMissionElement(el))) continue;

    if (el.kind === "image" && (el as CanvasImageEl).montageGroup) {
      const group = (el as CanvasImageEl).montageGroup!;
      if (emittedMontages.has(group)) continue;
      emittedMontages.add(group);
      const members = elements
        .filter((e) => e.kind === "image" && (e as CanvasImageEl).montageGroup === group)
        .sort(
          (a, b) =>
            ((a as CanvasImageEl).montageIndex ?? 0) - ((b as CanvasImageEl).montageIndex ?? 0),
        ) as CanvasImageEl[];
      if (members.length >= 2) {
        const heroTile = members.find((m) => (m.montageIndex ?? 0) === 0) ?? members[0];
        if (stackedEmailLayout) {
          stackedMarginBottom = stackedMarginById.get(heroTile.id) ?? scale(20);
        }
        const html = renderVisualMontageGroup(members, ctx, elements);
        if (html) layers.push(html);
        continue;
      }
    }
    if (shouldSkipEmailElement(el, canvas)) continue;

    if (!stackedEmailLayout && el.id === "migrated-portrait") {
      deferredPortraitHtml = renderVisualElement(el, ctx, elements, heightOf);
      continue;
    }

    if (stackedEmailLayout) {
      stackedMarginBottom = stackedMarginById.get(el.id) ?? scale(20);
    }

    const html = renderVisualElement(el, ctx, elements, heightOf);
    if (!html) continue;

    layers.push(html);

    if (!stackedEmailLayout && el.id === "migrated-hero" && deferredPortraitHtml) {
      layers.push(deferredPortraitHtml);
      deferredPortraitHtml = null;
    }
  }

  if (deferredPortraitHtml) layers.push(deferredPortraitHtml);

  if (stackedEmailLayout) {
    return `<div class="email-mobile-viewport" style="width:100%;max-width:${canvasW}px;margin:0 auto;">
    <div class="email-canvas-root" style="width:100%;max-width:${canvasW}px;height:auto;margin:0 auto;background:transparent;overflow:visible;line-height:normal;font-size:16px;">
    ${layers.join("\n    ")}
    </div>
  </div>`;
  }

  return `<div class="email-mobile-viewport" style="--canvas-h:${heightPx};--canvas-w:${canvasW};">
    <div class="email-canvas-root" style="position:relative;width:100%;max-width:${canvasW}px;height:${px(heightPx)};margin:0 auto;background:transparent;overflow:hidden;line-height:normal;font-size:16px;">
    ${layers.join("\n    ")}
    </div>
  </div>`;
}

export type EmailTrackingUrls = {
  pixelUrl: string;
  unsubUrl: string;
  viewOnlineUrl: string;
};

export function canvasToEmailHtml(
  canvas: NewsletterCanvas,
  options: CanvasEmailOptions = {}
): string {
  const {
    subject = "Maroma Newsletter",
    previewText = "",
    siteUrl = "https://maroma.com",
    tracking,
    backgroundColor = "#10151c",
    fontFamily = "serif",
    allowDataUrls = false,
    storySpacingGaps = DEFAULT_STORY_SPACING_GAPS,
    missionHeading,
    missionHtml,
    missionPlain,
    preserveDesktopLayout = true,
  } = options;

  const EMAIL_BG = safeColor(backgroundColor, "#10151c");
  const light = (() => {
    const m = /^#([0-9a-f]{6})$/i.exec(EMAIL_BG.trim());
    if (!m) return false;
    const r = parseInt(m[1].slice(0, 2), 16);
    const g = parseInt(m[1].slice(2, 4), 16);
    const b = parseInt(m[1].slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
  })();

  renderNativeCanvas = preserveDesktopLayout;
  stackedEmailLayout = !preserveDesktopLayout;

  const canvasWithMission: NewsletterCanvas = {
    ...canvas,
    elements: ensureMissionElements(canvas.elements ?? [], {
      missionHeading,
      missionHtml,
      missionPlain,
    }),
  };

  const laid = layoutNewsletterCanvas(canvasWithMission, storySpacingGaps);
  let prepared = normalizeCanvasVisualsForEmail(laid.elements);
  if (!preserveDesktopLayout) {
    prepared = snapStoryCtasForEmailRender(prepared);
  }
  const heightOf = laid.heightOf;
  const yShift = -canvasExportMinY(prepared);
  const emailTableW = outputEmailWidth();

  const ctx: RenderCtx = {
    font: fontStack(fontFamily),
    fontWt: fontWeight(fontFamily),
    allowDataUrls,
    siteUrl: siteUrl.replace(/\/$/, ""),
    muted: light ? "rgba(26,74,82,0.55)" : "rgba(167,199,188,0.55)",
    defaultText: light ? "#1a4a52" : "#e8f3f0",
    emailBg: EMAIL_BG,
    yShift,
    storySpacingGaps: storySpacingGaps ?? DEFAULT_STORY_SPACING_GAPS,
  };

  const exportCanvas: NewsletterCanvas = { ...canvasWithMission, elements: prepared };
  const bodyHtml = renderVisualEmailBody(exportCanvas, ctx, prepared, heightOf);

  const pixelHtml = tracking?.pixelUrl
    ? `<tr><td><img src="${esc(tracking.pixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" /></td></tr>`
    : "";

  const unsubHref = tracking?.unsubUrl ?? `${siteUrl}/newsletter/unsubscribe`;
  const viewHref = tracking?.viewOnlineUrl ?? `${siteUrl}/newsletter/view`;

  const footer = `
  ${pixelHtml}
  <tr><td height="24" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
  <tr>
    <td align="center" style="padding: 0 20px 24px;">
      <p style="margin:0;font-family:${ctx.font};font-size:11px;color:${ctx.muted};line-height:1.6;">
        You are receiving this because you subscribed to Maroma updates.<br/>
        <a href="${esc(unsubHref)}" style="color:${ctx.muted};text-decoration:underline;">Unsubscribe</a>
        &nbsp;·&nbsp;
        <a href="${esc(viewHref)}" style="color:${ctx.muted};text-decoration:underline;">View in browser</a>
      </p>
    </td>
  </tr>`;

  const canvasCellStyle = preserveDesktopLayout
    ? "padding:0;line-height:0;font-size:0;"
    : "padding:0;line-height:normal;font-size:16px;";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <title>${esc(subject)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Montserrat:wght@200;300;400;600&family=Raleway:wght@200;400&family=Josefin+Sans:wght@300;400;600&display=swap" rel="stylesheet" />
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    img.email-masthead-portrait-img { border: 0 !important; outline: none !important; }
    .email-masthead-portrait-wrap { box-shadow: 0 10px 32px rgba(0,0,0,0.42) !important; border: 0 !important; }
    .email-masthead-table { width: 100% !important; max-width: 100% !important; }
    .email-masthead-banner-img, .email-masthead-hero-img { width: 100% !important; max-width: 100% !important; display: block !important; }
    .email-layer-text, .email-layer-divider, .email-layer-cta, .email-layer-story-grid, .email-mission-block {
      padding-left: 20px; padding-right: 20px; box-sizing: border-box;
    }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; }
    ${mobileEmailCss(preserveDesktopLayout)}
  </style>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_BG};word-break:break-word;">
  <div style="display:none;font-size:1px;color:${EMAIL_BG};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${esc(previewText)}&#160;&#847; &#160;&#847; &#160;&#847; &#160;&#847; &#160;&#847; &#160;&#847;
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:${EMAIL_BG};">
    <tr>
      <td align="center" style="padding:0;">
        <table class="email-container" width="${emailTableW}" cellpadding="0" cellspacing="0" border="0" role="presentation"
               style="background-color:${EMAIL_BG};max-width:${emailTableW}px;width:100%;">
          <tr>
            <td class="email-canvas-cell" style="${canvasCellStyle}">
              ${bodyHtml}
            </td>
          </tr>
          ${footer}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
