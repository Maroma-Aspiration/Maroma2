import { decodeBasicHtmlEntities } from "./decode-html-entities";
import { parseInrPriceNumber } from "./format-price";
import type { ProductRecord } from "./product-types";

export const CLASSIC_PILLAR_FAMILY_ID = "classic-pillar";

export type ProductFamilySizeId = "100g" | "300g" | "600g";

export type ProductFamilySize = {
  id: ProductFamilySizeId;
  label: string;
  shortLabel: string;
};

export const CLASSIC_PILLAR_SIZES: ProductFamilySize[] = [
  { id: "100g", label: "100 g", shortLabel: "100 g" },
  { id: "300g", label: "300 g", shortLabel: "300 g" },
  { id: "600g", label: "600 g", shortLabel: "600 g" },
];

export type ProductFamilyMemberView = {
  id: string;
  name: string;
  fragrance: string;
  price: string;
  images: string[];
  groupImages: string[];
  soloImages: string[];
  sizeImages: Partial<Record<ProductFamilySizeId, string[]>>;
  imageNeeds: ProductFamilySizeId[];
  borrowedImageNote?: string;
  swatch: string;
};

const STAGING_PILLAR_DIR = "/staging-media/wp-content/uploads/2025/09/";
const LOCAL_PILLAR_SIZE_IMAGE_DIR = "/candle-size-images";

/** Supplied product photos, one accurately matched image for each large pillar size. */
const LOCAL_CLASSIC_PILLAR_SIZE_FILES: Record<string, Partial<Record<ProductFamilySizeId, string>>> = {
  "apple blossom": { "300g": "Apple Blossom 02 300.JPG", "600g": "Apple Blossom 02 (1)600.JPG" },
  champak: { "300g": "Champak 02 300.JPG", "600g": "Champak 02 (1)600.JPG" },
  "cherry blossom": { "300g": "Cherry Blossom 02 300.JPG", "600g": "Cherry Blossom 02 (1)600.JPG" },
  cranberry: { "300g": "cranberry 02 300.JPG", "600g": "cranberry 02 (1)600.JPG" },
  frangipani: { "300g": "Frangipani 02 (1)300.JPG", "600g": "Frangipani 02 600.JPG" },
  "into the night": { "300g": "Into the Night 02 300.JPG", "600g": "Into the Night 02 (1)600.JPG" },
  "jasmine sambac": { "300g": "Jasmine Sambac 02 (1)300.JPG", "600g": "Jasmine Sambac 02 600.JPG" },
  "lavender mist": { "300g": "Lavender Mist 02 300.JPG", "600g": "Lavender Mist 02 (1)600.JPG" },
  lemongrass: { "300g": "Lemongrass 02 (1)300.JPG", "600g": "Lemongrass 02 600.JPG" },
  "mysore sandalwood": { "300g": "Mysore Sandalwood 02 (1)300.JPG", "600g": "Mysore Sandalwood 02 600.JPG" },
  "opium flower": { "300g": "Opium flower 02 300.JPG", "600g": "Opium flower 02 (1)600.JPG" },
  "orange blossom": { "300g": "Orange Blossom 02 (1)300.JPG", "600g": "Orange Blossom 02 600.JPG" },
  "orange cinnamon": { "300g": "orange cinnamon 02 300.JPG", "600g": "orange cinnamon 02 (1) 600.JPG" },
  "peach blossom": { "300g": "Peach Blossom 02 (1) 300.JPG", "600g": "Peach Blossom 02 600.JPG" },
  "pink lotus": { "300g": "Pink Lotus 02 300.JPG", "600g": "Pink Lotus 02 (1)600.JPG" },
  pinkberry: { "300g": "Pinkberry 02 (1) 300.JPG", "600g": "Pinkberry 02 600.JPG" },
  pomegranate: { "300g": "Pomegranate 02 (1)300.JPG", "600g": "Pomegranate 02 600.JPG" },
  "red rose": { "300g": "Red Rose 02 300.JPG", "600g": "Red Rose 02 (1)600.JPG" },
  strawberry: { "300g": "Strawberry 300.JPG", "600g": "Strawberry 600.JPG" },
  vanilla: { "300g": "Vanilla 02 (1) 300.JPG", "600g": "Vanilla 02 600.JPG" },
};

