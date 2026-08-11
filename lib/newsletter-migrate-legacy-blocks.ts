import {
  DEFAULT_BLOCK_TEXT_STYLE,
  type NewsletterBlock,
  type NewsletterDecorativeLineBlock,
  type NewsletterLayoutDivider,
  type NewsletterStoryBlock,
  type StoriesState,
  type StoryRecord
} from "./story-types";
import { elementStyleToBlockTextStyle, imageTransformToBlockTransform } from "./newsletter-block-legacy-sync";

const newId = (prefix: string): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

function dividerToDecorativeBlock(d: NewsletterLayoutDivider): NewsletterDecorativeLineBlock {
  return {
    id: d.id,
    kind: "decorative-line",
    preset: {
      offsetX: d.offsetX,
      offsetY: d.offsetY,
      marginTop: d.marginTop,
      marginBottom: d.marginBottom,
      thickness: d.thickness,
      color: d.color,
      widthPercent: d.widthPercent,
      lineStyle: d.lineStyle
    }
  };
}

function pushDividers(blocks: NewsletterBlock[], dividers: NewsletterLayoutDivider[], section: string, placement: "before" | "after") {
  for (const d of dividers) {
    if (d.sectionId === section && d.placement === placement) blocks.push(dividerToDecorativeBlock(d));
  }
}

