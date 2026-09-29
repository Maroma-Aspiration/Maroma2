import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "../components/JsonLd";
import { listIngredientPages } from "../../lib/ingredient-pages";
import { breadcrumbJsonLd, buildPageMetadata } from "../../lib/site-seo";
import "./ingredient-page.css";

export const metadata: Metadata = buildPageMetadata({
  title: "Ingredients | Maroma",
  description:
    "The botanicals behind Maroma formulas: descriptions, benefits, and the products that use them.",
  path: "/ingredient",
});

export default function IngredientIndexPage() {
  const pages = listIngredientPages();
  return (
    <main className="ingredient-page">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Ingredients", path: "/ingredient" },
        ])}
      />
      <div className="ingredient-page-wrap">
        <p className="ingredient-page-kicker">Botanical library</p>
        <h1 className="ingredient-page-title">Ingredients</h1>
        <p className="ingredient-page-copy">
          Click any botanical for a short description, its benefits in Maroma formulas, and the products that use it.
        </p>
        <div className="ingredient-index-scroller">
        <div className="ingredient-index-grid">
          {pages.map((item) => (
            <Link key={item.slug} href={`/ingredient/${item.slug}`} className="ingredient-index-card">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" />
              ) : (
                <span className="ingredient-index-empty">{item.name.slice(0, 1)}</span>
              )}
              <strong>{item.name}</strong>
            </Link>
          ))}
        </div>
        </div>
      </div>
    </main>
  );
}
