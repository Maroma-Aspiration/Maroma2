export const defaultWideBannerLayout = {
  objectPosition: "82% 38%",
  minHeight: "clamp(220px, 34vw, 400px)",
  maxHeight: "min(48vh, 440px)"
} as const;

/** Default crop for homepage collection tiles (4:5), separate from wide hero banners. */
export const defaultCollectionCardObjectPosition = "50% 42%";

export const defaultCollectionCardPositions: Record<string, string> = {
  "face-care": "76% 40%",
  "body-care": "64% 55%",
  "hair-care": "70% 42%",
  baby: "50% 35%",
  man: "58% 45%",
  perfumes: "72% 38%",
  "home-essentials": "68% 50%",
  colibri: "50% 45%",
  gifting: "55% 48%",
};
