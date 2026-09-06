import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readPublishedQrProductPage } from "../../../lib/qr-product-page-store";
import { readLiveStorefrontCatalog } from "../../../lib/product-catalog-admin";
import { getDisplayImageUrl } from "../../../lib/product-image";
import { decodeBasicHtmlEntities } from "../../../lib/decode-html-entities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = await readPublishedQrProductPage(params.slug);
  return guide ? { title: `${guide.title} | Maroma`, description: guide.intro || `How to use ${guide.productName}` } : { title: "Guide not found | Maroma" };
}

export default async function CareGuidePage({ params }: Props) {
  const [guide, catalog] = await Promise.all([readPublishedQrProductPage(params.slug), readLiveStorefrontCatalog()]);
  if (!guide) notFound();
  const product = catalog.products.find((item) => item.id === guide.productId);
  const related = guide.relatedProductIds.map((id) => catalog.products.find((item) => item.id === id)).filter(Boolean);
  const heroImage = guide.imageUrl || (product ? getDisplayImageUrl(product) : "");
  return <main className="qr-guide-page">
    <section className="qr-guide-hero">
      <div className="qr-guide-hero-copy"><p className="qr-guide-kicker">Maroma product guide</p><h1>{guide.title}</h1>{guide.intro ? <p>{guide.intro}</p> : null}{product ? <Link href={`/product/${product.id}`} className="qr-guide-product-link">View product</Link> : null}</div>
      {heroImage ? <img className="qr-guide-hero-image" src={heroImage} alt="" /> : null}
    </section>
    <section className="qr-guide-content">
      {guide.videoUrl ? <video className="qr-guide-video" controls playsInline preload="metadata" poster={heroImage || undefined}><source src={guide.videoUrl} />Your browser does not support this video.</video> : null}
      <div className="qr-guide-main">
        <div><p className="qr-guide-kicker">A gentle ritual</p><h2>How to use</h2></div>
        <ol className="qr-guide-steps">{guide.instructions.map((item, index) => <li key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.heading}</h3><p>{item.body}</p></div></li>)}</ol>
      </div>
      {guide.safetyNotes.length ? <aside className="qr-guide-safety"><p className="qr-guide-kicker">Please take care</p><h2>Safety notes</h2><ul>{guide.safetyNotes.map((note) => <li key={note}>{note}</li>)}</ul></aside> : null}
      {related.length ? <section className="qr-guide-related"><div><p className="qr-guide-kicker">Continue your ritual</p><h2>If you like this product, you might also like</h2></div><div className="qr-guide-related-grid">{related.map((item) => item ? <Link key={item.id} href={`/product/${item.id}`} className="qr-guide-related-card">{getDisplayImageUrl(item) ? <img src={getDisplayImageUrl(item)} alt="" /> : <div /> }<h3>{decodeBasicHtmlEntities(item.name)}</h3><span>Discover product →</span></Link> : null)}</div></section> : null}
    </section>
  </main>;
}
