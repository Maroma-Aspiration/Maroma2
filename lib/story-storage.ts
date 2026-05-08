import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import {
  STORIES_STORAGE_KEY,
  type StoriesState,
  type StoryRecord,
  type NewsletterElementStyle,
  type NewsletterImageTransforms
} from "./story-types";

const storageDir = path.join(process.cwd(), "data");
const storagePath = path.join(storageDir, "stories.json");
const storiesKvKey = "maroma:stories";
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const defaultState: StoriesState = {
  stories: [],
  socialSources: {
    instagram: "https://www.instagram.com/maromaindia/",
    facebook: "https://www.facebook.com/maromaindia"
  },
  rssFeedUrls: [],
  newsletterTitle: "Newsletter",
  newsletterIntro: "Welcome to the latest issue from Maroma.",
  newsletterTopImageUrl: "",
  newsletterLogoUrl: "",
  newsletterPortraitUrl: "",
  newsletterHeroImageUrl: "",
  newsletterMission: "",
  newsletterMissionHtml: "",
  newsletterMissionHeading: "Maroma mission",
  newsletterWelcomeLaura: "",
  newsletterWelcomeLauraHtml: "",
  newsletterGreetingHeading: "Greeting from CEO",
  newsletterTextAlign: "center",
  newsletterBackgroundColor: "#10151c",
  newsletterSectionHeadingSizeRem: 0.86,
  newsletterIssueHeadingSizeRem: 3,
  newsletterBodyFontSizeRem: 1.04,
  newsletterElementStyles: {
    issueHeading: {
      fontFamily: "inherit",
      fontSizeRem: 3,
      textAlign: "center",
      fontWeight: 700,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: ""
    },
    missionHeading: {
      fontFamily: "inherit",
      fontSizeRem: 0.86,
      textAlign: "center",
      fontWeight: 600,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: ""
    },
    missionBody: {
      fontFamily: "inherit",
      fontSizeRem: 1.04,
      textAlign: "center",
      fontWeight: 400,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: ""
    },
    greetingHeading: {
      fontFamily: "inherit",
      fontSizeRem: 0.86,
      textAlign: "center",
      fontWeight: 600,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: ""
    },
    greetingBody: {
      fontFamily: "inherit",
      fontSizeRem: 1.04,
      textAlign: "center",
      fontWeight: 400,
      isQuoteBox: false,
      quoteBoxColor: "#1f3d4a",
      color: ""
    }
  },
  newsletterImageTransforms: {
    topImage: { x: 0, y: 0, zoom: 1, borderRadius: 14, zIndex: 0 },
    logo: { x: 0, y: 0, zoom: 1, borderRadius: 0, zIndex: 0 },
    portrait: { x: 0, y: 0, zoom: 1, borderRadius: 9999, zIndex: 2 },
    hero: { x: 0, y: 0, zoom: 1, borderRadius: 14, zIndex: 1 }
  }
};

function parseElementStyle(input: unknown, fallback: NewsletterElementStyle): NewsletterElementStyle {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    fontFamily: typeof raw.fontFamily === "string" && raw.fontFamily.trim() ? raw.fontFamily : fallback.fontFamily,
    fontSizeRem:
      typeof raw.fontSizeRem === "number" ? Math.min(5, Math.max(0.6, raw.fontSizeRem)) : fallback.fontSizeRem,
    textAlign: raw.textAlign === "left" ? "left" : raw.textAlign === "center" ? "center" : fallback.textAlign,
    fontWeight:
      typeof raw.fontWeight === "number" ? Math.min(800, Math.max(300, raw.fontWeight)) : fallback.fontWeight,
    isQuoteBox: Boolean(raw.isQuoteBox),
    quoteBoxColor:
      typeof raw.quoteBoxColor === "string" && raw.quoteBoxColor.trim()
        ? raw.quoteBoxColor
        : fallback.quoteBoxColor,
    color: typeof raw.color === "string" ? raw.color.trim() : fallback.color
  };
}

