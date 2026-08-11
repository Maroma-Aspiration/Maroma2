import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductPdpBuyRow } from "../../components/ProductPdpBuyRow";
import { ProductPdpGallery } from "../../components/ProductPdpGallery";
import { decodeBasicHtmlEntities } from "../../../lib/decode-html-entities";
import { derivePdpSections } from "../../../lib/pdp-sections";
import { deriveProductPdpCopy, stripIndiaOnlyFromProductName } from "../../../lib/product-sale-region";
import { formatInrPrice } from "../../../lib/format-price";
import { getGalleryImageUrls } from "../../../lib/product-gallery";
import { readMergedCatalog } from "../../../lib/product-catalog-admin";
import { getDisplayImageUrl } from "../../../lib/product-image";
import { getSuggestedProducts } from "../../../lib/product-suggestions";
import type { ProductRecord } from "../../../lib/product-types";

export const runtime = "nodejs";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { products: merged } = await readMergedCatalog();
  const product = merged.find((entry) => entry.id === params.id);
  if (!product) {
    return { title: "Product" };
  }
  const { displayName } = stripIndiaOnlyFromProductName(product.name);
  return {
    title: `${displayName} · Maroma`,
    description: decodeBasicHtmlEntities(product.shortDescription).slice(0, 160)
  };
}

function SuggestedCard({ product }: { product: ProductRecord }) {
  const imageSrc = getDisplayImageUrl(product);
  const priceLabel = formatInrPrice(product.price) ?? "-";
  const { displayName } = stripIndiaOnlyFromProductName(product.name);
  return (
    <Link href={`/product/${product.id}`} className="product-pdp-suggestion-card">
      <div className="product-pdp-suggestion-media">
        {imageSrc ? <img src={imageSrc} alt="" /> : <span>No image</span>}
      </div>
      <div className="product-pdp-suggestion-copy">
        <p className="product-pdp-suggestion-name">{displayName}</p>
        <p className="product-pdp-suggestion-price">{priceLabel}</p>
      </div>
    </Link>
  );
}

export default async function ProductPage({ params }: Props) {
  const { products: merged } = await readMergedCatalog();
  const product = merged.find((entry) => entry.id === params.id);
  if (!product) {
    notFound();
  }

  const gallery = getGalleryImageUrls(product);
  const suggested = getSuggestedProducts(merged, product, 8);
  const sections = derivePdpSections(product);
  const { displayName, subtitleText } = deriveProductPdpCopy(product.name, product.shortDescription);
  const priceLabel = formatInrPrice(product.price) ?? "Price on request";
  const keyIngredients = product.attributes["Key Ingredients"] ?? [];

  return (
    <main className="product-pdp-page">
      <div className="product-pdp-layout">
        <h1 className="product-pdp-title">{displayName}</h1>
        <ProductPdpGallery images={gallery} productName={displayName} />

        <div className="product-pdp-info">
          {subtitleText ? <p className="product-pdp-subtitle">{subtitleText}</p> : null}
          <p className="product-pdp-price">{priceLabel}</p>

          <ProductPdpBuyRow product={product} />

          {suggested.length > 0 ? (
            <section className="product-pdp-suggestions-inline" aria-labelledby="pdp-suggestions-inline">
              <h2 id="pdp-suggestions-inline" className="product-pdp-suggestions-inline-title">
                You may also like
              </h2>
              <div className="product-pdp-suggestions-track">
                {suggested.map((item) => (
                  <SuggestedCard key={item.id} product={item} />
                ))}
              </div>
            </section>
          ) : null}

          <ul className="product-pdp-service-list">
            <li>100% vegan formulations</li>
            <li>Free shipping in India on orders over ₹500</li>
            <li>Free 7-day return on eligible items</li>
          </ul>

          <div className="product-pdp-accordions">
            <details className="product-pdp-accordion">
              <summary>Description</summary>
              <div className="product-pdp-accordion-body">{sections.description}</div>
            </details>
            <details className="product-pdp-accordion">
              <summary>Ingredients</summary>
              <div className="product-pdp-accordion-body">{sections.ingredients}</div>
            </details>
            <details className="product-pdp-accordion">
              <summary>Benefits</summary>
              <div className="product-pdp-accordion-body">{sections.benefits}</div>
            </details>
            {keyIngredients.length > 0 ? (
              <details className="product-pdp-accordion">
                <summary>Key ingredients</summary>
                <ul className="product-pdp-key-ingredients">
                  {keyIngredients.map((item, index) => (
                    <li key={`${item}-${index}`}>{decodeBasicHtmlEntities(item)}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </div>
      </div>

      <footer className="product-pdp-trust" aria-label="Certifications">
        <div className="product-pdp-trust-badge">Fair trade ethos</div>
        <div className="product-pdp-trust-badge">Hand crafted in Auroville</div>
        <div className="product-pdp-trust-badge">Cruelty free</div>
        <div className="product-pdp-trust-badge">Conscious ingredients</div>
        <div className="product-pdp-trust-badge">Earth friendly</div>
      </footer>
    </main>
  );
}
