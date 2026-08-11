import type { NewsletterCanvas, StoriesState } from "./story-types";
import type { StorySpacingGaps } from "./story-spacing-gaps";

/** Minimal state fields needed to re-render a sent issue from its canvas snapshot. */
export type NewsletterArchiveRenderMeta = {
  newsletterBackgroundColor?: string;
  newsletterFontFamily?: StoriesState["newsletterFontFamily"];
  newsletterMissionHeading?: string;
  newsletterMissionHtml?: string;
  newsletterMission?: string;
  storySpacingGaps?: StorySpacingGaps;
};

export type NewsletterArchiveIssue = {
  id: string;
  slug: string;
  subject: string;
  previewText: string;
  sentAt: string;
  thumbnailUrl?: string;
  canvas: NewsletterCanvas;
  renderMeta: NewsletterArchiveRenderMeta;
  recipientCount: number;
};

export type NewsletterArchiveState = {
  issues: NewsletterArchiveIssue[];
};

export type NewsletterArchiveSummary = Pick<
  NewsletterArchiveIssue,
  "id" | "slug" | "subject" | "previewText" | "sentAt" | "thumbnailUrl" | "recipientCount"
>;
