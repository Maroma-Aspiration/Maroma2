import { notFound } from "next/navigation";
import { CategoryHeroWithAdmin } from "../components/CategoryHeroWithAdmin";
import { ProductListingWithFilters } from "../components/ProductListingWithFilters";
import { resolveCategoryBanner } from "../../lib/category-banner-store";
import { categoryBySlug, catalogCategories } from "../../lib/catalog-categories";
import { hasDisplayImage } from "../../lib/product-image";
import { readMergedCatalog } from "../../lib/product-catalog-admin";
import type { ProductRecord } from "../../lib/product-types";

/** Category pages read JSON from disk via `product-db`; keep on Node (not Edge). */
export const runtime = "nodejs";

type CategoryPageProps = {
  params: {
    slug: string;
  };
};

const textMatch = (value: string, keywords: string[]): boolean => {
  const normalized = value.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
};

const belongsToCategory = (product: ProductRecord, keywords: string[]): boolean => {
  if (textMatch(product.name, keywords)) {
    return true;
  }
  if (product.categories.some((entry) => textMatch(entry, keywords))) {
    return true;
  }
  if (product.tags.some((entry) => textMatch(entry, keywords))) {
    return true;
  }
  return false;
};

export async function generateStaticParams() {
  return catalogCategories.map((category) => ({ slug: category.slug }));
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const category = categoryBySlug(params.slug);
  if (!category) {
    notFound();
  }

  const [{ products: merged }, resolvedBanner] = await Promise.all([
    readMergedCatalog(),
    resolveCategoryBanner(params.slug, category)
  ]);
  const items = merged
    .filter((product) => belongsToCategory(product, category.keywords) && hasDisplayImage(product))
    .slice(0, 280);

  const wideCover = resolvedBanner.imageUrl && category.bannerLayout === "wide-cover";
  const splitThumb = Boolean(resolvedBanner.imageUrl && !wideCover);

  return (
    <main className="category-page">
      <CategoryHeroWithAdmin
        slug={params.slug}
        categoryLabel={category.label}
        productCount={items.length}
        wideCover={Boolean(wideCover)}
        splitThumb={splitThumb}
        resolved={resolvedBanner}
        italicTagline={Boolean(category.heroTagline)}
      />

      <section className="product-listing-section" aria-label={`${category.label} products`}>
        <ProductListingWithFilters products={items} categorySlug={params.slug} />
      </section>
    </main>
  );
}