/** Extra single-pillar files from Shopify. Plain `-02.webp` is omitted when that file belongs to incense or perfume. */
const CLASSIC_PILLAR_SOLO_FILES: Record<string, string[]> = {
  "apple blossom": ["Apple-Blossom-02-copy.webp", "Apple-Blossom-02-1.webp", "Apple-Blossom-02.webp"],
  champak: ["Champak-02-copy.webp", "Champak-02.webp", "Champak-02-1.webp"],
  "cherry blossom": ["Cherry-Blossom-02-copy.webp", "Cherry-Blossom-02-1.webp", "Cherry-Blossom-02-2.webp"],
  cranberry: ["cranberry-02-copy.webp", "cranberry-02-1.webp", "cranberry-02.webp"],
  frangipani: ["Frangipani-02-copy.webp", "Frangipani-02.webp", "Frangipani-02-1.webp"],
  "into the night": ["Into-the-Night-02-copy.webp", "Into-the-Night-02-1.webp", "Into-the-Night-02-2.webp"],
  "jasmine sambac": ["Jasmine-Sambac-02-copy.webp", "Jasmine-Sambac-02.webp", "Jasmine-Sambac-02-1.webp"],
  "lavender mist": ["Lavender-Mist-02-copy.webp", "Lavender-Mist-02.webp", "Lavender-Mist-02-1.webp"],
  lemongrass: ["Lemongrass-02-copy.webp", "Lemongrass-02-1.webp", "Lemongrass-02-2.webp"],
  "mysore sandalwood": ["Mysore-Sandalwood-02-copy.webp", "Mysore-Sandalwood-02.webp", "Mysore-Sandalwood-02-1.webp"],
  "opium flower": ["Opium-flower-02-copy.webp", "Opium-flower-02-2.webp", "Opium-flower-02-3.webp"],
  "orange blossom": ["Orange-Blossom-02-copy.webp", "Orange-Blossom-02.webp", "Orange-Blossom-02-1.webp"],
  "orange cinnamon": ["orange-cinnamon-02-copy.webp", "orange-cinnamon-02.webp", "orange-cinnamon-02-1.webp"],
  "peach blossom": ["Peach-Blossom-02-copy.webp", "Peach-Blossom-02-1.webp", "Peach-Blossom-02-2.webp"],
  "pink lotus": ["Pink-Lotus-02-copy-1.webp", "Pink-Lotus-02.webp", "Pink-Lotus-02-1.webp"],
  pinkberry: ["Pinkberry-02-copy.webp", "Pinkberry-02.webp", "Pinkberry-02-1.webp"],
  pomegranate: ["Pomegranate-02-copy.webp", "Pomegranate-02.webp", "Pomegranate-02-1.webp"],
  "red rose": ["Red-Rose-02-copy.webp", "Red-Rose-02.webp", "Red-Rose-02-1.webp"],
  strawberry: ["Strawberry-copy.webp", "Strawberry.webp", "Strawberry-1.webp"],
  vanilla: ["Vanilla-02-copy.webp", "Vanilla-02-2.webp", "Vanilla-02-3.webp"],
};

function productImageUrls(product: ProductRecord): string[] {
  return [...(product.images ?? []), product.imageUrl || ""].filter(Boolean);
}

function imageBasename(url: string): string {
  return (url.split("/").pop() || "").toLowerCase();
}

function isUsedByOtherProduct(url: string, catalog: ProductRecord[], pillarId: string): boolean {
  const target = imageBasename(url);
  if (!target) return false;
  return catalog.some((other) => {
    if (other.id === pillarId) return false;
    if (isClassicPillarProduct(other)) return false;
    return productImageUrls(other).some((otherUrl) => imageBasename(otherUrl) === target);
  });
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    next.push(url);
  }
  return next;
}

function suppliedSizeImage(fragrance: string, sizeId: ProductFamilySizeId): string | null {
  const file = LOCAL_CLASSIC_PILLAR_SIZE_FILES[fragrance.toLowerCase()]?.[sizeId];
  return file ? `${LOCAL_PILLAR_SIZE_IMAGE_DIR}/${sizeId}/${encodeURIComponent(file)}` : null;
}

function extraSoloUrls(fragrance: string, catalog: ProductRecord[], pillarId: string): string[] {
  const files = CLASSIC_PILLAR_SOLO_FILES[fragrance.toLowerCase()] ?? [];
  return files
    .map((file) => `${STAGING_PILLAR_DIR}${file}`)
    .filter((url) => !isUsedByOtherProduct(url, catalog, pillarId));
}

export type ProductFamilyDefinition = {
  id: typeof CLASSIC_PILLAR_FAMILY_ID;
  title: string;
  listingTitle: string;
  listingNote: string;
  sizes: ProductFamilySize[];
};

export const CLASSIC_PILLAR_FAMILY: ProductFamilyDefinition = {
  id: CLASSIC_PILLAR_FAMILY_ID,
  title: "Pillar Candle",
  listingTitle: "Pillar Candles",
  listingNote: "100 g, 300 g, 600 g",
  sizes: CLASSIC_PILLAR_SIZES,
};

