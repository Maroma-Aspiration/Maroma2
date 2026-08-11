import { canvasToEmailHtml } from "./canvas-to-email";
import type { NewsletterArchiveIssue } from "./newsletter-archive-types";
import { DEFAULT_STORY_SPACING_GAPS } from "./story-spacing-gaps";
import { extractEmailBodyContent } from "./newsletter-archive-utils";

export function renderArchiveIssueEmailHtml(issue: NewsletterArchiveIssue, siteUrl: string): string {
  const meta = issue.renderMeta;
  return canvasToEmailHtml(issue.canvas, {
    subject: issue.subject,
    previewText: issue.previewText,
    siteUrl,
    allowDataUrls: false,
    backgroundColor: meta.newsletterBackgroundColor || "#10151c",
    fontFamily: meta.newsletterFontFamily ?? "serif",
    storySpacingGaps: meta.storySpacingGaps ?? DEFAULT_STORY_SPACING_GAPS,
    missionHeading: meta.newsletterMissionHeading,
    missionHtml: meta.newsletterMissionHtml,
    missionPlain: meta.newsletterMission,
    tracking: {
      pixelUrl: "",
      unsubUrl: `${siteUrl}/newsletter/unsubscribe`,
      viewOnlineUrl: `${siteUrl}/newsletter/archive/${issue.slug}`,
    },
  });
}

export function renderArchiveIssueBodyHtml(issue: NewsletterArchiveIssue, siteUrl: string): string {
  return extractEmailBodyContent(renderArchiveIssueEmailHtml(issue, siteUrl));
}
