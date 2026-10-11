const RTF_WORD_RE = /\\'[0-9a-fA-F]{2}|\\[a-zA-Z]+\-?\d*\s?/g;
const TRAILING_URL_RE = /https?:\/\/[^\s<"'\\]+/i;

export function hasRtfMarkup(value: string | undefined): boolean {
  return typeof value === "string" && /\\[a-zA-Z]+\d*/.test(value);
}

export function stripRtfControlWords(value: string): string {
  if (!value || !value.includes("\\")) return value;
  return value.replace(RTF_WORD_RE, "").replace(/[{}]/g, "");
}

export function peelTrailingRtfLink(value: string): {
  text: string;
  label?: string;
  url?: string;
} {
  const stripped = stripRtfControlWords(value).replace(/\u00a0/g, " ");
  const urlMatch = stripped.match(/(https?:\/\/[^\s<"'\\]+)(?![\s\S]*https?:\/\/)/i);
  if (!urlMatch || urlMatch.index === undefined) {
    return { text: collapseEmptyHtml(stripped) };
  }

  const after = stripped.slice(urlMatch.index + urlMatch[0].length);
  if (after.replace(/<[^>]+>/g, "").trim()) {
    return { text: collapseEmptyHtml(stripped) };
  }

  let before = stripped.slice(0, urlMatch.index);
  const labelMatch = before.match(/(?:<p[^>]*>)?\s*([^<>]{3,80})\s*(?:<\/p>)?\s*$/);
  let label: string | undefined;
  if (labelMatch && !TRAILING_URL_RE.test(labelMatch[1])) {
    label = labelMatch[1].replace(/\s+/g, " ").trim();
    before = before.slice(0, before.length - labelMatch[0].length);
  }

  return {
    text: collapseEmptyHtml(before + after),
    label,
    url: urlMatch[0].replace(/[.,);]+$/, ""),
  };
}

function collapseEmptyHtml(value: string): string {
  return value
    .replace(/<p[^>]*>\s*<\/p>/gi, "")
    .replace(/(<br\s*\/?>\s*){2,}/gi, "<br>")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanNewsletterCopy(value: string | undefined): string {
  if (!value) return "";
  return collapseEmptyHtml(stripRtfControlWords(value));
}
