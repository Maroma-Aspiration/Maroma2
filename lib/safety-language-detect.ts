import { headers } from "next/headers";
import {
  isSafetyLanguage,
  SAFETY_DEFAULT_LANGUAGE,
  type SafetyLanguage,
} from "./safety-guidelines-types";

/**
 * ISO country codes that map cleanly onto one safety language.
 * Ambiguous countries (Belgium, Switzerland, Luxembourg, Canada, India) are
 * left out so region or the phone language can decide.
 */
const COUNTRY_TO_LANGUAGE: Record<string, SafetyLanguage> = {
  FR: "fr",
  MC: "fr",
  GF: "fr",
  PF: "fr",
  NC: "fr",
  GP: "fr",
  MQ: "fr",
  RE: "fr",
  YT: "fr",
  BL: "fr",
  MF: "fr",
  PM: "fr",
  WF: "fr",
  IT: "it",
  SM: "it",
  VA: "it",
  DE: "de",
  AT: "de",
  LI: "de",
  ES: "es",
  MX: "es",
  AR: "es",
  CL: "es",
  CO: "es",
  PE: "es",
  VE: "es",
  EC: "es",
  GT: "es",
  CU: "es",
  DO: "es",
  HN: "es",
  PY: "es",
  BO: "es",
  SV: "es",
  NI: "es",
  CR: "es",
  PA: "es",
  UY: "es",
  PR: "es",
  GQ: "es",
};

/** Indian states: Tamil Nadu and Puducherry Tamil, West Bengal and Tripura Bengali, Hindi belt Hindi. */
const INDIA_REGION_TO_LANGUAGE: Record<string, SafetyLanguage> = {
  TN: "ta",
  PY: "ta",
  WB: "bn",
  TR: "bn",
  DL: "hi",
  UP: "hi",
  MP: "hi",
  RJ: "hi",
  HR: "hi",
  UK: "hi",
  UA: "hi",
  CG: "hi",
  JH: "hi",
  HP: "hi",
  BR: "hi",
  CH: "hi",
};

function languageFromAcceptHeader(header: string | null | undefined): SafetyLanguage | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const code = part.split(";")[0]?.trim().toLowerCase().slice(0, 2);
    if (isSafetyLanguage(code)) return code;
  }
  return null;
}

function languageFromCountry(country: string | null | undefined): SafetyLanguage | null {
  if (!country) return null;
  return COUNTRY_TO_LANGUAGE[country.trim().toUpperCase()] ?? null;
}

function languageFromIndiaRegion(region: string | null | undefined): SafetyLanguage | null {
  if (!region) return null;
  const code = region.trim().toUpperCase().replace(/^IN-/, "");
  return INDIA_REGION_TO_LANGUAGE[code] ?? null;
}

/**
 * Language for a scanned QR. An explicit ?lang= still wins (for testing and the
 * language tabs). Otherwise the scan country or Indian state, then the phone
 * language, then English.
 */
export function resolveSafetyLanguage(input: {
  explicit?: unknown;
  country?: string | null;
  region?: string | null;
  acceptLanguage?: string | null;
}): SafetyLanguage {
  if (typeof input.explicit === "string") {
    const code = input.explicit.trim().toLowerCase().slice(0, 2);
    if (isSafetyLanguage(code)) return code;
  }
  const country = (input.country ?? "").trim().toUpperCase();
  if (country === "IN") {
    return (
      languageFromIndiaRegion(input.region) ??
      languageFromAcceptHeader(input.acceptLanguage) ??
      SAFETY_DEFAULT_LANGUAGE
    );
  }
  return (
    languageFromCountry(input.country) ??
    languageFromAcceptHeader(input.acceptLanguage) ??
    SAFETY_DEFAULT_LANGUAGE
  );
}

export async function resolveSafetyLanguageFromRequest(explicit?: unknown): Promise<SafetyLanguage> {
  const requestHeaders = await headers();
  return resolveSafetyLanguage({
    explicit,
    country: requestHeaders.get("x-vercel-ip-country"),
    region: requestHeaders.get("x-vercel-ip-country-region"),
    acceptLanguage: requestHeaders.get("accept-language"),
  });
}
