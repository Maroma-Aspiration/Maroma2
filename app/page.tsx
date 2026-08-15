import { headers } from "next/headers";
import { readPersistedHeroVisualState } from "../lib/hero-media-layout-state";
import { isMaromaMobileUserAgent } from "../lib/mobile-viewport";
import { readSiteContentFromDisk } from "../lib/read-site-content";
import HomePageClient from "./home-page-client";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams?: { skipIntro?: string; q?: string };
}) {
  const ua = (await headers()).get("user-agent") ?? "";
  const initialViewportIsMobile = isMaromaMobileUserAgent(ua);
  const [initialHeroVisual, initialSiteContent] = await Promise.all([
    readPersistedHeroVisualState(),
    readSiteContentFromDisk()
  ]);
  return (
    <HomePageClient
      initialHeroVisual={initialHeroVisual}
      initialSiteContent={initialSiteContent}
      initialViewportIsMobile={initialViewportIsMobile}
      initialSkipIntro={searchParams?.skipIntro === "1"}
      initialProductSearch={searchParams?.q ?? ""}
    />
  );
}
