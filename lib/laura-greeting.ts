import { stripAiCitationMarkers } from "./strip-ai-citation-markers";
import { stripRtfControlWords } from "./strip-rtf-markup";
import type { StoryRecord } from "./story-types";

export const LAURA_NOTE_HEADING = "A Note from Laura";
export const LAURA_GREETING_PLACEHOLDER_RE = /HERE LAURA GREETING/i;
const STALE_LAURA_OPENER_RE =
  /I am glad to sit with you for|has smelled of the workshop again|I wanted to write while|None of it is grand/i;

export type StorySeed = {
  title: string;
  note: string;
  body: string;
  theme: StoryTheme;
};

type StoryTheme =
  | "incense"
  | "earth"
  | "cafe"
  | "making"
  | "people"
  | "celebration"
  | "other";

export function isLauraGreetingPlaceholder(value: string | undefined): boolean {
  const text = (value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return true;
  if (LAURA_GREETING_PLACEHOLDER_RE.test(text)) return true;
  if (STALE_LAURA_OPENER_RE.test(text)) return true;
  return /^dear friends,?\s*$/i.test(text);
}

function plainStoryText(value: string | undefined): string {
  return stripRtfControlWords(stripAiCitationMarkers(value ?? ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function classifyTheme(title: string, note: string): StoryTheme {
  const blob = `${title} ${note}`.toLowerCase();
  if (/incense|resin|sandal|agarbatti/.test(blob)) return "incense";
  if (/cafe|café|heart day|meal|food|kitchen|dining/.test(blob)) return "cafe";
  if (/environment|planet|sustain|recycl|solar|plastic|wax|footprint/.test(blob)) return "earth";
  if (/exhibition|artist|fabric|carpet|magic carpet|tiny artist/.test(blob)) return "making";
  if (/team|staff|friendship|community|colleague/.test(blob)) return "people";
  if (/festival|celebration|diwali|christmas|new year/.test(blob)) return "celebration";
  return "other";
}

export function collectNewsletterStorySeeds(stories: StoryRecord[]): StorySeed[] {
  const seeds: StorySeed[] = [];
  for (const story of stories) {
    if (story.kind === "divider" || story.kind === "text") continue;
    const title = plainStoryText(story.title).replace(/[.!?]+$/, "").trim();
    const body = plainStoryText(story.body || story.excerpt);
    const note = plainStoryText(story.excerpt || story.body);
    if (!title && !note && !body) continue;
    seeds.push({
      title: title || "a note from Auroville",
      note,
      body,
      theme: classifyTheme(title, `${note} ${body}`),
    });
    if (seeds.length >= 5) break;
  }
  return seeds;
}

function has(blob: string, pattern: RegExp): boolean {
  return pattern.test(blob);
}

function storyParagraph(seed: StorySeed, index: number, total: number): string {
  const blob = `${seed.title} ${seed.note} ${seed.body}`.toLowerCase();
  const last = index === total - 1 && total > 1;
  const first = index === 0;

  if (seed.theme === "incense") {
    const lead = first
      ? "We begin with the timeless art of incense making, a craft that remains very much alive in our Auroville workshops."
      : "We turn to the timeless art of incense making, a craft that remains very much alive in our Auroville workshops.";
    return `${lead} There is something beautiful about knowing that each stick is still shaped by hand, with patience, skill and an appreciation for the natural ingredients that have been part of Indian traditions for generations.`;
  }

  if (seed.theme === "earth") {
    const details = [
      has(blob, /solar/) ? "solar energy" : "",
      has(blob, /plastic|packaging/) ? "thoughtful packaging" : "",
      has(blob, /wax|leftover|recycl/) ? "finding new uses for leftover materials" : "",
    ].filter(Boolean);
    const from = details.length
      ? `From ${details.length === 1 ? details[0] : `${details.slice(0, -1).join(", ")} to ${details[details.length - 1]}`}`
      : "From the energy we use to the materials we keep";
    const lead = first
      ? "We begin by reflecting on our responsibility towards the environment."
      : "We also reflect on our responsibility towards the environment.";
    return `${lead} Sustainability is not simply a destination, but an ongoing journey of making more conscious choices. ${from}, we believe that even small actions can have a lasting impact.`;
  }

  if (seed.theme === "cafe") {
    const lead = last
      ? "Closer to home, Maroma Cafe reminds us that caring for ourselves can be one of life's simple pleasures."
      : "Maroma Cafe reminds us that caring for ourselves can be one of life's simple pleasures.";
    return `${lead} Good food, fresh ingredients and a moment to slow down and enjoy a meal are all part of a more mindful way of living.`;
  }

  if (seed.theme === "making") {
    const show = /magic carpet/i.test(seed.title)
      ? "The Magic Carpet"
      : seed.title;
    const lead = last ? "And finally, we celebrate" : "We celebrate";
    return `${lead} the wonderful creative spirit of Auroville through ${show}, bringing together art, imagination and the joy of making things by hand.`;
  }

  if (seed.theme === "people") {
    return `${first ? "We begin with" : "We also share"} the people who give Maroma its character. ${seed.note || "Their care, humour and daily work are the real story behind everything we make."}`;
  }

  if (seed.theme === "celebration") {
    return `${last ? "And finally, we" : "We also"} mark a moment of celebration, and the pleasure of gathering around something made with care.`;
  }

  const about = seed.note
    ? seed.note.replace(/^[A-Z]/, (ch) => ch.toLowerCase())
    : "a closer look at the work unfolding here in Auroville.";
  if (first) return `We begin with ${seed.title}. ${about}`;
  if (last) return `And finally, ${seed.title}. ${about}`;
  return `We also share ${seed.title}. ${about}`;
}

function opening(month: string): string {
  const welcome = month ? `As we welcome ${month}` : "As we welcome this new month";
  return `${welcome}, I find myself reflecting on the many things that make Maroma such a special place. Beyond the fragrances and products we create, it is the people, the traditions, the creativity and the shared values that give our work its meaning.`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toHtml(paragraphs: string[]): string {
  return paragraphs.filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
}

export function monthLabelFromNewsletterTitle(title: string | undefined): string | undefined {
  const match = (title ?? "").match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i,
  );
  return match?.[1];
}

export function buildLauraGreetingFromStories(
  stories: StoryRecord[],
  monthLabel?: string,
): { text: string; html: string; heading: string } {
  const seeds = collectNewsletterStorySeeds(stories);
  const month = (monthLabel ?? "").trim();
  const paragraphs = ["Dear Friends,", opening(month)];

  if (seeds.length === 0) {
    paragraphs.push(
      "This month the stories are still gathering, and I will share them here as they arrive.",
    );
  } else {
    paragraphs.push("This month, we are taking a closer look at some of those stories.");
    seeds.forEach((seed, index) => {
      paragraphs.push(storyParagraph(seed, index, seeds.length));
    });
    paragraphs.push(
      "What connects all these stories is something close to my heart: the belief that how we do things matters just as much as what we create.",
    );
  }

  paragraphs.push(
    "Thank you for continuing to be part of the Maroma journey. Your support allows us to preserve traditional skills, explore new possibilities and remain true to the values that have guided us over the years.",
  );
  paragraphs.push("With warm wishes from all of us in Auroville,");
  paragraphs.push("Laura");

  return {
    heading: LAURA_NOTE_HEADING,
    text: paragraphs.join("\n\n"),
    html: toHtml(paragraphs),
  };
}
