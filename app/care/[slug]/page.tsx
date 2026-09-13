import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readPublishedQrProductPage } from "../../../lib/qr-product-page-store";
import { readLiveStorefrontCatalog } from "../../../lib/product-catalog-admin";
import { getDisplayImageUrl } from "../../../lib/product-image";
import { decodeBasicHtmlEntities } from "../../../lib/decode-html-entities";
import { readSafetySet } from "../../../lib/safety-guidelines-store";
import { resolveSafetyLanguageFromRequest } from "../../../lib/safety-language-detect";
import {
  pickSafetyHighlight,
  resolveSafetyTranslation,
  SAFETY_LANGUAGES,
  safetyLanguageLabel,
  safetySetIdForProductContext,
} from "../../../lib/safety-guidelines-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Props = { params: { slug: string }; searchParams?: { lang?: string } };

/** Guides used to store titles like "Product name · How to use"; the heading is now the product name alone. */
const GUIDE_TITLE_SUFFIX = /\s*[·•|-]\s*(how to use|how to wear|fragrance care|product guide)\s*$/i;

function guideDisplayTitle(title: string, productName: string): string {
  const trimmed = (title ?? "").trim();
  const stripped = trimmed.replace(GUIDE_TITLE_SUFFIX, "").trim();
  return stripped || productName.trim() || trimmed;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = await readPublishedQrProductPage(params.slug);
  if (!guide) return { title: "Guide not found | Maroma" };
  const heading = guideDisplayTitle(guide.title, guide.productName);
  return { title: `How to use ${heading} | Maroma`, description: guide.intro || `How to use ${guide.productName}` };
}

export default async function CareGuidePage({ params, searchParams }: Props) {
  const [guide, catalog] = await Promise.all([readPublishedQrProductPage(params.slug), readLiveStorefrontCatalog()]);
  if (!guide) notFound();
  const product = catalog.products.find((item) => item.id === guide.productId);
  const language = await resolveSafetyLanguageFromRequest(searchParams?.lang);
  const productContext = product ? [product.name, ...product.categories, ...product.tags].join(" ").toLowerCase() : "";
  // Guides written before safety sets existed still match their product family automatically.
  const safetySetId = guide.safetySetId ?? safetySetIdForProductContext(productContext);
  const safetySet = safetySetId && safetySetId !== "none" ? await readSafetySet(safetySetId) : null;
  const safety = safetySet ? resolveSafetyTranslation(safetySet, language) : null;
  const safetyHighlight = safety?.translation ? pickSafetyHighlight(safety.translation) : null;
  const safetyHref = safetySet
    ? `/safety-guidelines?lang=${safety?.language ?? language}#${safetySet.id}`
    : "/safety-guidelines";
  const related = guide.relatedProductIds.map((id) => catalog.products.find((item) => item.id === id)).filter(Boolean);
  const heroImage = guide.imageUrl || (product ? getDisplayImageUrl(product) : "");
  return <main className="qr-guide-page">
    <section className="qr-guide-hero">
      <div className="qr-guide-hero-copy"><p className="qr-guide-kicker">How to use our:</p><h1>{guideDisplayTitle(guide.title, guide.productName)}</h1>{guide.intro ? <p>{guide.intro}</p> : null}{product ? <Link href={`/product/${product.id}`} className="qr-guide-product-link">View product</Link> : null}
        <nav className="qr-guide-languages" aria-label="Choose a language">
          {SAFETY_LANGUAGES.map((option) => (
            <Link
              key={option.code}
              href={`/care/${guide.slug}?lang=${option.code}`}
              className={option.code === language ? "is-active" : undefined}
              aria-current={option.code === language ? "true" : undefined}
            >
              {option.label}
            </Link>
          ))}
        </nav>
      </div>
      {heroImage ? <img className="qr-guide-hero-image" src={heroImage} alt="" /> : null}
    </section>
    <section className="qr-guide-content">
      {guide.videoUrl ? <video className="qr-guide-video" controls playsInline preload="metadata" poster={heroImage || undefined}><source src={guide.videoUrl} />Your browser does not support this video.</video> : null}
      <div className="qr-guide-main">
        <div><p className="qr-guide-kicker">A gentle ritual</p><h2>How to use</h2></div>
        <ol className="qr-guide-steps">{guide.instructions.map((item, index) => <li key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.heading}</h3><p>{item.body}</p></div></li>)}</ol>
      </div>
      {guide.safetyNotes.length || safetySet ? <aside className="qr-guide-safety"><p className="qr-guide-kicker">Please take care</p><h2>Safety notes</h2>
        {guide.safetyNotes.length ? <ul>{guide.safetyNotes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
        {safetySet && safetyHighlight ? <div className="qr-guide-safety-full">
          <h3>{safety?.translation?.title || safetySet.label}</h3>
          <p>{safetyHighlight.body}</p>
          {safety?.isFallback ? <p className="qr-guide-safety-fallback">{`Shown in ${safetyLanguageLabel(safety.language)}. ${safetyLanguageLabel(language)} translation coming soon.`}</p> : null}
          <Link href={safetyHref} className="qr-guide-safety-link">Read the full safety guidelines</Link>
        </div> : null}
      </aside> : null}
      {related.length ? <section className="qr-guide-related"><div><p className="qr-guide-kicker">Continue your ritual</p><h2>If you like this product, you might also like</h2></div><div className="qr-guide-related-grid">{related.map((item) => item ? <Link key={item.id} href={`/product/${item.id}`} className="qr-guide-related-card">{getDisplayImageUrl(item) ? <img src={getDisplayImageUrl(item)} alt="" /> : <div /> }<h3>{decodeBasicHtmlEntities(item.name)}</h3><span>Discover product →</span></Link> : null)}</div></section> : null}
    </section>
  </main>;
}
