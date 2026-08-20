import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductPdpBuyRow } from "../../components/ProductPdpBuyRow";
import { ProductPdpGallery } from "../../components/ProductPdpGallery";
import { ProductReviews } from "../../components/ProductReviews";
import { ProductAdminToolbar } from "../../components/ProductAdminToolbar";
import { JsonLd } from "../../components/JsonLd";
import { CurrencyPrice } from "../../components/CurrencyPrice";
import { decodeBasicHtmlEntities } from "../../../lib/decode-html-entities";
import { derivePdpSections } from "../../../lib/pdp-sections";
import { deriveProductPdpCopy, stripIndiaOnlyFromProductName } from "../../../lib/product-sale-region";
import { getGalleryImageUrls } from "../../../lib/product-gallery";
import { readLiveStorefrontCatalog, readMergedCatalog } from "../../../lib/product-catalog-admin";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../lib/auth-session";
import { getDisplayImageUrl } from "../../../lib/product-image";
import { getSuggestedProducts } from "../../../lib/product-suggestions";
import { getAvailableStock } from "../../../lib/commerce-stock";
import { categoryBySlug } from "../../../lib/catalog-categories";
import { readGift3dAssetsStore, toPublicGift3dAssets } from "../../../lib/gift-3d-assets-store";
import { isGift3dPreviewProduct } from "../../../lib/gift-builder-catalog";
import {
  auditProductSeoFacts,
  breadcrumbJsonLd,
  buildPageMetadata,
  productJsonLd,
  resolvePrimaryCategorySlug,
  truncateMetaDescription,
} from "../../../lib/site-seo";
import type { ProductRecord } from "../../../lib/product-types";

export const runtime = "nodejs";

type Props = { params: { id: string }; searchParams?: { search?: string } };

async function canPreviewDraftProduct(): Promise<boolean> {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!secret || !token) return false;
  const session = await verifySessionPayload(token, secret);
  return session?.role === "admin";
}

