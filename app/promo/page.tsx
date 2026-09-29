import type { Metadata } from "next";
import Link from "next/link";
import { catalogCategories } from "../../lib/catalog-categories";
import { listLivePromoBanners } from "../../lib/promo-store";
import { buildPageMetadata } from "../../lib/site-seo";
import { PromoBannerCard } from "../components/PromoBannerCard";
import "./promo-page.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Current offers | Maroma",
  description: "Live Maroma promotions, photographed with our own product and workshop imagery.",
  path: "/promo",
});

export default async function PromoPage() {
  const banners = await listLivePromoBanners();
  const collections = catalogCategories.filter((category) => category.bannerImage);

  return (
    <main className="promo-page">
      <div className="promo-page-wrap">
        <p className="promo-page-kicker">Maroma offers</p>
        <h1>Current promotions</h1>
        <p className="promo-page-lead">
          These pages use Maroma photography, product imagery, and copy written for the brand. When a promotion is live, it appears here first.
        </p>

        {banners.length ? (
          <div className="promo-page-banners">
            {banners.map((banner) => (
              <PromoBannerCard key={banner.id} banner={banner} />
            ))}
          </div>
        ) : (
          <p className="promo-page-empty">No promotion is live at the moment. Explore the collections below meanwhile.</p>
        )}

        <section className="promo-page-collections" aria-labelledby="promo-collections-heading">
          <h2 id="promo-collections-heading">Shop by collection</h2>
          <div className="promo-page-collection-grid">
            {collections.map((category) => (
              <Link key={category.slug} href={`/${category.slug}`} className="promo-page-collection-card">
                <img src={category.bannerImage} alt="" />
                <strong>{category.label}</strong>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
