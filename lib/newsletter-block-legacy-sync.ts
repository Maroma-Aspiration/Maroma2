import type {
  NewsletterBlock,
  NewsletterBlockImageTransform,
  NewsletterBlockTextStyle,
  NewsletterElementStyle,
  NewsletterImageTransforms,
  StoriesState
} from "./story-types";

/** Map legacy element style offsets into block margin (rough rem). */
function offsetToMarginRem(offsetPx: number | undefined): number {
  if (typeof offsetPx !== "number" || !Number.isFinite(offsetPx)) return 0.6;
  return Math.min(4, Math.max(0, Math.abs(offsetPx) / 16));
}

export function elementStyleToBlockTextStyle(el: NewsletterElementStyle): NewsletterBlockTextStyle {
  return {
    fontFamily: el.fontFamily,
    fontSizeRem: el.fontSizeRem,
    fontWeight: el.fontWeight,
    color: el.color,
    textAlign: el.textAlign === "left" ? "left" : "center",
    italic: false,
    underline: false,
    lineHeight: 1.55,
    letterSpacingEm: 0,
    marginTopRem: offsetToMarginRem(el.offsetY),
    marginBottomRem: offsetToMarginRem(el.offsetY),
    maxWidthRem: 0
  };
}

export function imageTransformToBlockTransform(
  t: NewsletterImageTransforms["logo"],
  defaults: Partial<NewsletterBlockImageTransform> = {}
): NewsletterBlockImageTransform {
  return {
    x: t.x,
    y: t.y,
    zoom: t.zoom,
    borderRadius: t.borderRadius,
    zIndex: t.zIndex ?? 0,
    widthPercent: defaults.widthPercent ?? 100,
    aspectRatio: defaults.aspectRatio ?? "",
    objectFit: defaults.objectFit ?? "cover",
    maxFrameHeightPx: defaults.maxFrameHeightPx ?? 0,
    marginTopRem: defaults.marginTopRem ?? 0.6,
    marginBottomRem: defaults.marginBottomRem ?? 0.6
  };
}

export function blockTransformToImageTransform(t: NewsletterBlockImageTransform): NewsletterImageTransforms["logo"] {
  return {
    x: t.x,
    y: t.y,
    zoom: t.zoom,
    borderRadius: t.borderRadius,
    zIndex: t.zIndex ?? 0
  };
}

/** Push block fields into legacy state (for saves / API compatibility). */
export function applyBlockToLegacyState(prev: StoriesState, block: NewsletterBlock): StoriesState {
  if (!("sync" in block) || !block.sync) return prev;
  const s = block.sync;
  if (s.kind === "issueTitle" && block.kind === "heading") {
    return { ...prev, newsletterTitle: block.text };
  }
  if (s.kind === "missionHeading" && block.kind === "heading") {
    return { ...prev, newsletterMissionHeading: block.text };
  }
  if (s.kind === "greetingHeading" && block.kind === "heading") {
    return { ...prev, newsletterGreetingHeading: block.text };
  }
  if (s.kind === "missionBody" && block.kind === "text") {
    const text = block.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { ...prev, newsletterMissionHtml: block.html, newsletterMission: text };
  }
  if (s.kind === "greetingBody" && block.kind === "text") {
    const text = block.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { ...prev, newsletterWelcomeLauraHtml: block.html, newsletterWelcomeLaura: text };
  }
  if (s.kind === "asset" && block.kind === "image") {
    const url = block.images[0]?.trim() ?? "";
    const tr = blockTransformToImageTransform(block.transform);
    const key = s.slot;
    if (key === "topImage") {
      return {
        ...prev,
        newsletterTopImageUrl: url,
        newsletterImageTransforms: { ...prev.newsletterImageTransforms, topImage: tr }
      };
    }
    if (key === "logo") {
      return {
        ...prev,
        newsletterLogoUrl: url,
        newsletterImageTransforms: { ...prev.newsletterImageTransforms, logo: tr }
      };
    }
    if (key === "portrait") {
      return {
        ...prev,
        newsletterPortraitUrl: url,
        newsletterImageTransforms: { ...prev.newsletterImageTransforms, portrait: tr }
      };
    }
    if (key === "hero") {
      return {
        ...prev,
        newsletterHeroImageUrl: url,
        newsletterImageTransforms: { ...prev.newsletterImageTransforms, hero: tr }
      };
    }
  }
  return prev;
}

/** Apply all synced blocks to legacy fields (call before persisting). */
export function syncAllBlocksToLegacy(state: StoriesState): StoriesState {
  let next = state;
  for (const block of state.newsletterBlocks ?? []) {
    if (!("sync" in block) || !block.sync) continue;
    next = applyBlockToLegacyState(next, block);
  }
  return next;
}
