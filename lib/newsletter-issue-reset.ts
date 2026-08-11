import { buildMigratedNewsletterBlocks } from "./newsletter-migrate-legacy-blocks";
import type { CanvasEl, NewsletterBlock, NewsletterCanvas, StoriesState } from "./story-types";

export const NEWSLETTER_PREVIOUS_ISSUE_LS_KEY = "maroma-newsletter-previous-issue";

export const DEFAULT_NEWSLETTER_TITLE = "Maroma Newsletter";
export const DEFAULT_NEWSLETTER_GREETING_HEADING = "Welcome to the Maroma Newsletter";
const DEFAULT_NEWSLETTER_GREETING = "Dear Friends,\n\nHERE LAURA GREETING";
const DEFAULT_NEWSLETTER_GREETING_HTML = "<p>Dear Friends,</p><p>HERE LAURA GREETING</p>";

const STORY_CANVAS_ID = /^migrated-(sdiv|st|si|sb|cta)-\d+$/;
const MODULAR_BLOCK_CANVAS_ID = /^migrated-b(h|t|i|div)-\d+$/;

export function storePreviousNewsletterIssue(state: StoriesState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NEWSLETTER_PREVIOUS_ISSUE_LS_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

export function loadPreviousNewsletterIssue(): StoriesState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(NEWSLETTER_PREVIOUS_ISSUE_LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoriesState;
  } catch {
    return null;
  }
}

export function clearPreviousNewsletterIssue(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(NEWSLETTER_PREVIOUS_ISSUE_LS_KEY);
  } catch {
    // ignore
  }
}

