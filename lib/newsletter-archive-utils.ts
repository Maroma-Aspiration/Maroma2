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

export function pickThumbnailFromCanvas(canvas: NewsletterCanvas | undefined): string | undefined {
  const elements = canvas?.elements ?? [];

  for (const el of elements) {
    if (el.kind !== "story-grid") continue;
    for (const story of el.stories ?? []) {
      if (isUsableImageUrl(story.imageUrl)) return story.imageUrl.trim();
    }
  }

  for (const el of elements) {
    if (el.kind !== "image" || MASTHEAD_OVERLAY_IDS.has(el.id)) continue;
    if (isUsableImageUrl(el.src)) return el.src.trim();
  }

  for (const el of elements) {
    if (el.kind !== "image") continue;
    if (isUsableImageUrl(el.src)) return el.src.trim();
  }

  return undefined;
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
