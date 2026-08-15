/**
 * Promote FULL INGREDIENT LIST from descriptions (and any misplaced Key Ingredients
 * formulas) into attributes["Full INCI"] in maroma-products.json.
 *
 * Usage: node scripts/migrate-inci-fields.mjs
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productDataPath = path.join(__dirname, "..", "data", "maroma-products.json");

const INCI_ATTR_KEYS = [
  "Full INCI",
  "INCI",
  "Full Ingredient List",
  "Ingredients",
  "Ingredient List",
];

function cleanCatalogueMarkup(text) {
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

function firstFilledAttribute(attributes, keys) {
  for (const key of keys) {
    const values = attributes[key];
    if (!values?.length) continue;
    const joined = values.map((value) => String(value).trim()).filter(Boolean).join(", ");
    if (joined) return joined;
  }
  return null;
}

function looksLikeFullInciText(text) {
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

function extractFullInciFromDescription(description) {
  const body = cleanCatalogueMarkup(description);
  const match = body.match(
    /(?:FULL\s+INGREDIENT\s+LIST|INGREDIENT\s+LIST)\s*[:\-]?\s*([\s\S]+)/i
  );
  const extracted = match?.[1]?.trim() ?? "";
  if (!extracted) return null;
  if (extracted.replace(/[^a-z0-9]/gi, "").length < 24) return null;
  return extracted.replace(/\s+/g, " ").trim();
}

function normalizeProductInciFields(product) {
  const attributes = { ...(product.attributes ?? {}) };
  const existing = firstFilledAttribute(attributes, INCI_ATTR_KEYS);
  if (existing && existing.trim().length >= 12) {
    if (!attributes["Full INCI"]?.some((value) => String(value).trim())) {
      attributes["Full INCI"] = [existing];
      return { product: { ...product, attributes }, changed: true, source: "existing_attr" };
    }
    return { product: { ...product, attributes }, changed: false, source: "unchanged" };
  }

  const fromDescription = extractFullInciFromDescription(product.description ?? "");
  if (fromDescription) {
    attributes["Full INCI"] = [fromDescription];
    return { product: { ...product, attributes }, changed: true, source: "description" };
  }

  const keyIngredients = attributes["Key Ingredients"] ?? [];
  if (keyIngredients.length === 1 && looksLikeFullInciText(keyIngredients[0])) {
    attributes["Full INCI"] = [cleanCatalogueMarkup(keyIngredients[0]).replace(/\s+/g, " ").trim()];
    delete attributes["Key Ingredients"];
    return { product: { ...product, attributes }, changed: true, source: "key_ingredients" };
  }

  const joinedKey = keyIngredients.map((value) => String(value).trim()).filter(Boolean).join(", ");
  if (keyIngredients.length > 1 && looksLikeFullInciText(joinedKey)) {
    attributes["Full INCI"] = [joinedKey];
    delete attributes["Key Ingredients"];
    return { product: { ...product, attributes }, changed: true, source: "key_ingredients" };
  }

  return { product: { ...product, attributes }, changed: false, source: "unchanged" };
}

const raw = await fs.readFile(productDataPath, "utf8");
const products = JSON.parse(raw);
if (!Array.isArray(products)) {
  throw new Error("Expected maroma-products.json to be an array");
}

let changed = 0;
let fromDescription = 0;
let fromKeyIngredients = 0;
let fromExisting = 0;

const next = products.map((product) => {
  const result = normalizeProductInciFields(product);
  if (result.changed) {
    changed += 1;
    if (result.source === "description") fromDescription += 1;
    if (result.source === "key_ingredients") fromKeyIngredients += 1;
    if (result.source === "existing_attr") fromExisting += 1;
  }
  return result.product;
});

await fs.writeFile(productDataPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      total: products.length,
      changed,
      fromDescription,
      fromKeyIngredients,
      fromExisting,
      withFullInci: next.filter((p) => (p.attributes?.["Full INCI"] || []).some(Boolean)).length,
    },
    null,
    2
  )
);
