import { MASTHEAD_OVERLAY_IDS } from "./canvas-layout";
import type { NewsletterArchiveIssue, NewsletterArchiveRenderMeta } from "./newsletter-archive-types";
import type { NewsletterCanvas, StoriesState } from "./story-types";

const GENERIC_SUBJECT_RE = /^(maroma\s+)?newsletter$/i;
const TITLE_ELEMENT_IDS = ["migrated-title", "migrated-greeting-hd", "migrated-greeting"];

export function slugifyArchiveTitle(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function buildArchiveSlug(subject: string, sentAt: string, id: string): string {
  const datePart = sentAt.slice(0, 10);
  const base = slugifyArchiveTitle(subject) || "newsletter";
  return `${base}-${datePart}-${id.slice(0, 8)}`;
}

function isUsableImageUrl(url: string | undefined): url is string {
  const src = url?.trim() ?? "";
  return src.length > 0 && !src.startsWith("data:");
}

const THUMBNAIL_MASTHEAD_IDS = ["migrated-top", "migrated-hero", "migrated-portrait"] as const;

/** Ordered image candidates for archive cards — masthead first, then story grid, then other art. */
export function collectThumbnailCandidatesFromCanvas(canvas: NewsletterCanvas | undefined): string[] {
  const elements = canvas?.elements ?? [];
  const urls: string[] = [];
  const add = (url: string | undefined) => {
    if (!isUsableImageUrl(url)) return;
    const trimmed = url.trim();
    if (!urls.includes(trimmed)) urls.push(trimmed);
  };

  for (const id of THUMBNAIL_MASTHEAD_IDS) {
    const el = elements.find((item) => item.id === id && item.kind === "image");
    if (el && el.kind === "image") add(el.src);
  }

  for (const el of elements) {
    if (el.kind !== "story-grid") continue;
    for (const story of el.stories ?? []) add(story.imageUrl);
  }

  for (const el of elements) {
    if (el.kind !== "image" || MASTHEAD_OVERLAY_IDS.has(el.id)) continue;
    add(el.src);
  }

  for (const el of elements) {
    if (el.kind !== "image") continue;
    add(el.src);
  }

  return urls;
}

export function pickThumbnailFromCanvas(canvas: NewsletterCanvas | undefined): string | undefined {
  return collectThumbnailCandidatesFromCanvas(canvas)[0];
}

/** Prefer masthead art so duplicate months do not all reuse the first TOP STORIES image. */
export function assignUniqueArchiveThumbnails<T extends { thumbnailUrl?: string; canvas: NewsletterCanvas }>(
  issues: T[]
): T[] {
  const used = new Set<string>();
  return issues.map((issue) => {
    const candidates = collectThumbnailCandidatesFromCanvas(issue.canvas);
    const stored = issue.thumbnailUrl?.trim();
    const ordered = stored && candidates.includes(stored) ? [stored, ...candidates.filter((u) => u !== stored)] : candidates;
    const thumb = ordered.find((url) => !used.has(url)) ?? ordered[0];
    if (thumb) used.add(thumb);
    return { ...issue, thumbnailUrl: thumb || issue.thumbnailUrl };
  });
}

export function plainTextFromHtml(html: string | undefined): string {
  return (html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function isGenericArchiveSubject(subject: string | undefined): boolean {
  const trimmed = (subject ?? "").replace(/^\[TEST\]\s*/i, "").trim();
  return !trimmed || GENERIC_SUBJECT_RE.test(trimmed);
}

export function titleFromCanvas(canvas: NewsletterCanvas | undefined): string {
  const elements = canvas?.elements ?? [];
  for (const id of TITLE_ELEMENT_IDS) {
    const el = elements.find((item) => item.id === id && item.kind === "text");
    if (!el || el.kind !== "text") continue;
    const text = plainTextFromHtml(el.html);
    if (text && !isGenericArchiveSubject(text)) return text.slice(0, 120);
  }

  for (const el of elements) {
    if (el.kind !== "text" || el.fontSize < 22) continue;
    const text = plainTextFromHtml(el.html);
    if (text && text.length > 3 && !isGenericArchiveSubject(text)) return text.slice(0, 120);
  }

  return "";
}

export function archiveIssueDisplayTitle(issue: Pick<NewsletterArchiveIssue, "subject" | "sentAt" | "canvas">): string {
  if (!isGenericArchiveSubject(issue.subject)) return issue.subject.trim();
  const fromCanvas = titleFromCanvas(issue.canvas);
  if (fromCanvas) return fromCanvas;
  const sent = Date.parse(issue.sentAt);
  const month = Number.isNaN(sent)
    ? ""
    : new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(sent));
  return month ? `Maroma newsletter · ${month}` : "Maroma newsletter";
}

export function previewFromCanvas(canvas: NewsletterCanvas | undefined): string {
  for (const el of canvas?.elements ?? []) {
    if (el.kind === "text") {
      if (TITLE_ELEMENT_IDS.includes(el.id)) continue;
      const plain = plainTextFromHtml(el.html);
      if (plain.length > 40) return plain.length > 220 ? `${plain.slice(0, 217)}…` : plain;
    }
    if (el.kind === "story-grid") {
      for (const story of el.stories ?? []) {
        const excerpt = story.excerpt?.trim();
        if (excerpt && excerpt.length > 40) {
          return excerpt.length > 220 ? `${excerpt.slice(0, 217)}…` : excerpt;
        }
      }
    }
  }
  return "";
}

/** Same live canvas sent more than once should collapse to one archive card. */
export function archiveCanvasFingerprint(canvas: NewsletterCanvas | undefined): string {
  const bits: string[] = [];
  for (const el of canvas?.elements ?? []) {
    if (el.kind === "text") {
      bits.push(`t:${el.id}:${plainTextFromHtml(el.html).slice(0, 80)}`);
    } else if (el.kind === "image") {
      // Ignore src: re-uploads get new blob URLs for the same issue.
      bits.push(`i:${el.id}:${Math.round(el.w)}x${Math.round(el.h)}`);
    } else if (el.kind === "story-grid") {
      for (const story of el.stories ?? []) {
        bits.push(`s:${(story.storyId || story.title || "").slice(0, 40)}`);
      }
    } else if (el.kind === "cta") {
      bits.push(`c:${el.id}:${(el.label || "").slice(0, 40)}`);
    } else {
      bits.push(`o:${el.kind}:${el.id}`);
    }
  }
  return bits.join("|");
}

export function presentArchiveIssue<T extends Pick<NewsletterArchiveIssue, "subject" | "sentAt" | "canvas" | "previewText" | "thumbnailUrl">>(
  issue: T
): T {
  return {
    ...issue,
    subject: archiveIssueDisplayTitle(issue),
    previewText: issue.previewText.trim() || previewFromCanvas(issue.canvas),
    thumbnailUrl: pickThumbnailFromCanvas(issue.canvas) || issue.thumbnailUrl,
  };
}

export function buildArchiveRenderMeta(
  state: StoriesState,
  storySpacingGaps?: NewsletterArchiveRenderMeta["storySpacingGaps"]
): NewsletterArchiveRenderMeta {
  return {
    newsletterBackgroundColor: state.newsletterBackgroundColor,
    newsletterFontFamily: state.newsletterFontFamily,
    newsletterMissionHeading: state.newsletterMissionHeading,
    newsletterMissionHtml: state.newsletterMissionHtml,
    newsletterMission: state.newsletterMission,
    storySpacingGaps: storySpacingGaps ?? state.newsletterCanvas?.storySpacingGaps,
  };
}

export function extractEmailBodyContent(fullHtml: string): string {
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return fullHtml;
  return bodyMatch[1].trim();
}

export function extractEmailStylesAndBody(fullHtml: string): { styles: string; body: string } {
  const styles = fullHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1]?.trim() ?? "";
  return {
    styles,
    body: extractEmailBodyContent(fullHtml),
  };
}
