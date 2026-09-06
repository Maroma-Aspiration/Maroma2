import { decodeBasicHtmlEntities } from "./decode-html-entities";

const INDIA_ONLY_IN_NAME_RE =
  /\s*[\(\[]\s*only\s+for\s+sale\s+in\s+india\s*[\)\]]\s*/i;
const QUOTE_CHARS = `"'«»\u2018\u2019\u201C\u201D\u201E\u201F\u2039\u203A`;
const NOT_FOR_INTERNATIONAL_RE = new RegExp(
  `[${QUOTE_CHARS}]*\\s*not\\s+for\\s+international\\s*[${QUOTE_CHARS}]*`,
  "gi"
);
const SALE_IN_INDIA_ONLY_RE =
  /\s*[\(\[]?\s*(?:only\s+)?for\s+sale\s+in\s+india\s+only\s*[\)\]]?\s*/gi;
const SHORT_DESCRIPTION_TAIL_MARKERS = ["KEY INGREDIENTS", "KEY INGREDIENT"];
const INTERNATIONAL_RESTRICTION_RE = /not\s+for\s+international/i;
const UK_AND_CHANNEL_ISLANDS_RE = /\s*not\s+for\s+sale\s+in\s+the\s+uk\s+and\s+channel\s+islands\.?\s*/gi;

function normalizeCatalogText(text: string): string {
  return decodeBasicHtmlEntities(text || "")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();
}

function stripShortDescriptionTail(text: string): string {
  let result = text;
  for (const marker of SHORT_DESCRIPTION_TAIL_MARKERS) {
    const index = result.toUpperCase().indexOf(marker);
    if (index !== -1) {
      result = result.slice(0, index).trim();
    }
  }
  return result;
}

export function stripIndiaOnlyFromProductName(name: string): {
  displayName: string;
  indiaOnlyNote: string | null;
} {
  const decoded = decodeBasicHtmlEntities(name || "").trim();
  if (!INDIA_ONLY_IN_NAME_RE.test(decoded)) {
    return { displayName: decoded, indiaOnlyNote: null };
  }

  const displayName = decoded
    .replace(INDIA_ONLY_IN_NAME_RE, "")
    .replace(/\s+-\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return {
    displayName: displayName || decoded,
    indiaOnlyNote: "Only for sale in India",
  };
}

function stripOrphanQuotes(text: string): string {
  const quoteClass = `[${QUOTE_CHARS}]`;
  return text
    .replace(new RegExp(`^\\s*${quoteClass}+\\s*$`, "gm"), "")
    .replace(new RegExp(`\\n\\s*${quoteClass}{1,4}\\s*(?=\\n|$)`, "g"), "\n")
    .replace(new RegExp(`\\s+${quoteClass}{2,}\\s*`, "g"), " ")
    .replace(new RegExp(`\\s+${quoteClass}\\s*${quoteClass}\\s*`, "g"), " ")
    .trim();
}

function finalizeCatalogText(text: string): string {
  return stripOrphanQuotes(
    text
      .split("\n")
      .map((line) => line.replace(/\s{2,}/g, " ").trim())
      .filter(Boolean)
      .join("\n\n")
  );
}

export function cleanProductSaleRegionCopy(
  text: string,
  options: { suppressInternationalNote?: boolean } = {}
): string {
  let result = normalizeCatalogText(text);
  result = stripShortDescriptionTail(result);

  if (options.suppressInternationalNote) {
    result = result.replace(NOT_FOR_INTERNATIONAL_RE, "");
    result = result.replace(SALE_IN_INDIA_ONLY_RE, "");
  }
  result = result.replace(UK_AND_CHANNEL_ISLANDS_RE, "");

  return finalizeCatalogText(result);
}

export function deriveProductPdpCopy(name: string, shortDescription: string): {
  displayName: string;
  subtitleText: string;
} {
  const { displayName, indiaOnlyNote } = stripIndiaOnlyFromProductName(name);
  const showIndiaOnlyNote = Boolean(indiaOnlyNote);

  let body = cleanProductSaleRegionCopy(shortDescription, {
    suppressInternationalNote: showIndiaOnlyNote,
  });

  if (showIndiaOnlyNote) {
    const note = indiaOnlyNote ?? "Only for sale in India";
    body = body ? `${body}\n\n${note}` : note;
  }

  return { displayName, subtitleText: body };
}