export function hasPreviousNewsletterIssueBackup(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(localStorage.getItem(NEWSLETTER_PREVIOUS_ISSUE_LS_KEY));
  } catch {
    return false;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveIssueMonthLabel(now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(now);
}

function buildFreshIssuePlaceholders(now = new Date()): {
  title: string;
  greetingHeading: string;
  greetingHtml: string;
} {
  const month = resolveIssueMonthLabel(now);
  return {
    title: `Maroma ${month} Newsletter`,
    greetingHeading: `Welcome to the ${month} Maroma Newsletter`,
    greetingHtml: DEFAULT_NEWSLETTER_GREETING_HTML,
  };
}

export function captureFreshIssueTemplateState(source: StoriesState): StoriesState {
  const template = structuredClone(source);
  template.newsletterIssueTemplate = null;
  return template;
}

function isStoryCanvasElement(el: CanvasEl): boolean {
  if (el.kind === "story-grid") return true;
  if (el.id === "migrated-story-grid") return true;
  if (STORY_CANVAS_ID.test(el.id)) return true;
  if (MODULAR_BLOCK_CANVAS_ID.test(el.id)) return true;
  return false;
}

const LIGHT_INK_VALUES = new Set(["", "#fff", "#ffffff", "#f3f7f6", "#f1f6f5", "#e8e8e5"]);

function parseHexColor(input: string): { r: number; g: number; b: number } | null {
  const t = input.trim().toLowerCase();
  const m = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function parseCssColor(input: string): { r: number; g: number; b: number } | null {
  const hex = parseHexColor(input);
  if (hex) return hex;
  const rgb = input.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!rgb) return null;
  return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
}

function colorLuminance(input: string): number | null {
  const rgb = parseCssColor(input);
  if (!rgb) return null;
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

/** True for empty, white, or other light colours unsuitable on pale newsletter backgrounds. */
export function isLightInkColor(color: string | undefined): boolean {
  const t = color?.trim() ?? "";
  if (!t) return true;
  if (LIGHT_INK_VALUES.has(t.toLowerCase())) return true;
  const lum = colorLuminance(t);
  return lum !== null && lum > 0.62;
}

/** Dark teal on light mint backgrounds; light text on dark shells. */
export function resolveNewsletterInkColor(prev: StoriesState): string {
  const styles = prev.newsletterElementStyles;
  const candidates = [
    styles.missionBody.color,
    styles.issueHeading.color,
    styles.missionHeading.color,
    prev.newsletterStoryTextColor,
    styles.greetingBody.color,
    styles.greetingHeading.color,
  ];
  for (const c of candidates) {
    const t = c?.trim();
    if (t && !isLightInkColor(t)) return t;
  }
  const bgLum = colorLuminance(prev.newsletterBackgroundColor?.trim() ?? "");
  const lightBg = bgLum !== null ? bgLum > 0.55 : true;
  return lightBg ? "#2a7060" : "#f3f7f6";
}

function applyInkToElementStyles(
  styles: StoriesState["newsletterElementStyles"],
  ink: string
): StoriesState["newsletterElementStyles"] {
  return Object.fromEntries(
    Object.entries(styles).map(([key, value]) => [key, { ...value, color: ink }])
  ) as StoriesState["newsletterElementStyles"];
}

function applyInkToBlocks(blocks: NewsletterBlock[], ink: string): NewsletterBlock[] {
  return blocks.map((b) => {
    if (b.kind === "heading" || b.kind === "text") {
      return { ...b, style: { ...b.style, color: ink } };
    }
    if (b.kind === "text-box") {
      return { ...b, textStyle: { ...b.textStyle, color: ink } };
    }
    return b;
  });
}

function applyInkToCanvas(canvas: NewsletterCanvas, ink: string): NewsletterCanvas {
  return {
    ...canvas,
    elements: canvas.elements.map((el) => (el.kind === "text" ? { ...el, color: ink } : el)),
  };
}

function resetCanvasForFreshIssue(
  canvas: NewsletterCanvas | undefined,
  placeholders: { title: string; greetingHeading: string; greetingHtml: string },
  ink: string
): NewsletterCanvas {
  const storySpacingGaps = canvas?.storySpacingGaps;
  if (!canvas?.enabled || (canvas.elements?.length ?? 0) === 0) {
    return {
      enabled: false,
      elements: [],
      storySpacingGaps,
    };
  }

  const elements = canvas.elements
    .filter((el) => !isStoryCanvasElement(el))
    .map((el) => {
      if (el.kind !== "text") return el;
      if (el.id === "migrated-title") {
        return {
          ...el,
          color: ink,
          html: `<p><strong>${escapeHtml(placeholders.title)}</strong></p>`,
        };
      }
      if (el.id === "migrated-greeting") {
        return { ...el, color: ink, html: placeholders.greetingHtml };
      }
      if (el.id === "migrated-greeting-hd") {
        return {
          ...el,
          color: ink,
          html: `<p>${escapeHtml(placeholders.greetingHeading)}</p>`,
        };
      }
      return { ...el, color: ink };
    });

  return applyInkToCanvas(
    {
      ...canvas,
      enabled: true,
      elements,
      storySpacingGaps,
    },
    ink
  );
}

/** Drop story blocks and auto-migration dividers that duplicate the legacy chrome layout. */
function resetBlocksForFreshIssue(
  prev: StoriesState,
  placeholders: { title: string; greetingHeading: string; greetingHtml: string },
  ink: string
): NewsletterBlock[] {
  const version = prev.newsletterBlocksMigrationVersion ?? 0;
  if (version < 1) return [];

  const existing = prev.newsletterBlocks ?? [];
  const stripTemplateDividers = (blocks: NewsletterBlock[]) =>
    blocks.filter((b) => b.kind !== "story" && b.kind !== "divider");

  let blocks: NewsletterBlock[];
  if (existing.length === 0) {
    const seed: StoriesState = {
      ...prev,
      stories: [],
      newsletterTitle: placeholders.title,
      newsletterIntro: "",
      newsletterWelcomeLaura: DEFAULT_NEWSLETTER_GREETING,
      newsletterWelcomeLauraHtml: placeholders.greetingHtml,
      newsletterGreetingHeading: placeholders.greetingHeading,
    };
    blocks = stripTemplateDividers(buildMigratedNewsletterBlocks(seed));
  } else {
    blocks = stripTemplateDividers(existing).map((b) => {
      if ("sync" in b && b.sync?.kind === "issueTitle" && b.kind === "heading") {
        return { ...b, text: placeholders.title, style: { ...b.style, color: ink } };
      }
      if ("sync" in b && b.sync?.kind === "greetingBody" && b.kind === "text") {
        return { ...b, html: placeholders.greetingHtml, style: { ...b.style, color: ink } };
      }
      if ("sync" in b && b.sync?.kind === "greetingHeading" && b.kind === "heading") {
        return { ...b, text: placeholders.greetingHeading, style: { ...b.style, color: ink } };
      }
      return b;
    });
  }

  return applyInkToBlocks(blocks, ink);
}

/**
 * Start a new issue while preserving the visual template unchanged:
 * masthead images, portrait, hero, mission copy, colours, typography, canvas layout, and dividers.
 * Only stories and issue-specific copy (title + CEO greeting) are reset to placeholders.
 */
export function createFreshNewsletterIssueState(prev: StoriesState): StoriesState {
  const templateBase = prev.newsletterIssueTemplate ?? prev;
  const next: StoriesState = structuredClone(templateBase);
  const placeholders = buildFreshIssuePlaceholders();
  const ink = resolveNewsletterInkColor(templateBase);

  next.stories = [];
  next.newsletterTitle = placeholders.title;
  next.newsletterIntro = "";
  next.newsletterGreetingHeading = placeholders.greetingHeading;
  next.newsletterWelcomeLaura = DEFAULT_NEWSLETTER_GREETING;
  next.newsletterWelcomeLauraHtml = placeholders.greetingHtml;
  next.newsletterStoryTextColor = ink;
  next.newsletterElementStyles = applyInkToElementStyles(next.newsletterElementStyles, ink);
  next.executiveBriefStoryIds = next.executiveBriefStoryIds.map(() => "");
  next.executiveBriefImageOverrides = next.executiveBriefImageOverrides.map(() => "");
  next.newsletterCanvas = resetCanvasForFreshIssue(templateBase.newsletterCanvas, placeholders, ink);
  next.newsletterIssueTemplate = templateBase.newsletterIssueTemplate ?? captureFreshIssueTemplateState(templateBase);

  if ((templateBase.newsletterBlocksMigrationVersion ?? 0) >= 1) {
    next.newsletterBlocksMigrationVersion = 1;
    next.newsletterBlocks = resetBlocksForFreshIssue(templateBase, placeholders, ink);
  } else {
    next.newsletterBlocks = [];
  }

  return next;
}
