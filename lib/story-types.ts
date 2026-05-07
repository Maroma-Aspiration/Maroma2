export type StorySource = "manual" | "instagram" | "facebook" | "web" | "rss";

export type StoryRecord = {
  id: string;
  kind?: "story" | "divider";
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  imageUrl: string;
  sourceUrl: string;
  source: StorySource;
  ctaLabel: string;
  ctaUrl: string;
  publishedAt: string;
  updatedAt: string;
  featured?: boolean;
};

export type StoriesState = {
  stories: StoryRecord[];
  socialSources: {
    instagram: string;
    facebook: string;
  };
  /** RSS / Atom feed URLs (e.g. third-party aggregator). Use only where terms allow. */
  rssFeedUrls: string[];
  /** Issue headline prefix (renders as `{title} | {month year}`). */
  newsletterTitle: string;
  /** Legacy fallback welcome line if `newsletterWelcomeLaura` is empty. */
  newsletterIntro: string;
  /** Optional decorative image rendered above the logo. */
  newsletterTopImageUrl: string;
  /** Header logo — empty uses `/maroma-logo.png`. */
  newsletterLogoUrl: string;
  /** Circular portrait (e.g. Laura); optional. */
  newsletterPortraitUrl: string;
  /** Large hero image below the portrait; optional. */
  newsletterHeroImageUrl: string;
  /** Mission statement block (below hero). */
  newsletterMission: string;
  /** Rich formatted mission statement HTML, used when present. */
  newsletterMissionHtml: string;
  /** Mission section heading label. */
  newsletterMissionHeading: string;
  /** Welcome message signed / from Laura (below issue title). */
  newsletterWelcomeLaura: string;
  /** Rich formatted CEO greeting HTML, used when present. */
  newsletterWelcomeLauraHtml: string;
  /** Greeting section heading label. */
  newsletterGreetingHeading: string;
  /** Newsletter text alignment preference. */
  newsletterTextAlign: "left" | "center";
  /** Newsletter shell background color (CSS color string, e.g. "#10151c"). */
  newsletterBackgroundColor: string;
  /** Section heading size in rem. */
  newsletterSectionHeadingSizeRem: number;
  /** Issue heading size in rem. */
  newsletterIssueHeadingSizeRem: number;
  /** Body copy size in rem. */
  newsletterBodyFontSizeRem: number;
  /** Per-element style controls for newsletter. */
  newsletterElementStyles: Record<string, NewsletterElementStyle>;
  /** Per-image crop/position controls for newsletter assets. */
  newsletterImageTransforms: NewsletterImageTransforms;
};

export const STORIES_STORAGE_KEY = "maroma-stories-state";

export type NewsletterElementStyle = {
  fontFamily: string;
  fontSizeRem: number;
  textAlign: "left" | "center";
  fontWeight: number;
  isQuoteBox: boolean;
  quoteBoxColor: string;
  /** Optional text color (CSS color string). Empty falls back to inherited theme color. */
  color: string;
};

export type NewsletterImageTransform = {
  x: number;
  y: number;
  zoom: number;
  /** Corner radius in pixels (>=0). Defaults vary per image type. */
  borderRadius: number;
};

export type NewsletterImageTransforms = {
  topImage: NewsletterImageTransform;
  logo: NewsletterImageTransform;
  portrait: NewsletterImageTransform;
  hero: NewsletterImageTransform;
};
