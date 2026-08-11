import { buildOgImageFromCanvas } from "./newsletter-archive-seo";
import { pickThumbnailFromCanvas } from "./newsletter-archive-utils";
import type { NewsletterBlock, StoriesState } from "./story-types";

export type CurrentIssuePreview = {
  title: string;
  previewText: string;
  thumbnailUrl?: string;
  dateLabel: string;
};

function buildCurrentIssueTitle(state: StoriesState): string {
  const month = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date());
  const base = state.newsletterTitle?.trim() || "Newsletter";
  return `${base} | ${month}`;
}

function buildCurrentIssuePreviewText(state: StoriesState): string {
  const candidates: string[] = [];
  if (state.newsletterMission?.trim()) candidates.push(state.newsletterMission.trim());
  if (state.newsletterIntro?.trim()) candidates.push(state.newsletterIntro.trim());
  for (const block of state.newsletterBlocks ?? []) {
    if ((block.kind === "text" || block.kind === "text-box") && block.html) {
      candidates.push(block.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    }
  }
  for (const story of state.stories ?? []) {
    if (story.excerpt?.trim()) candidates.push(story.excerpt.trim());
  }
  const summary = candidates.find((c) => c.length > 40) ?? candidates[0] ?? "";
  return summary.length > 220 ? `${summary.slice(0, 217)}…` : summary;
}

function pickCurrentIssueThumbnail(state: StoriesState): string | undefined {
  const fromCanvas = buildOgImageFromCanvas(state.newsletterCanvas);
  if (fromCanvas?.trim()) return fromCanvas.trim();

  const canvas = state.newsletterCanvas;
  if (canvas?.elements?.length) {
    for (const el of canvas.elements) {
      if (el.kind === "image") {
        const src = el.src?.trim();
        if (src) return src;
      }
      if (el.kind === "story-grid") {
        for (const story of el.stories ?? []) {
          const url = story.imageUrl?.trim();
          if (url) return url;
        }
      }
    }
  }

  const block = (state.newsletterBlocks ?? []).find(
    (b): b is Extract<NewsletterBlock, { kind: "image" }> => b.kind === "image" && b.images.length > 0
  );
  if (block?.images[0]?.trim()) return block.images[0].trim();
  if (state.newsletterHeroImageUrl?.trim()) return state.newsletterHeroImageUrl.trim();
  if (state.newsletterPortraitUrl?.trim()) return state.newsletterPortraitUrl.trim();
  if (state.newsletterTopImageUrl?.trim()) return state.newsletterTopImageUrl.trim();

  const story = (state.stories ?? []).find((s) => s.imageUrl?.trim() || (s.images && s.images.length > 0));
  if (story) return (story.imageUrl || story.images?.[0])?.trim() || undefined;

  return pickThumbnailFromCanvas(canvas);
}

export function buildCurrentIssuePreview(state: StoriesState): CurrentIssuePreview | null {
  const canvas = state.newsletterCanvas;
  const hasCanvas = canvas?.enabled !== false && (canvas?.elements?.length ?? 0) > 0;
  const hasLegacyContent =
    Boolean(state.newsletterTitle?.trim()) ||
    Boolean(state.newsletterMission?.trim()) ||
    (state.newsletterBlocks?.length ?? 0) > 0 ||
    (state.stories?.length ?? 0) > 0;

  if (!hasCanvas && !hasLegacyContent) return null;

  return {
    title: buildCurrentIssueTitle(state),
    previewText: buildCurrentIssuePreviewText(state),
    thumbnailUrl: pickCurrentIssueThumbnail(state),
    dateLabel: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date()),
  };
}
