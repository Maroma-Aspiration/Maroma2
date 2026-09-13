import { decodeBasicHtmlEntities } from "./decode-html-entities";
import { cleanProductSaleRegionCopy, stripIndiaOnlyFromProductName } from "./product-sale-region";
import type { ProductRecord } from "./product-types";

const normalizeNewlines = (text: string): string =>
  decodeBasicHtmlEntities(text || "")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\[\/?bg_collapse[^\]]*\]/gi, "")
    .trim();

const sliceAfter = (text: string, marker: string): string => {
  const index = text.indexOf(marker);
  if (index === -1) {
    return "";
  }
  return text.slice(index + marker.length).trim();
};

const sliceUntil = (text: string, markers: string[]): string => {
  let shortest = text.length;
  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index !== -1 && index < shortest) {
      shortest = index;
    }
  }
  return text.slice(0, shortest).trim();
};

/** Key ingredients already have their own PDP section. Remove only standalone
 * ingredient lines from descriptive copy; never remove prose sentences. */
const removeStandaloneKeyIngredientLines = (text: string, items: string[]): string => {
  const names = new Set(items.map((item) => item.replace(/\s+/g, " ").trim().toLowerCase()).filter(Boolean));
  if (!names.size) return text;
  return text
    .split("\n")
    .filter((line) => !names.has(line.replace(/[•·,;]+$/g, "").replace(/\s+/g, " ").trim().toLowerCase()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

/** Legacy catalogue copy often appends a complete ingredient list after this
 * heading. The list belongs in the dedicated ingredient section, never in the
 * shopper-facing summary. */
const removeLegacyIngredientBlock = (text: string): string =>
  text
    .replace(/(?:\n\s*)?KEY\s+INGREDIENTS\b[\s\S]*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export type PdpAccordionSections = {
  description: string;
  ingredients: string;
  benefits: string[];
  howToUse: string;
};

/** Catalogue benefits often arrive as one paragraph. Split into shopper-facing bullets. */
export function splitBenefitBullets(text: string): string[] {
  const cleaned = text
    .replace(/\u2022/g, "\n")
    .replace(/^[•·\-*]+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  const fromLines = text
    .split(/\n+/)
    .map((line) => line.replace(/^[•·\-*]+\s*/, "").trim())
    .filter(Boolean);
  if (fromLines.length > 1) return fromLines;
  const sentences = cleaned.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((item) => item.trim()).filter(Boolean);
  return sentences.length ? sentences : [cleaned];
}

export function derivePdpSections(product: ProductRecord): PdpAccordionSections {
  const { indiaOnlyNote } = stripIndiaOnlyFromProductName(product.name);
  const hasInternationalRestriction = /not\s+for\s+international/i.test(product.shortDescription);
  const suppressInternationalNote = Boolean(indiaOnlyNote || hasInternationalRestriction);

  const body = cleanProductSaleRegionCopy(normalizeNewlines(product.description), {
    suppressInternationalNote,
  });
  const short = cleanProductSaleRegionCopy(normalizeNewlines(product.shortDescription), {
    suppressInternationalNote,
  });

  let benefits = "";
  if (body.includes("BENEFITS")) {
    const after = sliceAfter(body, "BENEFITS");
    benefits = sliceUntil(after, ["HOW TO USE", "FULL INGREDIENT LIST", "INGREDIENT LIST"]).trim();
  }

  let howToUse = "";
  if (body.includes("HOW TO USE")) {
    howToUse = sliceUntil(sliceAfter(body, "HOW TO USE"), [
      "FULL INGREDIENT LIST",
      "INGREDIENT LIST",
      "BENEFITS",
    ]).trim();
  }

  const fullIngredients =
    product.attributes["Full INCI"] ??
    product.attributes["INCI"] ??
    product.attributes["Full Ingredient List"] ??
    product.attributes["Ingredients"];
  let ingredients = fullIngredients?.filter(Boolean).join(", ").trim() ?? "";
  if (!ingredients && body.includes("FULL INGREDIENT LIST")) {
    ingredients = sliceAfter(body, "FULL INGREDIENT LIST").trim();
  } else if (!ingredients && body.includes("INGREDIENT LIST")) {
    ingredients = sliceAfter(body, "INGREDIENT LIST").trim();
  }

  let description = short;
  if (body) {
    let intro = body;
    if (body.includes("BENEFITS")) {
      intro = body.slice(0, body.indexOf("BENEFITS")).trim();
    } else if (body.includes("HOW TO USE")) {
      intro = body.slice(0, body.indexOf("HOW TO USE")).trim();
    }
    if (intro && intro.length > 40) {
      description = short ? `${short}\n\n${intro}` : intro;
    } else if (!short && body) {
      description = body;
    }
  }

  if (!benefits && body) {
    benefits = sliceUntil(body, ["HOW TO USE", "FULL INGREDIENT LIST"]).slice(0, 900).trim();
  }
  if (!benefits) {
    benefits = "See the description for how this product supports your routine.";
  }

  description = removeLegacyIngredientBlock(removeStandaloneKeyIngredientLines(description, product.attributes["Key Ingredients"] ?? []));

  if (!ingredients) {
    ingredients = "Full INCI ingredient list is not yet available online. Please refer to the product label or contact Maroma before purchase.";
  }

  return { description, ingredients, benefits: splitBenefitBullets(benefits), howToUse };
}
