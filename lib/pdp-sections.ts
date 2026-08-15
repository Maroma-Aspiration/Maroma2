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

export type PdpAccordionSections = {
  description: string;
  ingredients: string;
  benefits: string;
  howToUse: string;
};

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

  if (!ingredients) {
    ingredients = "Full INCI ingredient list is not yet available online. Please refer to the product label or contact Maroma before purchase.";
  }

  return { description, ingredients, benefits, howToUse };
}
