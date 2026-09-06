export type CatalogCategory = {
  slug: string;
  label: string;
  description: string;
  /**
   * Longer, crawlable intro shown below the hero. Keep factual — used for SEO/GEO.
   * Prefer this over stuffing keywords into the visual hero tagline.
   */
  seoIntro?: string;
  /** Set false where the banner is intended to lead directly into the collection. */
  showSeoIntro?: boolean;
  keywords: string[];
  /** Optional hero image (local `/staging-media/...` path), e.g. from maroma.com category asset. */
  bannerImage?: string;
  /** `wide-cover`: full-bleed banner with text overlaid (maroma.com–style). Default: side thumbnail. */
  bannerLayout?: "thumb" | "wide-cover";
  /** When set, used as the category hero `h1` instead of `label`. */
  heroTitle?: string;
  /** When set, used as the hero paragraph instead of `description`. */
  heroTagline?: string;
};

export const catalogCategories: CatalogCategory[] = [
  {
    slug: "face-care",
    label: "Face Care",
    description: "Botanical face care from Maroma — cleansers, serums, and daily skincare rituals handmade in Auroville, India.",
    seoIntro:
      "Maroma face care focuses on botanical cleansers, serums, and simple daily rituals. Formulations are made in Auroville, India, for people looking for natural skincare that supports balanced, glowing skin.",
    showSeoIntro: false,
    keywords: ["face", "facial", "skin care", "serum", "cleanser", "face care", "day cream", "night cream"],
    bannerImage: "/staging-media/admin-category-banners/face-care-1776928521609.png",
    bannerLayout: "wide-cover",
    heroTitle: "Love Your Skin",
    heroTagline:
      "Because your skin deserves to feel happy, balanced, and naturally glowing."
  },
  {
    slug: "body-care",
    label: "Body Care",
    description: "Natural body care from Maroma — soaps, washes, oils, and nourishing essentials handmade in Auroville.",
    seoIntro:
      "Explore Maroma body care: aromatic soaps, washes, oils, and everyday essentials made with botanical ingredients in Auroville, India.",
    keywords: ["body care", "bath", "soap", "body", "lotion", "colibri"],
    bannerImage: "/staging-media/admin-category-banners/body-care-1776932025032.png",
    bannerLayout: "wide-cover"
  },
  {
    slug: "hair-care",
    label: "Hair Care",
    description: "Natural hair care from Maroma — shampoos, conditioners, and scalp rituals with botanical ingredients.",
    seoIntro:
      "Maroma hair care includes shampoos, conditioners, and rituals made with natural ingredients for cleansing and caring for hair and scalp.",
    keywords: ["hair", "shampoo", "conditioner", "scalp"],
    bannerImage: "/staging-media/admin-category-banners/hair-care-1776932050901.png",
    bannerLayout: "wide-cover"
  },
  {
    slug: "baby",
    label: "Baby",
    description: "Gentle Maroma baby care formulated with natural ingredients for delicate skin.",
    seoIntro:
      "Maroma baby products are made for gentle, everyday care of delicate skin, using natural ingredients suitable for little ones.",
    keywords: ["baby"],
    bannerImage: "/staging-media/wp-content/uploads/2023/09/Baby-Shampoo-01.jpeg",
    bannerLayout: "wide-cover",
    heroTitle: "Baby",
    heroTagline: "Gentle, natural care for your little one."
  },
  {
    slug: "man",
    label: "Man",
    description: "Natural grooming, beard care, and fragrance for men from Maroma, handmade in Auroville.",
    seoIntro:
      "The Maroma Man collection covers natural grooming, beard care, and fragrance options designed for everyday use.",
    keywords: ["men", "man", "beard", "shave", "grooming"],
    bannerImage: "/staging-media/wp-content/uploads/2023/08/EA29-A33_Man-Travel-Kit-001-copy.jpg",
    bannerLayout: "wide-cover",
    heroTitle: "Man",
    heroTagline: "Natural grooming and fragrance for him."
  },
  {
    slug: "perfumes",
    label: "Perfumes",
    description: "Natural perfume oils and fine fragrances from Maroma — botanical aromatics handmade in Auroville, India.",
    seoIntro:
      "Maroma perfumes include natural perfume oils and botanical fragrances created in Auroville. Browse mood-led aromatics for personal fragrance rituals.",
    keywords: ["perfume", "fragrance", "aroma", "eau", "attar"],
    bannerImage: "/staging-media/admin-category-banners/perfumes-1776932080574.png",
    bannerLayout: "wide-cover"
  },
  {
    slug: "home-essentials",
    label: "Home Essentials",
    description: "Natural incense, handmade candles, and home fragrance from Maroma in Auroville, India.",
    seoIntro:
      "Maroma Home Essentials brings natural incense, candles, and ambient fragrance for living spaces. Many pieces continue Auroville’s tradition of handmade home fragrance.",
    keywords: ["home", "incense", "candle", "ambient", "room", "diffuser", "colibri"],
    bannerImage: "/staging-media/admin-category-banners/home-essentials-1776932101259.png",
    bannerLayout: "wide-cover"
  },
  {
    slug: "colibri",
    label: "Colibri",
    description: "Colibri botanical incense leaves for home and garden — natural outdoor fragrance from Maroma.",
    seoIntro:
      "Colibri is Maroma’s line of botanical incense leaves for home and garden use — a natural outdoor fragrance format.",
    keywords: ["colibri"],
    bannerImage: "/staging-media/wp-content/uploads/2025/09/Leaf-Incemse-Cedarwood-01.webp",
    bannerLayout: "wide-cover",
    heroTitle: "Colibri",
    heroTagline: "Botanical incense leaves for home and garden."
  },
  {
    slug: "gifting",
    label: "Gifting",
    description: "Maroma gift sets and curated wellbeing selections — natural fragrance and care, ready to give.",
    seoIntro:
      "Choose Maroma gifting sets and curated selections spanning skincare, perfume oils, incense, and home fragrance — suitable for thoughtful, nature-led presents.",
    keywords: ["gift", "gifting", "set", "hamper", "collection"],
    bannerImage: "/staging-media/admin-category-banners/gifting-1776932133753.png",
    bannerLayout: "wide-cover"
  }
];

export const categoryBySlug = (slug: string): CatalogCategory | undefined => {
  let decoded = slug.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // leave as-is if segment is not valid percent-encoding
  }
  const key = decoded.trim().toLowerCase();
  return catalogCategories.find((category) => category.slug === key);
};

const normalize = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const navHrefByNormalizedLabel: Record<string, string> = (() => {
  const map: Record<string, string> = {
    home: "/?skipIntro=1",
    "home-care": "/home-essentials",
    offers: "/special"
  };
  for (const category of catalogCategories) {
    map[normalize(category.label)] = `/${category.slug}`;
    map[normalize(category.slug)] = `/${category.slug}`;
  }
  return map;
})();

/** Resolves homepage nav labels (any casing/spacing) to category routes. */
export const getNavHref = (label: string): string => {
  const key = normalize(label);
  if (!key) {
    return "/";
  }
  return navHrefByNormalizedLabel[key] ?? categoryPathByLabel(label);
};

export const categoryPathByLabel = (label: string): string => {
  const cleaned = normalize(label);
  if (!cleaned || cleaned === "home") {
    return "/?skipIntro=1";
  }

  const matched = catalogCategories.find(
    (category) => normalize(category.label) === cleaned || normalize(category.slug) === cleaned
  );
  if (matched) {
    return `/${matched.slug}`;
  }

  return `/${slugify(cleaned)}`;
};
