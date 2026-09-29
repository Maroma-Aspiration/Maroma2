import { readLiveStorefrontCatalog } from "../../lib/product-catalog-admin";
import { parseInrPriceNumber } from "../../lib/format-price";
import { decodeBasicHtmlEntities } from "../../lib/decode-html-entities";
import { getDisplayImageUrl } from "../../lib/product-image";
import { stripIndiaOnlyFromProductName } from "../../lib/product-sale-region";
import { absoluteUrl, SITE_URL } from "../../lib/site-seo";
import { FLAT_SHIPPING_INR } from "../../lib/commerce-config";
import type { ProductRecord } from "../../lib/product-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clean(value: string): string {
  return decodeBasicHtmlEntities(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstAttribute(product: ProductRecord, keys: string[]): string {
  for (const key of keys) {
    const value = product.attributes[key]?.find((entry) => entry.trim());
    if (value) return clean(value);
  }
  return "";
}

function itemXml(product: ProductRecord): string | null {
  const price = parseInrPriceNumber(product.price);
  const image = getDisplayImageUrl(product);
  if (price === null || !image) return null;

  const title = stripIndiaOnlyFromProductName(product.name).displayName;
  const description = clean(product.shortDescription || product.description || title).slice(0, 5000);
  const sku = product.sku?.trim() || product.id;
  const gtin = firstAttribute(product, ["GTIN", "Barcode", "EAN", "UPC"]);
  const productType = product.categories.map(clean).filter(Boolean).join(" > ");

  return [
    "<item>",
    `<g:id>${xml(product.id)}</g:id>`,
    `<title>${xml(clean(title).slice(0, 150))}</title>`,
    `<description>${xml(description)}</description>`,
    `<link>${xml(`${SITE_URL}/product/${product.id}`)}</link>`,
    `<g:image_link>${xml(absoluteUrl(image))}</g:image_link>`,
    `<g:price>${price.toFixed(2)} INR</g:price>`,
    "<g:availability>in_stock</g:availability>",
    `<g:brand>${xml(product.brand?.trim() || "Maroma")}</g:brand>`,
    "<g:condition>new</g:condition>",
    `<g:mpn>${xml(sku)}</g:mpn>`,
    `<g:identifier_exists>${gtin ? "yes" : "no"}</g:identifier_exists>`,
    gtin ? `<g:gtin>${xml(gtin)}</g:gtin>` : "",
    productType ? `<g:product_type>${xml(productType)}</g:product_type>` : "",
    `<g:shipping><g:country>IN</g:country><g:service>Standard</g:service><g:price>${FLAT_SHIPPING_INR.toFixed(2)} INR</g:price></g:shipping>`,
    "</item>",
  ].filter(Boolean).join("");
}

export async function GET() {
  const { products } = await readLiveStorefrontCatalog();
  const items = products.map(itemXml).filter((item): item is string => Boolean(item));
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Maroma products</title><link>${SITE_URL}</link><description>Maroma natural fragrance and wellbeing products from Auroville</description>${items.join("")}</channel></rss>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
