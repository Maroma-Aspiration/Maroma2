import type { ProductRecord } from "./product-types";

const INCI_ATTR_KEYS = [
  "Full INCI",
  "INCI",
  "Full Ingredient List",
  "Ingredients",
  "Ingredient List",
] as const;

function cleanCatalogueMarkup(text: string): string {
  return String(text || "")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\[\/?bg_collapse[^\]]*\]/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function firstFilledAttribute(
  attributes: Record<string, string[]>,
  keys: readonly string[]
): string | null {
  for (const key of keys) {
    const values = attributes[key];
    if (!values?.length) continue;
    const joined = values.map((value) => value.trim()).filter(Boolean).join(", ");
    if (joined) return joined;
  }
  return null;
}

/** True INCI / full formula lists — not short botanical “key ingredient” highlights. */
export function looksLikeFullInciText(text: string): boolean {
  const value = cleanCatalogueMarkup(text);
  if (value.length < 60) return false;
  const commas = (value.match(/,/g) || []).length;
  const hardSignals = (
    value.match(
      /\b(Aqua|Parfum|Cocamidopropyl|Caprylic(?:\s*\/\s*Capric)?|Disodium|Coco\s+Glucoside|Caprylyl|Triglyceride|Sodium\s+(?:Lauryl|Coco|Ascorbyl|Benzoate)|Cetearyl|Phenoxyethanol|Xanthan|Carbomer|Betaine)\b/gi
    ) || []
  ).length;
  const latinBinomials = (
    value.match(
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+(?:Oil|Extract|Butter|Water|Leaf|Seed|Fruit|Bark))?\b/g
    ) || []
  ).length;
  return hardSignals >= 2 || (hardSignals >= 1 && commas >= 6 && latinBinomials >= 3);
}

export function extractFullInciFromDescription(description: string): string | null {
  const body = cleanCatalogueMarkup(description);
  const match = body.match(
    /(?:FULL\s+INGREDIENT\s+LIST|INGREDIENT\s+LIST)\s*[:\-]?\s*([\s\S]+)/i
  );
  const extracted = match?.[1]?.trim() ?? "";
  if (!extracted) return null;
  // Ignore empty headings with no formula text.
  if (extracted.replace(/[^a-z0-9]/gi, "").length < 24) return null;
  return extracted.replace(/\s+/g, " ").trim();
}

/**
 * Ensure Full INCI lives on the dedicated attribute.
 * - Promote labelled lists from the product description.
 * - If Key Ingredients accidentally holds a full INCI formula, move it.
 * Does not invent ingredients and does not treat normal botanical highlights as INCI.
 */
export function normalizeProductInciFields(product: ProductRecord): {
  product: ProductRecord;
  changed: boolean;
  source: "unchanged" | "description" | "key_ingredients";
} {
  const attributes = { ...(product.attributes ?? {}) };
  const existing = firstFilledAttribute(attributes, INCI_ATTR_KEYS);
  if (existing && looksLikeFullInciText(existing)) {
    if (!attributes["Full INCI"]?.some((value) => value.trim())) {
      attributes["Full INCI"] = [existing];
      return {
        product: { ...product, attributes },
        changed: true,
        source: "unchanged",
      };
    }
    return { product: { ...product, attributes }, changed: false, source: "unchanged" };
  }
  if (existing && existing.trim().length >= 12) {
    // Already has some ingredients field content — keep it under Full INCI name.
    if (!attributes["Full INCI"]?.some((value) => value.trim())) {
      attributes["Full INCI"] = [existing];
      return {
        product: { ...product, attributes },
        changed: true,
        source: "unchanged",
      };
    }
    return { product: { ...product, attributes }, changed: false, source: "unchanged" };
  }

  const fromDescription = extractFullInciFromDescription(product.description ?? "");
  if (fromDescription) {
    attributes["Full INCI"] = [fromDescription];
    return {
      product: { ...product, attributes },
      changed: true,
      source: "description",
    };
  }

  const keyIngredients = attributes["Key Ingredients"] ?? [];
  if (keyIngredients.length === 1 && looksLikeFullInciText(keyIngredients[0])) {
    attributes["Full INCI"] = [cleanCatalogueMarkup(keyIngredients[0]).replace(/\s+/g, " ").trim()];
    delete attributes["Key Ingredients"];
    return {
      product: { ...product, attributes },
      changed: true,
      source: "key_ingredients",
    };
  }

  const joinedKey = keyIngredients.map((value) => value.trim()).filter(Boolean).join(", ");
  if (keyIngredients.length > 1 && looksLikeFullInciText(joinedKey)) {
    attributes["Full INCI"] = [joinedKey];
    delete attributes["Key Ingredients"];
    return {
      product: { ...product, attributes },
      changed: true,
      source: "key_ingredients",
    };
  }

  return { product: { ...product, attributes }, changed: false, source: "unchanged" };
}
