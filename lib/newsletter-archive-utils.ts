import type { NewsletterCanvas } from "./story-types";
import type { NewsletterArchiveRenderMeta } from "./newsletter-archive-types";
import type { StoriesState } from "./story-types";

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

export function pickThumbnailFromCanvas(canvas: NewsletterCanvas): string | undefined {
  for (const el of canvas.elements ?? []) {
    if (el.kind === "image") {
      const src = el.src?.trim();
      if (src && !src.startsWith("data:")) return src;
    }
    if (el.kind === "story-grid") {
      for (const story of el.stories ?? []) {
        const url = story.imageUrl?.trim();
        if (url && !url.startsWith("data:")) return url;
      }
    }
  }
  return undefined;
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
