import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryHeroWithAdmin } from "../components/CategoryHeroWithAdmin";
import { JsonLd } from "../components/JsonLd";
import { ProductListingWithFilters } from "../components/ProductListingWithFilters";
import { resolveCategoryBanner } from "../../lib/category-banner-store";
import {
  categoryBySlug,
  catalogCategories,
  isSuitableForCollection,
  productBelongsToCategory,
} from "../../lib/catalog-categories";
import { hasDisplayImage } from "../../lib/product-image";
import { readLiveStorefrontCatalog } from "../../lib/product-catalog-admin";
import {
  breadcrumbJsonLd,
  buildPageMetadata,
  collectionPageJsonLd,
  relatedCategoryLinks,
} from "../../lib/site-seo";

/** Category pages read JSON from disk via `product-db`; keep on Node (not Edge). */
export const runtime = "nodejs";
// Banner overrides are managed live by admins. Do not serve a build-time copy
// after an editor refresh, or the client will reset to the old banner image.
export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: {
    slug: string;
  };
};

export async function generateStaticParams() {
  return catalogCategories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const category = categoryBySlug(params.slug);
  if (!category) {
    return { title: "Collection | Maroma" };
  }
  return buildPageMetadata({
    title: `${category.label} | Maroma`,
    description: category.description,
    path: `/${category.slug}`,
    image: category.bannerImage,
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const category = categoryBySlug(params.slug);
  if (!category) {
    notFound();
  }

  const [{ products: merged }, resolvedBanner] = await Promise.all([
    readLiveStorefrontCatalog(),
    resolveCategoryBanner(params.slug, category)
  ]);
  const items = merged
    .filter((product) =>
      productBelongsToCategory(product, category.keywords) &&
      isSuitableForCollection(product, params.slug) &&
      hasDisplayImage(product)
    )
    .slice(0, 280);

  const wideCover = resolvedBanner.imageUrl && category.bannerLayout === "wide-cover";
  const splitThumb = Boolean(resolvedBanner.imageUrl && !wideCover);
  const related = relatedCategoryLinks(params.slug);
  const intro = category.seoIntro || category.description;

  return (
    <main className="category-page">
      <JsonLd
        data={[
          collectionPageJsonLd({
            name: `${category.label} | Maroma`,
            description: category.description,
            path: `/${category.slug}`,
            productCount: items.length,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: category.label, path: `/${category.slug}` },
          ]),
        ]}
      />
      <CategoryHeroWithAdmin
        slug={params.slug}
        categoryLabel={category.label}
        productCount={items.length}
        wideCover={Boolean(wideCover)}
        splitThumb={splitThumb}
        resolved={resolvedBanner}
        italicTagline={Boolean(category.heroTagline)}
      />

      {category.showSeoIntro !== false ? (
        <section className="category-seo-intro" aria-label={`${category.label} overview`}>
          <p>{intro}</p>
          {related.length > 0 ? (
            <nav className="category-related-nav" aria-label="Related collections">
              <span className="category-related-label">Explore also</span>
              <ul>
                {related.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </section>
      ) : null}

      <section
        className="product-listing-section"
        aria-label={`${category.label} products`}
        data-review="Category product listing"
        data-review-id="category-listing"
        data-review-files="app/[slug]/page.tsx,app/components/ProductListingWithFilters.tsx"
      >
        <ProductListingWithFilters products={items} categorySlug={params.slug} />
      </section>
    </main>
  );
}
