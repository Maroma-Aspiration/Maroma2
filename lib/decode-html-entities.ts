/** Decode common entities from WooCommerce / CSV exports (no full HTML parser). */
export function decodeBasicHtmlEntities(text: string): string {
  if (!text) {
    return text;
  }
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\\t/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/gi, "'");
}
