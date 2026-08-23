import { headers } from "next/headers";
import { readPersistedHeroVisualState } from "../lib/hero-media-layout-state";
import { readCategoryBannerStore } from "../lib/category-banner-store";
import { listLivePromoBanners } from "../lib/promo-store";
import { isMaromaMobileUserAgent } from "../lib/mobile-viewport";
import { readSiteContentFromDisk } from "../lib/read-site-content";
import HomePageClient from "./home-page-client";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams?: { skipIntro?: string; q?: string; promoPreview?: string };
}) {
  const ua = (await headers()).get("user-agent") ?? "";
  const initialViewportIsMobile = isMaromaMobileUserAgent(ua);
  const promoPreview = searchParams?.promoPreview === "1";
  const [initialHeroVisual, initialSiteContent, initialPromoBanners, initialCategoryBanners] = await Promise.all([
    readPersistedHeroVisualState(),
    readSiteContentFromDisk(),
    listLivePromoBanners(),
    readCategoryBannerStore(),
  ]);
  return (
    <HomePageClient
      initialHeroVisual={initialHeroVisual}
      initialSiteContent={initialSiteContent}
      initialPromoBanners={initialPromoBanners}
      initialCategoryBanners={initialCategoryBanners}
      initialViewportIsMobile={promoPreview ? false : initialViewportIsMobile}
      initialSkipIntro={promoPreview || searchParams?.skipIntro === "1" || Boolean(searchParams?.q?.trim())}
      initialPromoPreview={promoPreview}
      initialProductSearch={searchParams?.q ?? ""}
    />
  );
}
