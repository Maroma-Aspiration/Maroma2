import type { Metadata } from "next";
import { categoryBySlug, isSuitableForCollection, productBelongsToCategory } from "../../lib/catalog-categories";
import { hasDisplayImage } from "../../lib/product-image";
import { readLiveStorefrontCatalog } from "../../lib/product-catalog-admin";
import type { ProductRecord } from "../../lib/product-types";
import { MaromaCurationsClient } from "./MaromaCurationsClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Maroma Curations | Personal recommendations",
  description: "A personal selection of Maroma products chosen around what matters to you."
};

type CurationsPageProps = {
  searchParams: {
    category?: string | string[];
    type?: string | string[];
    goal?: string | string[];
    routine?: string | string[];
    products?: string | string[];
    saved?: string | string[];
    name?: string | string[];
  };
};

const singleValue = (value?: string | string[]): string => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function CurationsPage({ searchParams }: CurationsPageProps) {
  const categorySlug = singleValue(searchParams.category) || "face-care";
  const category = categoryBySlug(categorySlug);
  const requestedIds = singleValue(searchParams.products).split(",").map((id) => id.trim()).filter(Boolean);
  const { products } = await readLiveStorefrontCatalog();
  const categoryProducts = products.filter((product) =>
    hasDisplayImage(product) &&
    (!category ||
      (productBelongsToCategory(product, category.keywords) &&
        isSuitableForCollection(product, category.slug)))
  );
  const requestedProducts = requestedIds
    .map((id) => products.find((product) => product.id === id && hasDisplayImage(product)))
    .filter((product): product is ProductRecord => Boolean(product));
  const recommendations = [...requestedProducts];

  for (const product of categoryProducts) {
    if (!recommendations.some((entry) => entry.id === product.id)) recommendations.push(product);
    if (recommendations.length === 4) break;
  }

  return (
    <MaromaCurationsClient
      products={recommendations.slice(0, 4)}
      categorySlug={categorySlug}
      categoryLabel={category?.label ?? "Maroma"}
      choices={{
        type: singleValue(searchParams.type),
        goal: singleValue(searchParams.goal),
        routine: singleValue(searchParams.routine)
      }}
      saved={singleValue(searchParams.saved) === "1"}
      customerName={singleValue(searchParams.name).trim().slice(0, 60)}
    />
  );
}
