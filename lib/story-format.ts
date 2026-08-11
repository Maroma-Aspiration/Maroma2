export function formatStoryDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

export function splitBodyToParagraphs(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Plain-text first paragraph for card previews — adds … when trimmed. */
export function truncateStoryExcerpt(text: string, maxLength = 160): string {
  const plain = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";

  const firstParagraph = plain.split(/\n\n+/)[0]?.split(/\n/)[0]?.trim() ?? plain;
  if (firstParagraph.length <= maxLength) return firstParagraph;

  const slice = firstParagraph.slice(0, maxLength).trim();
  const lastSpace = slice.lastIndexOf(" ");
  const trimmed = lastSpace > maxLength * 0.55 ? slice.slice(0, lastSpace) : slice;
  return `${trimmed}…`;
}