function escapePlain(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function storyToBlock(story: StoryRecord): NewsletterStoryBlock {
  const images =
    Array.isArray(story.images) && story.images.length > 0
      ? story.images
      : story.imageUrl
        ? [story.imageUrl]
        : [];
  const snap: NewsletterStoryBlock["snapshot"] = {
    title: story.title,
    excerpt: story.excerpt,
    body: story.body,
    images,
    alt: story.title || "Maroma story",
    publishedAt: story.publishedAt,
    source: story.source,
    sourceUrl: story.sourceUrl,
    ctaLabel: story.ctaLabel || "Read more",
    ctaUrl: story.ctaUrl,
    slug: story.slug
  };
  if (story.imageFrame) snap.imageFrame = story.imageFrame;
  return {
    id: `blk-story-${story.id}`,
    kind: "story",
    storyId: story.id,
    snapshot: snap
  };
}

/**
 * One-time migration: legacy fixed layout + stories + layout dividers → ordered blocks.
 * Clears `newsletterLayoutDividers` (now represented as decorative-line blocks).
 */
export function buildMigratedNewsletterBlocks(state: StoriesState): NewsletterBlock[] {
  const blocks: NewsletterBlock[] = [];
  const dividers = state.newsletterLayoutDividers ?? [];

  pushDividers(blocks, dividers, "logo", "before");

  blocks.push({
    id: newId("img"),
    kind: "image",
    images: state.newsletterLogoUrl.trim() ? [state.newsletterLogoUrl.trim()] : [],
    alt: "Maroma",
    caption: "",
    transform: imageTransformToBlockTransform(state.newsletterImageTransforms.logo, {
      widthPercent: 40,
      borderRadius: state.newsletterImageTransforms.logo.borderRadius,
      marginTopRem: 0.4,
      marginBottomRem: 0.4
    }),
    captionStyle: { ...DEFAULT_BLOCK_TEXT_STYLE, fontSizeRem: 0.84, marginTopRem: 0.2, marginBottomRem: 0.2 },
    sync: { kind: "asset", slot: "logo" }
  });

  pushDividers(blocks, dividers, "logo", "after");
  pushDividers(blocks, dividers, "topImage", "before");

  blocks.push({
    id: newId("img"),
    kind: "image",
    images: state.newsletterTopImageUrl.trim() ? [state.newsletterTopImageUrl.trim()] : [],
    alt: "Newsletter banner",
    caption: "",
    transform: imageTransformToBlockTransform(state.newsletterImageTransforms.topImage, {
      widthPercent: 100,
      borderRadius: state.newsletterImageTransforms.topImage.borderRadius,
      marginTopRem: 0.5,
      marginBottomRem: 0.5
    }),
    captionStyle: { ...DEFAULT_BLOCK_TEXT_STYLE, fontSizeRem: 0.84, marginTopRem: 0.2, marginBottomRem: 0.2 },
    sync: { kind: "asset", slot: "topImage" }
  });

  pushDividers(blocks, dividers, "topImage", "after");

  blocks.push({ id: newId("div"), kind: "divider", marginTopRem: 0.8, marginBottomRem: 0.8 });

  pushDividers(blocks, dividers, "portraitHero", "before");

  blocks.push({
    id: newId("img"),
    kind: "image",
    images: state.newsletterHeroImageUrl.trim() ? [state.newsletterHeroImageUrl.trim()] : [],
    alt: "Hero",
    caption: "",
    transform: imageTransformToBlockTransform(state.newsletterImageTransforms.hero, {
      widthPercent: 100,
      borderRadius: state.newsletterImageTransforms.hero.borderRadius,
      marginTopRem: 0.4,
      marginBottomRem: 0.4
    }),
    captionStyle: { ...DEFAULT_BLOCK_TEXT_STYLE, fontSizeRem: 0.84, marginTopRem: 0.2, marginBottomRem: 0.2 },
    sync: { kind: "asset", slot: "hero" }
  });

  pushDividers(blocks, dividers, "portraitHero", "after");
  pushDividers(blocks, dividers, "issueHeading", "before");

  blocks.push({
    id: newId("h"),
    kind: "heading",
    level: 1,
    text: state.newsletterTitle.trim() || "Newsletter",
    style: elementStyleToBlockTextStyle(state.newsletterElementStyles.issueHeading),
    sync: { kind: "issueTitle" }
  });

  pushDividers(blocks, dividers, "issueHeading", "after");
  blocks.push({ id: newId("div"), kind: "divider", marginTopRem: 0.6, marginBottomRem: 1 });

  pushDividers(blocks, dividers, "mission", "before");

  blocks.push({
    id: newId("h"),
    kind: "heading",
    level: 2,
    text: state.newsletterMissionHeading.trim() || "Maroma mission",
    style: elementStyleToBlockTextStyle(state.newsletterElementStyles.missionHeading),
    sync: { kind: "missionHeading" }
  });

  const missionHtml = state.newsletterMissionHtml.trim();
  const missionPlain = state.newsletterMission.trim();
  const missionBodyHtml = missionHtml || (missionPlain ? `<p>${escapePlain(missionPlain)}</p>` : "<p></p>");
  blocks.push({
    id: newId("txt"),
    kind: "text",
    html: missionBodyHtml,
    style: elementStyleToBlockTextStyle(state.newsletterElementStyles.missionBody),
    sync: { kind: "missionBody" }
  });

  pushDividers(blocks, dividers, "mission", "after");
  blocks.push({ id: newId("div"), kind: "divider", marginTopRem: 1, marginBottomRem: 1 });

  pushDividers(blocks, dividers, "greeting", "before");

  blocks.push({
    id: newId("h"),
    kind: "heading",
    level: 2,
    text: state.newsletterGreetingHeading.trim() || "Greeting from CEO",
    style: elementStyleToBlockTextStyle(state.newsletterElementStyles.greetingHeading),
    sync: { kind: "greetingHeading" }
  });

  const greetHtml = state.newsletterWelcomeLauraHtml.trim();
  const greetPlain = state.newsletterWelcomeLaura.trim() || state.newsletterIntro.trim();
  const greetBody = greetHtml || (greetPlain ? `<p>${escapePlain(greetPlain)}</p>` : "<p></p>");
  blocks.push({
    id: newId("txt"),
    kind: "text",
    html: greetBody,
    style: elementStyleToBlockTextStyle(state.newsletterElementStyles.greetingBody),
    sync: { kind: "greetingBody" }
  });

  pushDividers(blocks, dividers, "greeting", "after");
  pushDividers(blocks, dividers, "stories", "before");

  for (const story of state.stories) {
    if (story.kind === "divider") {
      blocks.push({ id: newId("div"), kind: "divider", marginTopRem: 1.2, marginBottomRem: 1.2 });
      continue;
    }
    if (story.kind === "text") {
      blocks.push({
        id: newId("txt"),
        kind: "text",
        html: story.body || "<p></p>",
        style: { ...DEFAULT_BLOCK_TEXT_STYLE }
      });
      continue;
    }
    blocks.push(storyToBlock(story));
  }

  pushDividers(blocks, dividers, "stories", "after");

  return blocks;
}

/** Keep story blocks in sync with `stories[]` after imports / pour / edits. */
export function refreshStorySnapshotsInBlocks(state: StoriesState): StoriesState {
  if ((state.newsletterBlocksMigrationVersion ?? 0) < 1) return state;
  const blocks = state.newsletterBlocks ?? [];
  const storyById = new Map(state.stories.map((s) => [s.id, s]));
  const covered = new Set<string>();
  const nextBlocks: NewsletterBlock[] = [];
  for (const b of blocks) {
    if (b.kind !== "story") {
      nextBlocks.push(b);
      continue;
    }
    const live = storyById.get(b.storyId);
    if (!live || live.kind === "divider" || live.kind === "text") continue;
    covered.add(live.id);
    const rebuilt = storyToBlock(live);
    nextBlocks.push({
      ...rebuilt,
      snapshot: {
        ...rebuilt.snapshot,
        imageTransform: b.snapshot.imageTransform,
        imageFrame: b.snapshot.imageFrame ?? rebuilt.snapshot.imageFrame
      }
    });
  }
  const appended = state.stories
    .filter((s) => s.kind !== "divider" && s.kind !== "text" && !covered.has(s.id))
    .map((s) => storyToBlock(s));
  return { ...state, newsletterBlocks: [...nextBlocks, ...appended] };
}