async function readProductForRequest(productId: string) {
  const liveCatalog = await readLiveStorefrontCatalog();
  const liveProduct = liveCatalog.products.find((entry) => entry.id === productId);
  if (liveProduct) return { product: liveProduct, isDraftPreview: false };

  if (!(await canPreviewDraftProduct())) return { product: null, isDraftPreview: false };
  const mergedCatalog = await readMergedCatalog();
  return {
    product: mergedCatalog.products.find((entry) => entry.id === productId) ?? null,
    isDraftPreview: true,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { product, isDraftPreview } = await readProductForRequest(params.id);
  if (!product) {
    return { title: "Product not found | Maroma" };
  }
  const { displayName } = stripIndiaOnlyFromProductName(product.name);
  const description = truncateMetaDescription(
    decodeBasicHtmlEntities(product.shortDescription || product.description || displayName)
  );
  const image = getDisplayImageUrl(product) || getGalleryImageUrls(product)[0] || undefined;
  return buildPageMetadata({
    title: `${displayName} | Maroma`,
    description,
    path: `/product/${product.id}`,
    image,
    noIndex: isDraftPreview,
  });
}

function SuggestedCard({ product }: { product: ProductRecord }) {
  const imageSrc = getDisplayImageUrl(product);
  const { displayName } = stripIndiaOnlyFromProductName(product.name);
  return (
    <Link href={`/product/${product.id}`} className="product-pdp-suggestion-card">
      <div className="product-pdp-suggestion-media">
        {imageSrc ? <img src={imageSrc} alt={`${displayName} — Maroma`} /> : <span>No image</span>}
      </div>
      <div className="product-pdp-suggestion-copy">
        <p className="product-pdp-suggestion-name">{displayName}</p>
        <p className="product-pdp-suggestion-price"><CurrencyPrice raw={product.price} fallback="-" /></p>
      </div>
    </Link>
  );
}

export default async function ProductPage({ params, searchParams }: Props) {
  const [{ product, isDraftPreview }, { products: liveProducts }, isAdmin, stockQty, gift3dReady] = await Promise.all([
    readProductForRequest(params.id),
    readLiveStorefrontCatalog(),
    canPreviewDraftProduct(),
    getAvailableStock(params.id),
    readGift3dAssetsStore()
      .then((store) => Boolean(toPublicGift3dAssets(store)[params.id]?.glbUrl) || isGift3dPreviewProduct(params.id))
      .catch(() => isGift3dPreviewProduct(params.id)),
  ]);
  if (!product) {
    notFound();
  }

  const gallery = getGalleryImageUrls(product);
  const suggested = getSuggestedProducts(liveProducts, product, 8);
  const sections = derivePdpSections(product);
  const { displayName, subtitleText } = deriveProductPdpCopy(product.name, product.shortDescription);
  const keyIngredients = product.attributes["Key Ingredients"] ?? [];
  const searchQuery = searchParams?.search?.trim().slice(0, 160) ?? "";
  const seoAudit = auditProductSeoFacts(product);
  const categorySlug = resolvePrimaryCategorySlug(product);
  const category = categorySlug ? categoryBySlug(categorySlug) : undefined;
  const availability = stockQty > 0 ? "InStock" : "OutOfStock";

  const breadcrumbItems = [
    { name: "Home", path: "/" },
    ...(category ? [{ name: category.label, path: `/${category.slug}` }] : []),
    { name: displayName, path: `/product/${product.id}` },
  ];

  const factRows = seoAudit.facts.filter(
    (fact) => fact.label !== "Product" && fact.label !== "Ingredients (INCI)"
  );

  return (
    <main className="product-pdp-page">
      <JsonLd
        data={[
          productJsonLd(product, { availability }),
          breadcrumbJsonLd(breadcrumbItems),
        ]}
      />
      {/* Missing catalog fields for SEO (do not invent): see data-seo-missing */}
      <div hidden data-seo-missing={seoAudit.missing.join("|") || "none"} />
      {isAdmin ? <ProductAdminToolbar productId={product.id} productName={displayName} /> : null}
      <nav className="product-pdp-breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/">Home</Link>
          </li>
          {category ? (
            <li>
              <Link href={`/${category.slug}`}>{category.label}</Link>
            </li>
          ) : null}
          <li aria-current="page">{displayName}</li>
        </ol>
      </nav>
      {searchQuery ? (
        <Link
          href={`/?skipIntro=1&q=${encodeURIComponent(searchQuery)}#shop`}
          className="product-pdp-back-to-search"
        >
          <span aria-hidden="true">←</span> Back to search results
        </Link>
      ) : null}
      {isDraftPreview ? (
        <div className="product-pdp-draft-notice" role="status">
          Admin preview · This product is not yet published on the storefront.
        </div>
      ) : null}
      <div className="product-pdp-layout">
        <h1 className="product-pdp-title">{displayName}</h1>
        <ProductPdpGallery images={gallery} productName={displayName} ready3d={gift3dReady} />

        <div className="product-pdp-info">
          {subtitleText ? <p className="product-pdp-subtitle">{subtitleText}</p> : null}
          <p className="product-pdp-price"><CurrencyPrice raw={product.price} /></p>

          <ProductPdpBuyRow product={product} />

          <ProductReviews productId={product.id} />

          {factRows.length > 0 ? (
            <section className="product-pdp-facts" aria-labelledby="pdp-facts-heading">
              <h2 id="pdp-facts-heading" className="product-pdp-facts-title">
                Product details
              </h2>
              <dl className="product-pdp-facts-list">
                {factRows.map((fact) => (
                  <div key={fact.label} className="product-pdp-facts-row">
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

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
            <details className="product-pdp-accordion" open>
              <summary>Description</summary>
              <div className="product-pdp-accordion-body">{sections.description}</div>
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
            <details className="product-pdp-accordion">
              <summary>Ingredients (full INCI)</summary>
              <div className="product-pdp-accordion-body">{sections.ingredients}</div>
            </details>
            <details className="product-pdp-accordion">
              <summary>Benefits</summary>
              <div className="product-pdp-accordion-body">{sections.benefits}</div>
            </details>
            {sections.howToUse ? (
              <details className="product-pdp-accordion">
                <summary>How to use</summary>
                <div className="product-pdp-accordion-body">{sections.howToUse}</div>
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