const FRAGRANCE_SWATCHES: Record<string, string> = {
  "apple blossom": "#b7e0a4",
  champak: "#d4a24a",
  "cherry blossom": "#e7a0b8",
  cranberry: "#9c2b3a",
  frangipani: "#f3d7a0",
  "into the night": "#2c3a55",
  "jasmine sambac": "#f4f0de",
  "lavender mist": "#9aa0c8",
  lemongrass: "#c8c85a",
  "mysore sandalwood": "#c4a36a",
  "opium flower": "#6b2c4a",
  "orange blossom": "#f0c56e",
  "orange cinnamon": "#d07a32",
  "peach blossom": "#f0b48a",
  "pink lotus": "#e39ab0",
  pinkberry: "#e56b8a",
  pomegranate: "#b13a3a",
  "red rose": "#b4232c",
  strawberry: "#e24b5a",
  vanilla: "#f3e6c0",
};

function normalizeName(value: string): string {
  return decodeBasicHtmlEntities(value).replace(/\s+/g, " ").trim();
}

function sizeTokens(product: ProductRecord): string[] {
  return (product.attributes?.Size ?? []).map((value) => value.toLowerCase().replace(/\s+/g, ""));
}

export function isClassicPillarProduct(product: ProductRecord): boolean {
  const name = normalizeName(product.name);
  if (!/pillar candle/i.test(name)) return false;
  if (/holder|triple scented|scented candle/i.test(name)) return false;
  if (!(product.categories ?? []).some((category) => /pillar/i.test(category))) return false;
  const sizes = sizeTokens(product);
  const has100 = sizes.some((size) => size.includes("100g") || size.includes("100gm"));
  const has300 = sizes.some((size) => size.includes("300g") || size.includes("300gm") || size.includes("300ml"));
  const has600 = sizes.some((size) => size.includes("600g") || size.includes("600gm"));
  return has100 && has300 && has600;
}

export function classicPillarFragrance(product: ProductRecord): string {
  return normalizeName(product.name).replace(/\s+pillar candle$/i, "").trim();
}

function sizeIdFromImageUrl(url: string): ProductFamilySizeId | null {
  const file = url.split("/").pop() || url;
  if (/600\s*g/i.test(file)) return "600g";
  if (/300\s*g|300\s*ml/i.test(file)) return "300g";
  if (/100\s*g/i.test(file)) return "100g";
  return null;
}

function swatchForFragrance(fragrance: string): string {
  return FRAGRANCE_SWATCHES[fragrance.toLowerCase()] || "#c5d5d3";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6) return null;
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

