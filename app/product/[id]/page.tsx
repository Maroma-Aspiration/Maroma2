import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductPdpTitle } from "../../components/ProductPdpTitle";
import { ProductPdpPinnedStage } from "./ProductPdpPinnedStage";
import { ProductPdpBuyRow } from "../../components/ProductPdpBuyRow";
import { StorefrontProductCard } from "../../components/StorefrontProductCard";
import { ProductPdpGallery } from "../../components/ProductPdpGallery";
import { ProductReviews } from "../../components/ProductReviews";
import { ProductAdminToolbar } from "../../components/ProductAdminToolbar";
import { ProductKeyIngredients, type KeyIngredientCard } from "../../components/ProductKeyIngredients";
import { JsonLd } from "../../components/JsonLd";
import { CurrencyPrice } from "../../components/CurrencyPrice";
import { CurrencySelector } from "../../components/CurrencySelector";
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
import { isGiftingProduct } from "../../../lib/product-gifting";
import {
  auditProductSeoFacts,
  breadcrumbJsonLd,
  buildPageMetadata,
  productJsonLd,
  resolvePrimaryCategorySlug,
  truncateMetaDescription,
} from "../../../lib/site-seo";
import type { ProductRecord } from "../../../lib/product-types";
import { productPriceState } from "../../../lib/product-pricing";
import { readSafetySet } from "../../../lib/safety-guidelines-store";
import { pickSafetyHighlight, resolveSafetyTranslation, safetySetIdForProductContext } from "../../../lib/safety-guidelines-types";
import {
  galleryItemsForProduct,
  readIngredientGalleryStore,
} from "../../../lib/product-ingredient-gallery-store";
import { normalizeKeyIngredientName, resolveKeyIngredientImage } from "../../../lib/key-ingredient-media";
import { getIngredientPage, ingredientSlugFromName } from "../../../lib/ingredient-pages";

export const runtime = "nodejs";

type Props = { params: { id: string }; searchParams?: { search?: string; curations?: string } };

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
  return <StorefrontProductCard product={product} compact />;
}

