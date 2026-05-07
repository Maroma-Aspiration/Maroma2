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