export function inkOnSwatch(swatch: string): string {
  const rgb = hexToRgb(swatch);
  if (!rgb) return "#17343a";
  const channel = (value: number) => {
    const n = value / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  return luminance > 0.55 ? "#17343a" : "#ffffff";
}

export function classicPillarMembers(catalog: ProductRecord[]): ProductRecord[] {
  return catalog
    .filter(isClassicPillarProduct)
    .sort((a, b) => classicPillarFragrance(a).localeCompare(classicPillarFragrance(b), undefined, { sensitivity: "base" }));
}

export function toClassicPillarMemberView(
  product: ProductRecord,
  catalog: ProductRecord[]
): ProductFamilyMemberView {
  const fragrance = classicPillarFragrance(product);
  const ownImages = (product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : [])
    .filter(Boolean)
    .filter((url) => !isUsedByOtherProduct(url, catalog, product.id));
  const sizeImages: Partial<Record<ProductFamilySizeId, string[]>> = {};
  const groupImages: string[] = [];
  for (const image of ownImages) {
    const sizeId = sizeIdFromImageUrl(image);
    if (sizeId) {
      sizeImages[sizeId] = [...(sizeImages[sizeId] ?? []), image];
    } else {
      groupImages.push(image);
    }
  }
  for (const sizeId of ["300g", "600g"] as const) {
    const suppliedImage = suppliedSizeImage(fragrance, sizeId);
    if (suppliedImage) sizeImages[sizeId] = [suppliedImage];
  }
  const soloImages = extraSoloUrls(fragrance, catalog, product.id);
  const images = uniqueUrls([...soloImages, ...ownImages]);
  const imageNeeds = CLASSIC_PILLAR_SIZES.map((size) => size.id).filter((sizeId) => !sizeImages[sizeId]?.length);
  const ownKey = images.join("|");
  const fragranceSlug = fragrance.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const imagesMatchFragrance = images.some((image) => image.toLowerCase().includes(fragranceSlug));
  const borrowedFrom = !imagesMatchFragrance
    ? catalog.find((other) => {
        if (other.id === product.id || !isClassicPillarProduct(other)) return false;
        const otherImages = (other.images ?? []).join("|");
        return Boolean(ownKey) && ownKey === otherImages && classicPillarFragrance(other) !== fragrance;
      })
    : undefined;

  return {
    id: product.id,
    name: normalizeName(product.name),
    fragrance,
    price: product.price,
    images,
    groupImages,
    soloImages,
    sizeImages,
    imageNeeds,
    borrowedImageNote: borrowedFrom
      ? `Uses ${classicPillarFragrance(borrowedFrom)} photos. Own ${fragrance} photos needed.`
      : undefined,
    swatch: swatchForFragrance(fragrance),
  };
}

export function resolveClassicPillarFamily(product: ProductRecord, catalog: ProductRecord[]): {
  family: ProductFamilyDefinition;
  members: ProductFamilyMemberView[];
} | null {
  if (!isClassicPillarProduct(product)) return null;
  const members = classicPillarMembers(catalog).map((entry) => toClassicPillarMemberView(entry, catalog));
  if (members.length < 2) return null;
  return { family: CLASSIC_PILLAR_FAMILY, members };
}

export function familyListingProduct(
  family: ProductFamilyDefinition,
  members: ProductRecord[]
): ProductRecord | null {
  const representative = members[0];
  if (!representative) return null;
  const fragrance = classicPillarFragrance(representative);
  const files = CLASSIC_PILLAR_SOLO_FILES[fragrance.toLowerCase()] ?? [];
  const solos = files.map((file) => `${STAGING_PILLAR_DIR}${file}`);
  return {
    ...representative,
    name: family.listingTitle,
    shortDescription: family.listingNote,
    imageUrl: solos[0] || representative.imageUrl,
    images: uniqueUrls([...solos, ...(representative.images ?? [])]),
    attributes: {
      ...representative.attributes,
      FamilyListing: [family.id],
    },
  };
}

export function isFamilyListingProduct(product: ProductRecord): boolean {
  return (product.attributes?.FamilyListing ?? []).includes(CLASSIC_PILLAR_FAMILY_ID);
}

export function collapseProductFamilyListings(
  products: ProductRecord[],
  options?: { preserveIndividuals?: boolean }
): ProductRecord[] {
  if (options?.preserveIndividuals) return products;
  const members = classicPillarMembers(products);
  if (members.length < 2) return products;
  const memberIds = new Set(members.map((product) => product.id));
  const listing = familyListingProduct(CLASSIC_PILLAR_FAMILY, members);
  if (!listing) return products;
  let inserted = false;
  const next: ProductRecord[] = [];
  for (const product of products) {
    if (!memberIds.has(product.id)) {
      next.push(product);
      continue;
    }
    if (!inserted) {
      next.push(listing);
      inserted = true;
    }
  }
  return next;
}

export function encodeFamilySizeVariant(sizeId: ProductFamilySizeId): string {
  return `size:${sizeId}`;
}

export function parseFamilySizeVariant(variant?: string): ProductFamilySizeId | null {
  const match = /^size:(100g|300g|600g)$/.exec(variant || "");
  return (match?.[1] as ProductFamilySizeId | undefined) ?? null;
}

const CLASSIC_PILLAR_SIZE_PRICES: Record<ProductFamilySizeId, number> = {
  "100g": 360,
  "300g": 835,
  "600g": 1450,
};

export function familySizePriceInr(member: Pick<ProductRecord, "price">, sizeId: ProductFamilySizeId): number | null {
  if (sizeId === "100g") return parseInrPriceNumber(member.price) ?? CLASSIC_PILLAR_SIZE_PRICES[sizeId];
  return CLASSIC_PILLAR_SIZE_PRICES[sizeId] ?? null;
}

export function familySizePriceLabel(member: Pick<ProductRecord, "price">, sizeId: ProductFamilySizeId): string | null {
  const amount = familySizePriceInr(member, sizeId);
  return amount == null ? null : String(amount);
}

export function galleryImagesForSize(member: ProductFamilyMemberView, sizeId: ProductFamilySizeId): string[] {
  if (member.sizeImages[sizeId]?.length) return member.sizeImages[sizeId]!;
  if (member.soloImages.length) return member.soloImages;
  if (member.groupImages.length) return member.groupImages;
  return member.images;
}

export function familyImageNeedLabel(member: ProductFamilyMemberView, sizeId: ProductFamilySizeId): string | null {
  if (member.sizeImages[sizeId]?.length) return null;
  if (member.groupImages.length || member.soloImages.length) return null;
  if (member.borrowedImageNote) return member.borrowedImageNote;
  if (member.imageNeeds.includes(sizeId)) {
    const size = CLASSIC_PILLAR_SIZES.find((entry) => entry.id === sizeId);
    return `Photo needed: ${member.fragrance} ${size?.label ?? sizeId}, this size alone.`;
  }
  return null;
}
