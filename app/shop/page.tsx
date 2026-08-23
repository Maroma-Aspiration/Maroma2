import { ProductListingWithFilters } from "../components/ProductListingWithFilters";
import { JsonLd } from "../components/JsonLd";
import { readLiveStorefrontCatalog } from "../../lib/product-catalog-admin";
import { hasDisplayImage } from "../../lib/product-image";
import { breadcrumbJsonLd, buildPageMetadata, collectionPageJsonLd } from "../../lib/site-seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Shop | Maroma",
  description:
    "Browse the full Maroma shop — natural face care, body care, hair care, perfumes, home essentials, and gifts handmade in Auroville, India.",
  path: "/shop",
});

export default async function ShopPage() {
  const { products: merged } = await readLiveStorefrontCatalog();
  const items = merged.filter((product) => hasDisplayImage(product));

  return (
    <main className="category-page shop-page">
      <JsonLd
        data={[
          collectionPageJsonLd({
            name: "Shop | Maroma",
            description: "Browse Maroma natural products handmade in Auroville, India.",
            path: "/shop",
            productCount: items.length,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Shop", path: "/shop" },
          ]),
        ]}
      />

      <section
        className="category-seo-intro shop-page-intro"
        aria-label="Shop overview"
        data-review="Shop intro"
        data-review-id="shop-intro"
        data-review-files="app/shop/page.tsx"
      >
        <h1>Shop</h1>
        <p>
          Explore {items.length.toLocaleString()} Maroma products — botanical skincare, hair care,
          perfumes, home essentials, and gifts from Auroville.
        </p>
      </section>

      <section
        className="product-listing-section"
        aria-label="All products"
        data-review="Shop product listing"
        data-review-id="shop-listing"
        data-review-files="app/shop/page.tsx,app/components/ProductListingWithFilters.tsx"
      >
        <ProductListingWithFilters products={items} categorySlug="shop" />
      </section>
    </main>
  );
}
