import type { ProductRecord } from "./product-types";

export type VotiveFamilyMember = {
  id: string;
  name: string;
  variety: string;
  sizeId: string;
  sizeLabel: string;
  sizeValue: number;
  price: string;
  image: string;
  images: string[];
};

const VOTIVE_NAME = /^(.*?)\s+Votive\s*[–-]\s*(\d+(?:\.\d+)?)\s*g(?:ms?)?\s*$/i;

function parseVotive(product: ProductRecord): VotiveFamilyMember | null {
  if (!product.categories.some((category) => /^votives?$/i.test(category))) return null;
  const match = product.name.trim().match(VOTIVE_NAME);
  if (!match) return null;
  const sizeValue = Number(match[2]);
  if (!Number.isFinite(sizeValue)) return null;
  const images = [...new Set([...(product.images ?? []), product.imageUrl].filter(Boolean))];
  return {
    id: product.id,
    name: product.name,
    variety: match[1].trim(),
    sizeId: `${sizeValue}g`,
    sizeLabel: `${sizeValue} g`,
    sizeValue,
    price: product.price,
    image: images[0] || "",
    images,
  };
}

export function resolveVotiveFamily(product: ProductRecord, catalog: ProductRecord[]): VotiveFamilyMember[] | null {
  if (!parseVotive(product)) return null;
  const members = catalog
    .map(parseVotive)
    .filter((member): member is VotiveFamilyMember => Boolean(member))
    .sort((a, b) => a.sizeValue - b.sizeValue || a.variety.localeCompare(b.variety));
  return members.length > 1 ? members : null;
}