function parseImageTransforms(input: unknown, fallback: NewsletterImageTransforms): NewsletterImageTransforms {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const parseOne = (key: "topImage" | "logo" | "portrait" | "hero") => {
    const value = raw[key];
    const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return {
      x: typeof item.x === "number" ? Math.min(500, Math.max(-500, item.x)) : fallback[key].x,
      y: typeof item.y === "number" ? Math.min(500, Math.max(-500, item.y)) : fallback[key].y,
      zoom:
        typeof item.zoom === "number" && Number.isFinite(item.zoom)
          ? Math.min(3, Math.max(0.01, item.zoom))
          : fallback[key].zoom,
      borderRadius:
        typeof item.borderRadius === "number" && Number.isFinite(item.borderRadius)
          ? Math.min(9999, Math.max(0, item.borderRadius))
          : fallback[key].borderRadius,
      zIndex:
        typeof item.zIndex === "number" && Number.isFinite(item.zIndex)
          ? Math.min(999, Math.max(-999, Math.round(item.zIndex)))
          : fallback[key].zIndex
    };
  };
  return {
    topImage: parseOne("topImage"),
    logo: parseOne("logo"),
    portrait: parseOne("portrait"),
    hero: parseOne("hero")
  };
}

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "story";

const normalizeStory = (story: Partial<StoryRecord>): StoryRecord => {
  const now = new Date().toISOString();
  const kind = story.kind === "divider" ? "divider" : "story";
  const title = (story.title ?? "").trim() || "Untitled story";
  const id = story.id ?? crypto.randomUUID();
  const slugSeed = story.slug?.trim() ? story.slug.trim() : title;
  if (kind === "divider") {
    return {
      id,
      kind,
      slug: story.slug?.trim() || `divider-${id}`,
      title: "Divider",
      excerpt: "",
      body: "",
      imageUrl: "",
      sourceUrl: "",
      source: "manual",
      ctaLabel: "",
      ctaUrl: "",
      publishedAt: story.publishedAt ?? now,
      updatedAt: now,
      featured: Boolean(story.featured)
    };
  }
  return {
    id,
    kind,
    slug: toSlug(slugSeed),
    title,
    excerpt: (story.excerpt ?? "").trim(),
    body: (story.body ?? "").trim(),
    imageUrl: (story.imageUrl ?? "").trim(),
    sourceUrl: (story.sourceUrl ?? "").trim(),
    source: story.source ?? "manual",
    ctaLabel: (story.ctaLabel ?? "Read more").trim() || "Read more",
    ctaUrl: (story.ctaUrl ?? "").trim(),
    publishedAt: story.publishedAt ?? now,
    updatedAt: now,
    featured: Boolean(story.featured)
  };
};

