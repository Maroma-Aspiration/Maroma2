import type { Metadata } from "next";
import { SITE_URL } from "./newsletter-archive-seo";
import { parseInrPriceNumber } from "./format-price";
import { decodeBasicHtmlEntities } from "./decode-html-entities";
import { stripIndiaOnlyFromProductName } from "./product-sale-region";
import { catalogCategories, categoryBySlug } from "./catalog-categories";
import type { ProductRecord } from "./product-types";
import { getDisplayImageUrl } from "./product-image";
import { getGalleryImageUrls } from "./product-gallery";

export { SITE_URL };

const DEFAULT_OG_PATH = "/maroma-logo.png";

export function absoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return SITE_URL;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${path}`;
}

export function safeMetadataBase(): URL {
  try {
    return new URL(SITE_URL);
  } catch {
    return new URL("https://maroma.com");
  }
}

export function truncateMetaDescription(text: string, max = 160): string {
  const clean = decodeBasicHtmlEntities(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

type PageMetaInput = {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "article";
  noIndex?: boolean;
};

export function buildPageMetadata({
  title,
  description,
  path,
  image,
  type = "website",
  noIndex = false,
}: PageMetaInput): Metadata {
  const url = absoluteUrl(path);
  const desc = truncateMetaDescription(description);
  const imageUrl = absoluteUrl(image?.trim() || DEFAULT_OG_PATH);
  const images = [{ url: imageUrl, alt: title }];

  return {
    title,
    description: desc,
    metadataBase: safeMetadataBase(),
    alternates: { canonical: url },
    openGraph: {
      type,
      url,
      siteName: "Maroma",
      title,
      description: desc,
      images,
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [imageUrl],
    },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Maroma",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/maroma-logo.png"),
    },
    description:
      "Maroma makes botanical skincare, body care, natural perfume, incense, candles, and home rituals, handmade in Auroville, India.",
    areaServed: {
      "@type": "Country",
      name: "India",
    },
    brand: {
      "@type": "Brand",
      name: "Maroma",
    },
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: "Maroma",
    description:
      "Shop Maroma botanical skincare, natural fragrance, incense, candles, and gifting — handmade in Auroville, India.",
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en-IN",
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

function firstAttribute(product: ProductRecord, keys: string[]): string | null {
  for (const key of keys) {
    const values = product.attributes[key];
    if (values?.length) {
      const joined = values.map((v) => decodeBasicHtmlEntities(v)).filter(Boolean).join(", ");
      if (joined) return joined;
    }
  }
  return null;
}

/** Extract size/volume from product name when present (e.g. 100ml, 200g). */
export function inferSizeFromName(name: string): string | null {
  const match = decodeBasicHtmlEntities(name).match(
    /(\d+(?:[.,]\d+)?\s?(?:ml|mL|ML|g|gm|grams?|kg|oz|cl)\b)/i
  );
  return match ? match[1].replace(/\s+/g, "") : null;
}

export function resolvePrimaryCategorySlug(product: ProductRecord): string | null {
  const haystack = [product.name, ...product.categories, ...product.tags].join(" ").toLowerCase();
  for (const category of catalogCategories) {
    if (category.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      return category.slug;
    }
  }
  return null;
}

export type ProductSeoFact = { label: string; value: string };

export type ProductSeoAudit = {
  facts: ProductSeoFact[];
  missing: string[];
};

/**
 * Facts for PDP display + schema. Only includes values present in catalog data
 * (or clearly inferable from the product name, e.g. size tokens).
 */
export function auditProductSeoFacts(product: ProductRecord): ProductSeoAudit {
  const { displayName, indiaOnlyNote } = stripIndiaOnlyFromProductName(product.name);
  const facts: ProductSeoFact[] = [];
  const missing: string[] = [];

  facts.push({ label: "Product", value: displayName });
  if (product.sku?.trim()) facts.push({ label: "SKU", value: product.sku.trim() });
  else missing.push("SKU");

  const brand = product.brand?.trim() || "Maroma";
  facts.push({ label: "Brand", value: brand });

  if (product.categories.length) {
    facts.push({ label: "Category", value: product.categories.map(decodeBasicHtmlEntities).join(", ") });
  } else {
    missing.push("Category");
  }

  const size =
    firstAttribute(product, ["Size", "Volume", "Net Weight", "Weight"]) || inferSizeFromName(product.name);
  if (size) facts.push({ label: "Size", value: size });
  else missing.push("Size / volume");

  const scent = firstAttribute(product, [
    "Fragrance",
    "Scent",
    "Scent Notes",
    "Fragrance Notes",
    "Aroma",
    "Mood / Wellness Effects",
  ]);
  if (scent) facts.push({ label: "Fragrance / scent", value: scent });
  else missing.push("Fragrance / scent notes");

  const keyIngredients = firstAttribute(product, ["Key Ingredients"]);
  if (keyIngredients) facts.push({ label: "Key ingredients", value: keyIngredients });
  else missing.push("Key ingredients");

  const inci = firstAttribute(product, ["Full INCI", "INCI", "Full Ingredient List", "Ingredients"]);
  if (inci) facts.push({ label: "Ingredients (INCI)", value: inci });
  else missing.push("Full INCI");

  const concern = firstAttribute(product, ["Concern", "Key Attributes"]);
  if (concern) facts.push({ label: "Suitable for", value: concern });
  else missing.push("Intended use / concern");

  if (indiaOnlyNote || /not\s+for\s+international/i.test(product.shortDescription)) {
    facts.push({ label: "Availability", value: "Only for sale in India" });
  } else {
    missing.push("India / export availability note");
  }

  facts.push({ label: "Origin", value: "Handmade in Auroville, India" });

  return { facts, missing };
}

export function productJsonLd(product: ProductRecord, options: { availability: "InStock" | "OutOfStock" }) {
  const { displayName } = stripIndiaOnlyFromProductName(product.name);
  const description = truncateMetaDescription(
    decodeBasicHtmlEntities(product.shortDescription || product.description || displayName),
    5000
  );
  const images = getGalleryImageUrls(product).map(absoluteUrl);
  if (images.length === 0) {
    const fallback = getDisplayImageUrl(product);
    if (fallback) images.push(absoluteUrl(fallback));
  }
  const price = parseInrPriceNumber(product.price);
  const brandName = product.brand?.trim() || "Maroma";
  const size =
    firstAttribute(product, ["Size", "Volume", "Net Weight", "Weight"]) || inferSizeFromName(product.name);
  const category = product.categories.map(decodeBasicHtmlEntities).filter(Boolean).join(" > ") || undefined;
  const url = absoluteUrl(`/product/${product.id}`);

  const offer =
    price === null
      ? undefined
      : {
          "@type": "Offer",
          url,
          priceCurrency: "INR",
          price: price.toFixed(2),
          availability: `https://schema.org/${options.availability}`,
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@id": `${SITE_URL}/#organization` },
        };

  const additionalProperty: { "@type": "PropertyValue"; name: string; value: string }[] = [];
  if (size) additionalProperty.push({ "@type": "PropertyValue", name: "Size", value: size });
  const keyIngredients = firstAttribute(product, ["Key Ingredients"]);
  if (keyIngredients) {
    additionalProperty.push({ "@type": "PropertyValue", name: "Key Ingredients", value: keyIngredients });
  }
  if (stripIndiaOnlyFromProductName(product.name).indiaOnlyNote) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Sale region",
      value: "Only for sale in India",
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: displayName,
    description,
    image: images.length ? images : undefined,
    sku: product.sku?.trim() || product.id,
    mpn: product.sku?.trim() || product.id,
    brand: {
      "@type": "Brand",
      name: brandName,
    },
    category,
    url,
    offers: offer,
    additionalProperty: additionalProperty.length ? additionalProperty : undefined,
  };
}

export function collectionPageJsonLd(input: {
  name: string;
  description: string;
  path: string;
  productCount: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${absoluteUrl(input.path)}#collection`,
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: { "@id": `${SITE_URL}/#organization` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: input.productCount,
      itemListOrder: "https://schema.org/ItemListUnordered",
    },
  };
}

export function articleJsonLd(input: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
}) {
  const url = absoluteUrl(input.path);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: truncateMetaDescription(input.description, 300),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    image: input.image ? [absoluteUrl(input.image)] : undefined,
    datePublished: input.datePublished || undefined,
    dateModified: input.dateModified || input.datePublished || undefined,
    author: { "@type": "Organization", name: "Maroma", url: SITE_URL },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function relatedCategoryLinks(slug: string): { href: string; label: string }[] {
  const current = categoryBySlug(slug);
  if (!current) return [];
  const related = catalogCategories.filter((c) => c.slug !== slug).slice(0, 6);
  return related.map((c) => ({ href: `/${c.slug}`, label: c.label }));
}
