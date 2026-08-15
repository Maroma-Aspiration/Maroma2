import type { ProductRecord } from "./product-types";

const INCI_ATTRIBUTE_KEYS = [
  "Full INCI",
  "INCI",
  "Full Ingredient List",
  "Ingredients",
  "Ingredient List",
] as const;

const COSMETIC_SIGNAL_RE =
  /\b(soap|shampoo|conditioner|cream|serum|lotion|balm|wash|cleanser|scrub|mask|toner|gel|butter|deodorant|mist|spray|attar|perfume\s*oil|oil\s*perfume|face\s*oil|body\s*oil|hair\s*oil|essential\s*oil|skincare|skin\s*care|shower|bath\s*oil|hand\s*cream|lip|moisturizer|moisturiser)\b/i;

const CATEGORY_COSMETIC_RE =
  /\b(face|facial|body\s*care|hair|baby|man|men|perfume|fragrance|bath|skin)\b/i;

/** Home fragrance / décor / accessories where a full cosmetic INCI list is usually not expected. */
const NON_COSMETIC_RE =
  /\b(incense|cone incense|agarbatti|candle|tealight|tea\s*light|diffuser|reed\s*stick|perfume\s*mat|mats?\b|holder|terracotta|ceramic|vase|tray|decor|ambience|colibri|leaf\s*incense|stick\s*incense|gift\s*box\s*only|empty\s*box)\b/i;

function productSearchBlob(product: ProductRecord): string {
  return [product.name, ...product.categories, ...product.tags].join(" ");
}

function attributeValues(product: ProductRecord, keys: readonly string[]): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const values = product.attributes?.[key];
    if (!values?.length) continue;
    for (const value of values) {
      const trimmed = String(value || "").trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out;
}

function extractIngredientBlockFromDescription(text: string): string {
  const normalized = String(text || "")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n");
  const markers = ["FULL INGREDIENT LIST", "INGREDIENT LIST", "INCI"];
  for (const marker of markers) {
    const index = normalized.toUpperCase().indexOf(marker);
    if (index === -1) continue;
    return normalized.slice(index + marker.length).trim();
  }
  return "";
}

/** True when catalog data includes a usable full ingredient / INCI listing. */
export function productHasFullInci(product: ProductRecord): boolean {
  const fromAttrs = attributeValues(product, INCI_ATTRIBUTE_KEYS).join(", ").trim();
  if (fromAttrs.length >= 12) return true;

  const fromDescription = extractIngredientBlockFromDescription(
    `${product.description || ""}\n${product.shortDescription || ""}`
  );
  // Require more than a stub / heading leftovers.
  return fromDescription.replace(/[^a-z0-9]/gi, "").length >= 24;
}

/**
 * Personal-care / cosmetic-style products where shoppers and regulators expect
 * an ingredient list. Home fragrance accessories are excluded.
 */
export function productLikelyNeedsInci(product: ProductRecord): boolean {
  const blob = productSearchBlob(product);
  const hasCosmeticSignal = COSMETIC_SIGNAL_RE.test(blob) || CATEGORY_COSMETIC_RE.test(blob);
  if (!hasCosmeticSignal) return false;

  // Pure home-fragrance / décor formats without a leave-on/rinse-off formula.
  if (NON_COSMETIC_RE.test(blob) && !COSMETIC_SIGNAL_RE.test(product.name)) {
    return false;
  }

  return true;
}

export function productMissingRelevantInci(product: ProductRecord): boolean {
  return productLikelyNeedsInci(product) && !productHasFullInci(product);
}

export type ProductInciStatus = "ok" | "missing" | "not_applicable";

export function deriveProductInciStatus(product: ProductRecord): ProductInciStatus {
  if (!productLikelyNeedsInci(product)) return "not_applicable";
  return productHasFullInci(product) ? "ok" : "missing";
}
