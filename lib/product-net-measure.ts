import { decodeBasicHtmlEntities } from "./decode-html-entities";
import type { ProductRecord } from "./product-types";

export type ProductNetMeasure = {
  label: "Net volume" | "Net weight" | "Contents";
  value: string;
};

const MEASURE_RE =
  /(\d+(?:[.,]\d+)?)\s*(fl\.?\s*oz|ml|cl|l|ltr|litres?|liters?|gms?|grams?|kg|oz|g)\b/gi;
const COUNT_RE =
  /(?:pack of\s+(\d+)|(\d+)\s*(?:sticks?|cones?|sachets?|pcs|pieces|units|leaves|flowers?))/i;

const VOLUME_UNITS = new Set(["ml", "cl", "l", "ltr", "litre", "litres", "liter", "liters", "floz"]);
const WEIGHT_UNITS = new Set(["g", "gm", "gms", "gram", "grams", "kg", "oz"]);

function normalizeUnit(raw: string): string {
  const unit = raw.toLowerCase().replace(/\s+/g, "").replace(/\./g, "");
  if (unit === "floz") return "fl oz";
  if (unit === "ltr" || unit.startsWith("liter") || unit.startsWith("litre")) return "L";
  if (unit === "gms" || unit === "gm" || unit === "gram" || unit === "grams") return "g";
  if (unit === "cl") return "cl";
  if (unit === "ml") return "ml";
  if (unit === "kg") return "kg";
  if (unit === "oz") return "oz";
  if (unit === "g") return "g";
  if (unit === "l") return "L";
  return raw;
}

function unitKind(unit: string): "volume" | "weight" | null {
  const key = unit.toLowerCase().replace(/\s+/g, "").replace(/\./g, "");
  if (VOLUME_UNITS.has(key) || key === "floz") return "volume";
  if (WEIGHT_UNITS.has(key)) return "weight";
  return null;
}

function parseMeasure(text: string): ProductNetMeasure | null {
  const clean = decodeBasicHtmlEntities(text || "");
  MEASURE_RE.lastIndex = 0;
  const match = MEASURE_RE.exec(clean);
  if (!match) return null;
  const amount = match[1].replace(",", ".");
  const unit = normalizeUnit(match[2]);
  const kind = unitKind(match[2]);
  const value = `${amount} ${unit}`;
  if (kind === "volume") return { label: "Net volume", value };
  if (kind === "weight") return { label: "Net weight", value };
  return { label: "Net weight", value };
}

function parseContents(text: string): ProductNetMeasure | null {
  const clean = decodeBasicHtmlEntities(text || "");
  const match = clean.match(COUNT_RE);
  if (!match) return null;
  if (match[1]) return { label: "Contents", value: `Pack of ${match[1]}` };
  const count = match[2];
  const unit = (match[0].match(/sticks?|cones?|sachets?|pcs|pieces|units|leaves|flowers?/i) || ["pieces"])[0];
  return { label: "Contents", value: `${count} ${unit}` };
}

function attributeText(product: ProductRecord): string {
  const keys = ["Size", "Volume", "Net Weight", "Net Volume", "Weight", "Contents", "Pack Size"];
  return keys
    .flatMap((key) => product.attributes[key] ?? [])
    .map((value) => decodeBasicHtmlEntities(value))
    .filter(Boolean)
    .join(" ");
}

export function resolveProductNetMeasure(product: ProductRecord): ProductNetMeasure {
  const sources = [
    attributeText(product),
    product.name,
    product.shortDescription,
    product.description,
    ...product.tags,
    ...product.images,
    product.imageUrl,
  ];

  for (const source of sources) {
    const measure = parseMeasure(source);
    if (measure) return measure;
  }
  for (const source of sources) {
    const contents = parseContents(source);
    if (contents) return contents;
  }

  return { label: "Net weight", value: "As marked on the pack" };
}