export default async function ProductPage({ params, searchParams }: Props) {
  const [{ product, isDraftPreview }, { products: liveProducts }, isAdmin, stockQty, gift3dReady, ingredientGallery] = await Promise.all([
    readProductForRequest(params.id),
    readLiveStorefrontCatalog(),
    canPreviewDraftProduct(),
    getAvailableStock(params.id),
    readGift3dAssetsStore()
      .then((store) => Boolean(toPublicGift3dAssets(store)[params.id]?.glbUrl) || isGift3dPreviewProduct(params.id))
      .catch(() => isGift3dPreviewProduct(params.id)),
    readIngredientGalleryStore(),
  ]);
  if (!product) {
    notFound();
  }

  const gallery = getGalleryImageUrls(product);
  const suggested = getSuggestedProducts(liveProducts, product, 8);
  const sections = derivePdpSections(product);
  const { displayName, subtitleText } = deriveProductPdpCopy(product.name, product.shortDescription);
  const keyIngredients = product.attributes["Key Ingredients"] ?? [];
  const storedIngredientItems = galleryItemsForProduct(ingredientGallery, product.id);
  const keyIngredientCards: KeyIngredientCard[] = [];
  const seenIngredientSlugs = new Set<string>();
  for (const raw of keyIngredients) {
    const name = decodeBasicHtmlEntities(raw).trim();
    if (!name || /^ingredient to be added$/i.test(name)) continue;
    const href = `/ingredient/${ingredientSlugFromName(name)}`;
    if (seenIngredientSlugs.has(href)) continue;
    seenIngredientSlugs.add(href);
    const stored = storedIngredientItems.find(
      (item) => normalizeKeyIngredientName(item.name) === normalizeKeyIngredientName(name)
    );
    const page = getIngredientPage(name);
    keyIngredientCards.push({
      name,
      imageUrl: stored?.imageUrl || resolveKeyIngredientImage(name) || page.imageUrl,
      href,
      inci: page.inci,
      description: page.description,
      benefits: page.benefits,
      scentProfile: page.scentProfile,
      extraNotes: page.extraNotes,
      rangeLabel: page.rangeLabel,
      rangeHref: page.rangeHref,
    });
  }
  const searchQuery = searchParams?.search?.trim().slice(0, 160) ?? "";
  const curationsRaw = searchParams?.curations?.trim() ?? "";
  const curationsHref = curationsRaw.startsWith("/curations") && !curationsRaw.startsWith("//")
    ? curationsRaw
    : "";
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

  // Incense and candles carry regulatory guidance, shared with the QR guides and the safety page.
  const safetySetId = safetySetIdForProductContext(
    [product.name, ...product.categories, ...product.tags].join(" ").toLowerCase()
  );
  const safetySet = safetySetId ? await readSafetySet(safetySetId) : null;
  const safetyHighlight = safetySet
    ? pickSafetyHighlight(resolveSafetyTranslation(safetySet, "en").translation ?? { title: "", sections: [] })
    : null;

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
      <ProductPdpPinnedStage />
      <div
        className="product-pdp-layout"
        data-review="Product details"
        data-review-id="pdp-layout"
        data-review-files="app/product/[id]/page.tsx,app/components/ProductPdpBuyRow.tsx,app/components/ProductPdpGallery.tsx"
      >
        <div className="product-pdp-left-column">
          <ProductPdpGallery images={gallery} videos={product.videos} productId={product.id} productName={displayName} ready3d={isGiftingProduct(product) && gift3dReady} />
        </div>

        <div className="product-pdp-details-column">
          <div className="product-pdp-details-chrome">
            {curationsHref ? (
              <Link href={curationsHref} className="product-pdp-back-to-search product-pdp-back-to-curations">
                <span aria-hidden="true">←</span> Back to Maroma Curations
              </Link>
            ) : null}
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
          </div>
          <ProductPdpTitle>{displayName}</ProductPdpTitle>
          <div className="product-pdp-info">
            {subtitleText ? <p className="product-pdp-subtitle">{subtitleText}</p> : null}
            <div className="product-pdp-price-row">
            {productPriceState(product).onSale ? (
              <p className="product-pdp-price is-on-sale"><s><CurrencyPrice raw={productPriceState(product).regular} /></s><span><CurrencyPrice raw={productPriceState(product).active} /></span></p>
            ) : <p className="product-pdp-price"><CurrencyPrice raw={product.price} /></p>}

              <CurrencySelector compact />
            </div>

            <ProductPdpBuyRow product={product} />

            <div className="product-pdp-accordions">
            <details className="product-pdp-accordion" open>
              <summary>Description</summary>
              <div className="product-pdp-accordion-body">{sections.description}</div>
            </details>
            <details className="product-pdp-accordion">
              <summary>Ingredients (full INCI)</summary>
              <div className="product-pdp-accordion-body">{sections.ingredients}</div>
            </details>
              <details className="product-pdp-accordion">
                <summary>Benefits</summary>
                <div className="product-pdp-accordion-body">
                  <ul className="product-pdp-benefits">
                    {sections.benefits.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </details>
              {keyIngredientCards.length > 0 ? (
              <details className="product-pdp-accordion">
                <summary>Key Ingredients</summary>
                <div className="product-pdp-accordion-body">
                  <ProductKeyIngredients items={keyIngredientCards} />
                </div>
              </details>
              ) : null}
              {sections.howToUse ? (
                <details className="product-pdp-accordion">
                  <summary>How to use</summary>
                  <div className="product-pdp-accordion-body">{sections.howToUse}</div>
                </details>
              ) : null}
              {safetySet && safetyHighlight ? (
                <details className="product-pdp-accordion">
                  <summary>Safety guidelines</summary>
                  <div className="product-pdp-accordion-body">
                    <p>{safetyHighlight.body}</p>
                    <Link href={`/safety-guidelines#${safetySet.id}`}>
                      Read the full safety guidelines
                    </Link>
                  </div>
                </details>
              ) : null}
            </div>

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
          </div>
        </div>
      </div>

      <footer className="product-pdp-trust" aria-label="Certifications">
        <div className="product-pdp-trust-badge">
          <span className="product-pdp-trust-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3v17M5 6h14M7 6l-3 5h6L7 6Zm10 0-3 5h6l-3-5ZM8 20h8" />
            </svg>
          </span>
          <span className="product-pdp-trust-label">Fair trade ethos</span>
        </div>
        <div className="product-pdp-trust-badge">
          <span className="product-pdp-trust-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M7.5 12V7.5a1.5 1.5 0 0 1 3 0V11m0-4.5a1.5 1.5 0 0 1 3 0V11m0-3a1.5 1.5 0 0 1 3 0v4m0-2a1.5 1.5 0 0 1 3 0v4.5c0 4-2.7 6.5-6.5 6.5h-1.2c-2.2 0-3.6-.8-4.9-2.5L4.7 15.7a1.5 1.5 0 0 1 2.2-2l2.1 1.8" />
              <path d="m18.5 3 .5 1.2 1.3.5-1.3.5-.5 1.3-.5-1.3-1.2-.5 1.2-.5.5-1.2Z" />
            </svg>
          </span>
          <span className="product-pdp-trust-label">Hand crafted in Auroville</span>
        </div>
        <div className="product-pdp-trust-badge">
          <span className="product-pdp-trust-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M9.2 8.5C7.2 6 7 2.5 8.8 2.2c1.7-.3 2.5 3.2 2.6 6.1m3.4.2c2-2.5 2.2-6 .4-6.3-1.7-.3-2.5 3.2-2.6 6.1" />
              <path d="M6.5 14.2c0-3.7 2.4-6 5.5-6s5.5 2.3 5.5 6-2.4 6.3-5.5 6.3-5.5-2.6-5.5-6.3Z" />
              <path d="M9.8 14h.1m4.2 0h.1M11 16.3h2l-1 1-1-1Z" />
            </svg>
          </span>
          <span className="product-pdp-trust-label">Cruelty free</span>
        </div>
        <div className="product-pdp-trust-badge">
          <span className="product-pdp-trust-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M19.8 4.2C13.6 4 8.6 6.5 7.2 10.4c-1.1 3.1.7 5.7 3.8 5.4 4-.3 7-4.8 8.8-11.6Z" />
              <path d="M4 20c2-4.4 5.2-7.6 10.2-10.2M6.7 14.9c-1.9-.2-3.2-1.2-3.7-3.1 2.2-.5 3.9-.2 5.1.8" />
            </svg>
          </span>
          <span className="product-pdp-trust-label">Conscious ingredients</span>
        </div>
        <div className="product-pdp-trust-badge">
          <span className="product-pdp-trust-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M3.8 12h16.4M12 3.5c2.2 2.3 3.3 5.1 3.3 8.5S14.2 18.2 12 20.5C9.8 18.2 8.7 15.4 8.7 12S9.8 5.8 12 3.5Z" />
              <path d="M16.5 7.2c1.4-1.3 2.7-1.6 4-1.1-.2 1.7-1.2 2.8-3.1 3.3" />
            </svg>
          </span>
          <span className="product-pdp-trust-label">Earth friendly</span>
        </div>
      </footer>
      <ProductReviews productId={product.id} productName={displayName} />
    </main>
  );
}
