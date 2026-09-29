import { readLiveStorefrontCatalog } from "../../lib/product-catalog-admin";
import { filterProducts } from "../../lib/product-db";
import { readSiteContentFromDisk } from "../../lib/read-site-content";
import SearchPageClient from "./search-page-client";
import { buildPageMetadata } from "../../lib/site-seo";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Search Maroma products",
  description: "Search Maroma natural fragrance, botanical body care, incense and home products.",
  path: "/search",
  noIndex: true,
});

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; ritual?: string };
}) {
  const query = searchParams.q || "";
  const ritualName = searchParams.ritual || "";
  
  const [{ products: allProducts }, siteContent] = await Promise.all([
    readLiveStorefrontCatalog(),
    readSiteContentFromDisk(),
  ]);
  const filteredProducts = filterProducts(allProducts, { 
    q: query,
    excludeGiftSets: !!ritualName 
  });

  return (
    <SearchPageClient 
      query={query} 
      ritualName={ritualName}
      products={filteredProducts} 
      initialSiteContent={siteContent} 
    />
  );
}
