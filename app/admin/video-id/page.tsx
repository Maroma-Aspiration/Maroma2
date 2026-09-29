import { readMergedCatalog } from "../../../lib/product-catalog-admin";
import VideoIdClient from "./video-id-client";

export const dynamic = "force-dynamic";

export default async function VideoIdPage() {
  const { products } = await readMergedCatalog();
  return <VideoIdClient products={products.map((product) => ({
    id: product.id,
    name: product.name,
    searchText: [product.name, product.sku, product.brand, product.shortDescription, product.description, ...product.categories, ...product.tags].join(" "),
  }))} />;
}
