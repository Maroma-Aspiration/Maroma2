import { readLiveStorefrontCatalog } from "../../lib/product-catalog-admin";
import { filterProducts } from "../../lib/product-db";
import { readSiteContentFromDisk } from "../../lib/read-site-content";
import SearchPageClient from "./search-page-client";

export const dynamic = "force-dynamic";

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
