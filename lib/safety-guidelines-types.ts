export const SAFETY_LANGUAGES = [
  { code: "ta", label: "தமிழ்" },
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
] as const;

export type SafetyLanguage = (typeof SAFETY_LANGUAGES)[number]["code"];

export const SAFETY_DEFAULT_LANGUAGE: SafetyLanguage = "en";

/** A block of guidance: a paragraph, a list, or both. */
export type SafetySection = {
  heading: string;
  body: string;
  items: string[];
};

export type SafetyTranslation = {
  title: string;
  sections: SafetySection[];
};

/**
 * One product family's guidance, e.g. incense or candles. Translations are partial because the
 * candle text exists in English only; the page falls back to English and says so.
 */
export type SafetySet = {
  id: string;
  /** Shown in menus and as the section heading on the guidelines page. */
  label: string;
  /** Short line under the heading, English only (editorial, not regulatory). */
  summary: string;
  translations: Partial<Record<SafetyLanguage, SafetyTranslation>>;
};

export type SafetyGuidelinesStore = {
  sets: SafetySet[];
  updatedAt: string;
};

const CAUTION_HEADING = /caution|attention|attenzione|achtung|precauci|avvertenz|warning|எச்சரிக்கை|सावधानी|चेतावनी|সতর্কতা/i;

/** The one paragraph worth repeating on a product guide: the caution, in whichever language. */
export function pickSafetyHighlight(translation: SafetyTranslation): SafetySection | null {
  const withBody = translation.sections.filter((section) => section.body);
  return withBody.find((section) => CAUTION_HEADING.test(section.heading)) ?? withBody[0] ?? null;
}

/** Picks the guidance set that matches a product, used when generating QR guides. */
export function safetySetIdForProductContext(context: string): string {
  if (/incense|cone|dhoop|smudge|agarbatti/.test(context)) return "incense";
  if (/candle|votive|pillar|tealight|t-light/.test(context)) return "candles";
  return "";
}

export function isSafetyLanguage(value: unknown): value is SafetyLanguage {
  return SAFETY_LANGUAGES.some((item) => item.code === value);
}

export function safetyLanguageLabel(code: SafetyLanguage): string {
  return SAFETY_LANGUAGES.find((item) => item.code === code)?.label ?? code;
}

/** Falls back to English when a set has no translation for the requested language. */
export function resolveSafetyTranslation(
  set: SafetySet,
  language: SafetyLanguage
): { translation: SafetyTranslation | null; language: SafetyLanguage; isFallback: boolean } {
  const requested = set.translations[language];
  if (requested) return { translation: requested, language, isFallback: false };
  const english = set.translations[SAFETY_DEFAULT_LANGUAGE];
  return {
    translation: english ?? null,
    language: SAFETY_DEFAULT_LANGUAGE,
    isFallback: Boolean(english) && language !== SAFETY_DEFAULT_LANGUAGE,
  };
}
