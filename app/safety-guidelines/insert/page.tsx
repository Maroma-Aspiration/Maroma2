import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readSafetyGuidelines } from "../../../lib/safety-guidelines-store";
import { resolveSafetyLanguageFromRequest } from "../../../lib/safety-language-detect";
import SafetyInsertClient from "./insert-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Safety insert | Maroma",
  robots: { index: false, follow: false },
};

export default async function SafetyInsertPage({
  searchParams,
}: {
  searchParams?: { set?: string; lang?: string };
}) {
  const store = await readSafetyGuidelines();
  const set = store.sets.find((item) => item.id === (searchParams?.set ?? "").trim()) ?? store.sets[0];
  if (!set) notFound();
  return <SafetyInsertClient set={set} language={await resolveSafetyLanguageFromRequest(searchParams?.lang)} />;
}