const parseState = (value: unknown): StoriesState => {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const stories = Array.isArray(raw.stories)
    ? raw.stories
        .map((s) => normalizeStory(s as Partial<StoryRecord>))
        .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    : [];
  const socialSources = raw.socialSources && typeof raw.socialSources === "object"
    ? (raw.socialSources as { instagram?: string; facebook?: string })
    : {};
  const rssFeedUrls = Array.isArray(raw.rssFeedUrls)
    ? raw.rssFeedUrls
        .filter((u): u is string => typeof u === "string")
        .map((u) => u.trim())
        .filter(Boolean)
    : defaultState.rssFeedUrls;

  return {
    stories,
    socialSources: {
      instagram: socialSources.instagram ?? defaultState.socialSources.instagram,
      facebook: socialSources.facebook ?? defaultState.socialSources.facebook
    },
    rssFeedUrls,
    newsletterTitle: typeof raw.newsletterTitle === "string" ? raw.newsletterTitle : defaultState.newsletterTitle,
    newsletterIntro: typeof raw.newsletterIntro === "string" ? raw.newsletterIntro : defaultState.newsletterIntro,
    newsletterTopImageUrl:
      typeof raw.newsletterTopImageUrl === "string" ? raw.newsletterTopImageUrl : defaultState.newsletterTopImageUrl,
    newsletterLogoUrl:
      typeof raw.newsletterLogoUrl === "string" ? raw.newsletterLogoUrl : defaultState.newsletterLogoUrl,
    newsletterPortraitUrl:
      typeof raw.newsletterPortraitUrl === "string" ? raw.newsletterPortraitUrl : defaultState.newsletterPortraitUrl,
    newsletterHeroImageUrl:
      typeof raw.newsletterHeroImageUrl === "string"
        ? raw.newsletterHeroImageUrl
        : defaultState.newsletterHeroImageUrl,
    newsletterMission:
      typeof raw.newsletterMission === "string" ? raw.newsletterMission : defaultState.newsletterMission,
    newsletterMissionHtml:
      typeof raw.newsletterMissionHtml === "string" ? raw.newsletterMissionHtml : defaultState.newsletterMissionHtml,
    newsletterMissionHeading:
      typeof raw.newsletterMissionHeading === "string"
        ? raw.newsletterMissionHeading
        : defaultState.newsletterMissionHeading,
    newsletterWelcomeLaura:
      typeof raw.newsletterWelcomeLaura === "string"
        ? raw.newsletterWelcomeLaura
        : defaultState.newsletterWelcomeLaura,
    newsletterWelcomeLauraHtml:
      typeof raw.newsletterWelcomeLauraHtml === "string"
        ? raw.newsletterWelcomeLauraHtml
        : defaultState.newsletterWelcomeLauraHtml,
    newsletterGreetingHeading:
      typeof raw.newsletterGreetingHeading === "string"
        ? raw.newsletterGreetingHeading
        : defaultState.newsletterGreetingHeading,
    newsletterTextAlign:
      raw.newsletterTextAlign === "left" || raw.newsletterTextAlign === "center"
        ? raw.newsletterTextAlign
        : defaultState.newsletterTextAlign,
    newsletterBackgroundColor:
      typeof raw.newsletterBackgroundColor === "string" && raw.newsletterBackgroundColor.trim()
        ? raw.newsletterBackgroundColor.trim()
        : defaultState.newsletterBackgroundColor,
    newsletterSectionHeadingSizeRem:
      typeof raw.newsletterSectionHeadingSizeRem === "number"
        ? Math.min(2, Math.max(0.6, raw.newsletterSectionHeadingSizeRem))
        : defaultState.newsletterSectionHeadingSizeRem,
    newsletterIssueHeadingSizeRem:
      typeof raw.newsletterIssueHeadingSizeRem === "number"
        ? Math.min(5, Math.max(1.5, raw.newsletterIssueHeadingSizeRem))
        : defaultState.newsletterIssueHeadingSizeRem,
    newsletterBodyFontSizeRem:
      typeof raw.newsletterBodyFontSizeRem === "number"
        ? Math.min(2.4, Math.max(0.8, raw.newsletterBodyFontSizeRem))
        : defaultState.newsletterBodyFontSizeRem,
    newsletterElementStyles: {
      issueHeading: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.issueHeading,
        defaultState.newsletterElementStyles.issueHeading
      ),
      missionHeading: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.missionHeading,
        defaultState.newsletterElementStyles.missionHeading
      ),
      missionBody: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.missionBody,
        defaultState.newsletterElementStyles.missionBody
      ),
      greetingHeading: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.greetingHeading,
        defaultState.newsletterElementStyles.greetingHeading
      ),
      greetingBody: parseElementStyle(
        (raw.newsletterElementStyles as Record<string, unknown> | undefined)?.greetingBody,
        defaultState.newsletterElementStyles.greetingBody
      )
    },
    newsletterImageTransforms: parseImageTransforms(raw.newsletterImageTransforms, defaultState.newsletterImageTransforms)
  };
};

export async function readStoriesState(): Promise<StoriesState> {
  if (hasKvConfig) {
    try {
      const stored = await kv.get(storiesKvKey);
      if (stored) {
        return parseState(stored);
      }
    } catch {
      // fall back to file state
    }
  }
  try {
    const raw = await fs.readFile(storagePath, "utf8");
    return parseState(JSON.parse(raw));
  } catch {
    return defaultState;
  }
}

export async function writeStoriesState(state: StoriesState): Promise<StoriesState> {
  const parsed = parseState(state);
  if (hasKvConfig) {
    try {
      await kv.set(storiesKvKey, parsed);
      return parsed;
    } catch {
      // fall back to file state
    }
  }
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(parsed, null, 2), "utf8");
  return parsed;
}

export function mergeStoryById(existing: StoryRecord[], incoming: StoryRecord[]): StoryRecord[] {
  const next = new Map(existing.map((s) => [s.id, s]));
  for (const story of incoming) {
    next.set(story.id, story);
  }
  return Array.from(next.values()).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export { defaultState as defaultStoriesState, normalizeStory, parseState, toSlug };
export { STORIES_STORAGE_KEY };
