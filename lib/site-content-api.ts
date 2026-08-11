import { siteContent, type SiteContent } from "../app/content";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isSiteContent = (value: unknown): value is SiteContent => {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.brand !== "string" || !Array.isArray(value.nav)) {
    return false;
  }
  if (!isRecord(value.hero) || !isRecord(value.carousel) || !Array.isArray(value.highlights)) {
    return false;
  }
  if (!isRecord(value.hero.video)) {
    return false;
  }
  return (
    typeof value.hero.headline === "string" &&
    Array.isArray(value.carousel.slides) &&
    typeof value.hero.video.src === "string"
  );
};

export const parseSiteContent = (value: unknown): SiteContent | null => {
  if (!isSiteContent(value)) {
    return null;
  }
  return structuredClone(value);
};

export const mergeWithDefaults = (value: unknown): SiteContent => {
  const parsed = parseSiteContent(value);
  const base = parsed ? structuredClone(parsed) : structuredClone(siteContent);
  const storedSrc = base.hero.video.src?.trim() ?? "";
  const legacyDesktopSrc = "https://youtu.be/S_uYmuKyMRg";
  if (!storedSrc || storedSrc === legacyDesktopSrc) {
    base.hero.video.src = siteContent.hero.video.src;
    if (!base.hero.video.poster?.trim()) {
      base.hero.video.poster = siteContent.hero.video.poster;
    }
  }
  if (!base.hero.video.mobileSrc?.trim() && siteContent.hero.video.mobileSrc) {
    base.hero.video.mobileSrc = siteContent.hero.video.mobileSrc;
  }
  return base;
};
