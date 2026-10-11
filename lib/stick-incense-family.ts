import type { ProductRecord } from "./product-types";

export type StickIncenseFamilyMember = { id: string; name: string; variety: string; price: string; image: string; images: string[] };
export type StickIncenseFamily = { title: string; packLabel: string; members: StickIncenseFamilyMember[] };

function familyKey(product: ProductRecord): string | null {
  const isStickIncense = /incense sticks$/i.test(product.name)
    || /incense\s*[–-]\s*\d+\s*sticks$/i.test(product.name);
  if (!isStickIncense) return null;
  if (product.categories.some((category) => /colibri incense/i.test(category))) return "colibri-incense";
  if (product.categories.some((category) => /encens d.?auroville/i.test(category))) return "encens-d-auroville";
  if (product.categories.some((category) => /veda incense/i.test(category))) return "veda-incense";
  return "stick-incense";
}

function titleFor(key: string) {
  if (key === "colibri-incense") return "Colibri Incense";
  if (key === "encens-d-auroville") return "Encens d'Auroville Incense Sticks";
  if (key === "veda-incense") return "Veda Incense Sticks";
  return "Incense Sticks";
}

function memberFor(product: ProductRecord): StickIncenseFamilyMember {
  const images = [...new Set([...(product.images ?? []), product.imageUrl].filter(Boolean))];
  const variety = product.name
    .replace(/^coilbri\s+/i, "")
    .replace(/^colibri\s+/i, "")
    .replace(/\s+incense\s*[–-]\s*\d+\s*sticks$/i, "")
    .replace(/\s+incense sticks$/i, "")
    .trim();
  return { id: product.id, name: product.name, variety, price: product.price, image: images[0] || "", images };
}

export function resolveStickIncenseFamily(product: ProductRecord, catalog: ProductRecord[]): StickIncenseFamily | null {
  const key = familyKey(product);
  if (!key) return null;
  const members = catalog.filter((entry) => familyKey(entry) === key).map(memberFor).sort((a, b) => a.variety.localeCompare(b.variety));
  return members.length > 1 ? { title: titleFor(key), packLabel: "Pack of 10 sticks", members } : null;
}
