import type { NewsletterArchiveIssue } from "./newsletter-archive-types";
import { archiveIssueDisplayTitle, buildArchiveRenderMeta, plainTextFromHtml } from "./newsletter-archive-utils";
import { reconcileNewsletterCanvasState } from "./canvas-reconcile-stories";
import type { NewsletterCanvas, StoriesState } from "./story-types";

const FRESH_GREETING_RE = /HERE LAURA GREETING/i;

function canvasText(canvas: NewsletterCanvas | undefined, id: string): string {
  const el = canvas?.elements?.find((item) => item.id === id && item.kind === "text");
  return el && el.kind === "text" ? plainTextFromHtml(el.html) : "";
}

function canvasHtml(canvas: NewsletterCanvas | undefined, id: string): string {
  const el = canvas?.elements?.find((item) => item.id === id && item.kind === "text");
  return el && el.kind === "text" ? el.html?.trim() ?? "" : "";
}

function canvasImageSrc(canvas: NewsletterCanvas | undefined, id: string): string {
  const el = canvas?.elements?.find((item) => item.id === id && item.kind === "image");
  return el && el.kind === "image" ? el.src?.trim() ?? "" : "";
}

function storyTitlesFromCanvas(canvas: NewsletterCanvas | undefined): string[] {
  const titles: string[] = [];
  for (const el of canvas?.elements ?? []) {
    if (el.kind !== "story-grid") continue;
    for (const story of el.stories ?? []) {
      if (story.title?.trim()) titles.push(story.title.trim());
    }
  }
  return titles;
}

function hasIssueStories(canvas: NewsletterCanvas | undefined): boolean {
  for (const el of canvas?.elements ?? []) {
    if (el.kind === "story-grid" && (el.stories?.length ?? 0) > 0) return true;
    if (/^migrated-(sdiv|st|si|sb|cta)-\d+$/.test(el.id)) return true;
    if (/^migrated-b(h|t|i|div)-\d+$/.test(el.id)) return true;
  }
  return false;
}

export function canvasContentScore(canvas: NewsletterCanvas | undefined): number {
  let score = 0;
  for (const el of canvas?.elements ?? []) {
    if (el.kind === "story-grid") score += (el.stories?.length ?? 0) * 12;
    if (/^migrated-(st|si|sb|cta)-\d+$/.test(el.id)) score += 8;
    if (el.kind === "text") {
      const text = plainTextFromHtml(el.html);
      if (text && !FRESH_GREETING_RE.test(text)) score += Math.min(6, Math.ceil(text.length / 80));
    }
    if (el.kind === "image" && el.src && !el.src.startsWith("data:")) score += 1;
  }
  return score;
}

export function isFreshNewsletterDraft(state: {
  newsletterCanvas?: NewsletterCanvas;
  stories?: StoriesState["stories"];
  newsletterWelcomeLaura?: string;
  newsletterWelcomeLauraHtml?: string;
  newsletterTitle?: string;
}): boolean {
  const greeting =
    canvasText(state.newsletterCanvas, "migrated-greeting") ||
    plainTextFromHtml(state.newsletterWelcomeLauraHtml) ||
    state.newsletterWelcomeLaura ||
    "";
  if (!FRESH_GREETING_RE.test(greeting)) return false;
  if (hasIssueStories(state.newsletterCanvas)) return false;
  const savedStories = (state.stories ?? []).filter((story) => story.kind !== "divider" && story.kind !== "text");
  return savedStories.length === 0;
}

export function storiesStateToArchiveIssue(
  state: StoriesState,
  sentAt: string,
  id = "previous-issue"
): NewsletterArchiveIssue | null {
  const canvas = state.newsletterCanvas;
  if (!canvas?.elements?.length) return null;
  return {
    id,
    slug: id,
    subject: state.newsletterTitle?.trim() || "Maroma newsletter",
    previewText: "",
    sentAt,
    canvas,
    renderMeta: buildArchiveRenderMeta(state),
    recipientCount: 0,
  };
}

