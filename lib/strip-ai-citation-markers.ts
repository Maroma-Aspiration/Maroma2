import type { CanvasEl, NewsletterCanvas, StoriesState } from "./story-types";

const CITE_TOKEN_RE =
  /(?:\[\s*)?(?:cite(?:\s*:)?)?(?:turn0(?:search|news|image|view|file|video)\d+)+(?:\s*\])?/gi;

export function stripAiCitationMarkers(text: string): string {
  if (!text || !/(?:cite)?turn0/i.test(text)) return text;
  return text
    .replace(CITE_TOKEN_RE, "")
    .replace(/([.!?])([A-Za-z])/g, "$1 $2")
    .replace(/[ \t]{2,}/g, " ");
}

function clean(value: string | undefined): string | undefined {
  if (typeof value !== "string") return value;
  return stripAiCitationMarkers(value);
}

function sanitizeCanvasElements(elements: CanvasEl[]): { elements: CanvasEl[]; changed: boolean } {
  let changed = false;
  const next = elements.map((el) => {
    if (el.kind === "text") {
      const html = stripAiCitationMarkers(el.html);
      if (html === el.html) return el;
      changed = true;
      return { ...el, html };
    }
    if (el.kind === "story-grid") {
      const stories = (el.stories ?? []).map((story) => {
        const title = stripAiCitationMarkers(story.title ?? "");
        const excerpt = stripAiCitationMarkers(story.excerpt ?? "");
        if (title === (story.title ?? "") && excerpt === (story.excerpt ?? "")) return story;
        changed = true;
        return { ...story, title, excerpt };
      });
      return changed ? { ...el, stories } : el;
    }
    if (el.kind === "cta") {
      const label = clean(el.label);
      if (label === el.label) return el;
      changed = true;
      return { ...el, label: label ?? "" };
    }
    return el;
  });
  return { elements: next, changed };
}

export function sanitizeStoriesStateCitations(state: StoriesState): { state: StoriesState; changed: boolean } {
  let changed = false;

  const stories = (state.stories ?? []).map((story) => {
    const title = stripAiCitationMarkers(story.title ?? "");
    const excerpt = stripAiCitationMarkers(story.excerpt ?? "");
    const body = stripAiCitationMarkers(story.body ?? "");
    if (title === (story.title ?? "") && excerpt === (story.excerpt ?? "") && body === (story.body ?? "")) {
      return story;
    }
    changed = true;
    return { ...story, title, excerpt, body };
  });

  const stringFields = [
    "newsletterTitle",
    "newsletterIntro",
    "newsletterMission",
    "newsletterMissionHtml",
    "newsletterMissionHeading",
    "newsletterWelcomeLaura",
    "newsletterWelcomeLauraHtml",
    "newsletterGreetingHeading",
  ] as const;
  const nextStrings: Partial<StoriesState> = {};
  for (const key of stringFields) {
    const current = state[key];
    if (typeof current !== "string") continue;
    const cleaned = stripAiCitationMarkers(current);
    if (cleaned !== current) {
      changed = true;
      (nextStrings as Record<string, string>)[key] = cleaned;
    }
  }

  const blocks = (state.newsletterBlocks ?? []).map((block) => {
    const currentHtml = "html" in block && typeof block.html === "string" ? block.html : undefined;
    const currentTitle = "title" in block && typeof block.title === "string" ? block.title : undefined;
    const currentExcerpt = "excerpt" in block && typeof block.excerpt === "string" ? block.excerpt : undefined;
    const html = currentHtml !== undefined ? stripAiCitationMarkers(currentHtml) : undefined;
    const title = currentTitle !== undefined ? stripAiCitationMarkers(currentTitle) : undefined;
    const excerpt = currentExcerpt !== undefined ? stripAiCitationMarkers(currentExcerpt) : undefined;
    let blockChanged = false;
    const patch: Record<string, string> = {};
    if (html !== undefined && html !== currentHtml) {
      patch.html = html;
      blockChanged = true;
    }
    if (title !== undefined && title !== currentTitle) {
      patch.title = title;
      blockChanged = true;
    }
    if (excerpt !== undefined && excerpt !== currentExcerpt) {
      patch.excerpt = excerpt;
      blockChanged = true;
    }
    if (!blockChanged) return block;
    changed = true;
    return { ...block, ...patch };
  });

  let canvas = state.newsletterCanvas;
  if (canvas?.elements?.length) {
    const sanitized = sanitizeCanvasElements(canvas.elements);
    if (sanitized.changed) {
      changed = true;
      canvas = { ...canvas, elements: sanitized.elements } satisfies NewsletterCanvas;
    }
  }

  if (!changed) return { state, changed: false };
  return {
    changed: true,
    state: {
      ...state,
      ...nextStrings,
      stories,
      newsletterBlocks: state.newsletterBlocks ? blocks : state.newsletterBlocks,
      newsletterCanvas: canvas,
    },
  };
}
