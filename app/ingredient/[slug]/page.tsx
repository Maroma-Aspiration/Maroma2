import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "../../components/JsonLd";
import { StorefrontProductCard } from "../../components/StorefrontProductCard";
import { readLiveStorefrontCatalog } from "../../../lib/product-catalog-admin";
import {
  getIngredientPage,
  listIngredientPages,
  productsForIngredient,
} from "../../../lib/ingredient-pages";
import { breadcrumbJsonLd, buildPageMetadata } from "../../../lib/site-seo";
import "../ingredient-page.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: { slug: string } };

export function generateStaticParams() {
  return listIngredientPages().map((item) => ({ slug: item.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const page = getIngredientPage(params.slug);
  return buildPageMetadata({
    title: `${page.name} | Maroma ingredients`,
    description: page.description,
    path: `/ingredient/${page.slug}`,
    image: page.imageUrl || undefined,
  });
}

export default async function IngredientPage({ params }: Props) {
  const page = getIngredientPage(params.slug);
  const catalog = await readLiveStorefrontCatalog();
  const related = productsForIngredient(catalog.products, page);
  return (
    <main className="ingredient-page">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Ingredients", path: "/ingredient" },
          { name: page.name, path: `/ingredient/${page.slug}` },
        ])}
      />
      <div className="ingredient-page-wrap">
        <Link href="/ingredient" className="ingredient-page-back">
          All ingredients
        </Link>
        <p className="ingredient-page-kicker">Key ingredient</p>
        <h1 className="ingredient-page-title">{page.name}</h1>
        <div className="ingredient-page-hero">
          <div className="ingredient-page-image">
            {page.imageUrl ? <img src={page.imageUrl} alt={page.name} /> : <span>Image to be added</span>}
          </div>
          <div className="ingredient-page-copy">
            {page.inci ? <p className="ingredient-page-inci"><strong>INCI</strong> {page.inci}</p> : null}
            <p>{page.description}</p>
            {page.scentProfile ? <p className="ingredient-page-scent"><strong>Scent profile</strong> {page.scentProfile}</p> : null}
            {page.extraNotes ? <p>{page.extraNotes}</p> : null}
            <section className="ingredient-page-benefits" aria-labelledby="ingredient-benefits">
              <h2 id="ingredient-benefits">Benefits</h2>
              <ul>
                {page.benefits.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <Link href={page.rangeHref} className="ingredient-page-range">
              {page.rangeLabel}
            </Link>
          </div>
        </div>
        {related.length ? (
          <section className="ingredient-page-related" aria-labelledby="ingredient-related">
            <h2 id="ingredient-related">Used in these products</h2>
            <div className="ingredient-page-related-grid">
              {related.map((product) => (
                <div key={product.id} className="product-card-wrap">
                  <StorefrontProductCard product={product} />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
