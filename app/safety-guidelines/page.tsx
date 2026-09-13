import type { Metadata } from "next";
import { readSafetyGuidelines } from "../../lib/safety-guidelines-store";
import { resolveSafetyLanguageFromRequest } from "../../lib/safety-language-detect";
import SafetyGuidelinesClient from "./safety-guidelines-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Safety guidelines | Maroma",
  description:
    "How to use Maroma incense and candles safely: lighting, burning, ventilation, storage and disposal guidance in English, French, Italian, German and Spanish.",
  alternates: { canonical: "/safety-guidelines" },
};

export default async function SafetyGuidelinesPage({
  searchParams,
}: {
  searchParams?: { lang?: string; set?: string };
}) {
  const store = await readSafetyGuidelines();
  // Printed QR codes are language-neutral. The scan country (or ?lang=) picks the text.
  const language = await resolveSafetyLanguageFromRequest(searchParams?.lang);
  return <SafetyGuidelinesClient sets={store.sets} initialLanguage={language} />;
}
