import { canvasToEmailHtml } from "./canvas-to-email";
import { reconcileNewsletterCanvasState } from "./canvas-reconcile-stories";
import type { NewsletterArchiveIssue } from "./newsletter-archive-types";
import { DEFAULT_STORY_SPACING_GAPS } from "./story-spacing-gaps";
import { extractEmailStylesAndBody } from "./newsletter-archive-utils";
import type { StoriesState } from "./story-types";

function prepareArchiveIssueCanvas(issue: NewsletterArchiveIssue): NewsletterArchiveIssue {
  const reconciled = reconcileNewsletterCanvasState({
    newsletterCanvas: issue.canvas,
    stories: [],
  } as unknown as StoriesState);
  if (!reconciled.newsletterCanvas) return issue;
  return { ...issue, canvas: reconciled.newsletterCanvas };
}

export function renderArchiveIssueEmailHtml(issue: NewsletterArchiveIssue, siteUrl: string): string {
  const prepared = prepareArchiveIssueCanvas(issue);
  const meta = prepared.renderMeta;
  return canvasToEmailHtml(prepared.canvas, {
    subject: prepared.subject,
    previewText: prepared.previewText,
    siteUrl,
    allowDataUrls: false,
    // Stacked flow: header images stay 2mm apart and later blocks never overlap.
    preserveDesktopLayout: false,
    backgroundColor: meta.newsletterBackgroundColor || "#10151c",
    fontFamily: meta.newsletterFontFamily ?? "serif",
    storySpacingGaps: meta.storySpacingGaps ?? DEFAULT_STORY_SPACING_GAPS,
    missionHeading: meta.newsletterMissionHeading,
    missionHtml: meta.newsletterMissionHtml,
    missionPlain: meta.newsletterMission,
    tracking: {
      pixelUrl: "",
      unsubUrl: `${siteUrl}/newsletter/unsubscribe`,
      viewOnlineUrl: `${siteUrl}/newsletter/archive/${prepared.slug}`,
    },
  });
}

export function renderArchiveIssueBodyHtml(issue: NewsletterArchiveIssue, siteUrl: string): string {
  const { styles, body } = extractEmailStylesAndBody(renderArchiveIssueEmailHtml(issue, siteUrl));
  if (!styles) return body;
  return `<style type="text/css">${styles}</style>${body}`;
}