export function applyArchiveIssueToState(
  state: StoriesState,
  issue: NewsletterArchiveIssue
): StoriesState {
  const canvas = issue.canvas;
  const title = canvasText(canvas, "migrated-title") || archiveIssueDisplayTitle(issue);
  const greetingHeading = canvasText(canvas, "migrated-greeting-hd");
  const greetingHtml = canvasHtml(canvas, "migrated-greeting");
  const missionHtml = canvasHtml(canvas, "migrated-mission");
  const missionHeading = canvasText(canvas, "migrated-mission-hd");
  const meta = issue.renderMeta ?? {};

  return reconcileNewsletterCanvasState({
    ...state,
    newsletterCanvas: canvas,
    newsletterTitle: title || state.newsletterTitle,
    newsletterGreetingHeading: greetingHeading || state.newsletterGreetingHeading,
    newsletterWelcomeLauraHtml: greetingHtml || state.newsletterWelcomeLauraHtml,
    newsletterWelcomeLaura: greetingHtml ? plainTextFromHtml(greetingHtml) : state.newsletterWelcomeLaura,
    newsletterMissionHtml: missionHtml || meta.newsletterMissionHtml || state.newsletterMissionHtml,
    newsletterMission: meta.newsletterMission || (missionHtml ? plainTextFromHtml(missionHtml) : state.newsletterMission),
    newsletterMissionHeading:
      missionHeading || meta.newsletterMissionHeading || state.newsletterMissionHeading,
    newsletterBackgroundColor: meta.newsletterBackgroundColor || state.newsletterBackgroundColor,
    newsletterFontFamily: meta.newsletterFontFamily || state.newsletterFontFamily,
    newsletterTopImageUrl: canvasImageSrc(canvas, "migrated-top") || state.newsletterTopImageUrl,
    newsletterLogoUrl: canvasImageSrc(canvas, "migrated-logo") || state.newsletterLogoUrl,
    newsletterPortraitUrl: canvasImageSrc(canvas, "migrated-portrait") || state.newsletterPortraitUrl,
    newsletterHeroImageUrl: canvasImageSrc(canvas, "migrated-hero") || state.newsletterHeroImageUrl,
  });
}

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

export function issueMonthFromCanvas(canvas: NewsletterCanvas | undefined, extra = ""): string | null {
  const title = `${canvasText(canvas, "migrated-title")} ${canvasText(canvas, "migrated-greeting-hd")} ${extra}`.toLowerCase();
  for (const month of MONTH_NAMES) {
    if (new RegExp(`\\b${month}\\b`, "i").test(title)) return month;
  }
  return null;
}

function issueSearchText(issue: NewsletterArchiveIssue): string {
  const bits = [issue.subject, archiveIssueDisplayTitle(issue)];
  for (const el of issue.canvas?.elements ?? []) {
    if (el.kind === "text") bits.push(plainTextFromHtml(el.html));
  }
  bits.push(...storyTitlesFromCanvas(issue.canvas));
  return bits.join(" ").toLowerCase();
}

export function pickArchiveIssueByMonth(
  issues: NewsletterArchiveIssue[],
  month: string
): NewsletterArchiveIssue | null {
  const wanted = month.trim().toLowerCase();
  if (!wanted) return null;
  const matches = issues.filter((issue) => {
    const fromTitle = issueMonthFromCanvas(issue.canvas, issue.subject);
    if (fromTitle === wanted) return true;
    return new RegExp(`\\b${wanted}\\b`, "i").test(issueSearchText(issue));
  });
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0] ?? null;
}

export function pickArchiveIssueToRestore(
  issues: NewsletterArchiveIssue[],
  live?: { newsletterCanvas?: NewsletterCanvas }
): NewsletterArchiveIssue | null {
  const july = pickArchiveIssueByMonth(issues, "july");
  if (july) return july;
  const liveScore = canvasContentScore(live?.newsletterCanvas);
  return (
    [...issues]
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
      .find((issue) => canvasContentScore(issue.canvas) > liveScore) ?? null
  );
}

export function preferServerCanvasOverLocalDraft(
  serverCanvas: NewsletterCanvas | undefined,
  draftCanvas: NewsletterCanvas | undefined
): boolean {
  const serverScore = canvasContentScore(serverCanvas);
  const draftScore = canvasContentScore(draftCanvas);
  if (isFreshNewsletterDraft({ newsletterCanvas: draftCanvas, stories: [] }) && serverScore > draftScore) {
    return true;
  }
  return false;
}

export function backupSnapshot(state: StoriesState): StoriesState {
  const clone = structuredClone(state) as StoriesState;
  if (clone.newsletterIssueTemplate) {
    clone.newsletterIssueTemplate = {
      ...clone.newsletterIssueTemplate,
      newsletterIssueTemplate: null,
    };
  }
  return clone;
}
