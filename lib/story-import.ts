import { normalizeStory } from "./story-storage";
import type { StoryRecord, StorySource } from "./story-types";
import { webStoryFingerprint } from "./story-web-search";

const decode = (value: string): string => {
  let s = value;
  s = s.replace(/&#x([0-9a-f]+);/gi, (full, hex: string) => {
    const cp = Number.parseInt(hex, 16);
    return Number.isFinite(cp) && cp <= 0x10ffff ? String.fromCodePoint(cp) : full;
  });
  s = s.replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
};

const textFromMeta = (html: string, name: string): string => {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["'][^>]*>`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decode(match[1].trim());
    }
  }
  return "";
};

const titleFromHtml = (html: string): string => {
  const metaTitle = textFromMeta(html, "og:title");
  if (metaTitle) {
    return metaTitle;
  }
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch?.[1]?.trim() ?? "";
};

const sourceFromUrl = (url: string): StorySource => {
  if (url.includes("instagram.com")) {
    return "instagram";
  }
  if (url.includes("facebook.com")) {
    return "facebook";
  }
  return "web";
};

const buildBody = (title: string, excerpt: string, sourceUrl: string, source: StorySource): string => {
  const sourceLabel = source === "instagram" ? "Instagram" : source === "facebook" ? "Facebook" : "the web";
  return [
    `${title}`,
    "",
    excerpt || "A fresh update from Maroma community and brand channels.",
    "",
    `This story is automatically drafted from ${sourceLabel}.`,
    "",
    `Source: ${sourceUrl}`
  ].join("\n");
};

export async function importStoriesFromUrls(urls: string[]): Promise<StoryRecord[]> {
  const unique = Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)));
  const imported: StoryRecord[] = [];
  for (const url of unique) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MaromaStoryBot/1.0)"
        },
        cache: "no-store"
      });
      const html = await response.text();
      const title = titleFromHtml(html) || "Maroma social update";
      const excerpt =
        textFromMeta(html, "og:description") ||
        textFromMeta(html, "description") ||
        "A new story from Maroma channels.";
      const imageUrl = textFromMeta(html, "og:image");
      const source = sourceFromUrl(url);
      const fp = webStoryFingerprint(url);
      imported.push(
        normalizeStory({
          id: fp.id,
          slug: fp.slugSeed,
          title,
          excerpt,
          body: buildBody(title, excerpt, url, source),
          imageUrl,
          sourceUrl: url,
          source,
          ctaLabel: "View story",
          ctaUrl: url,
          publishedAt: new Date().toISOString(),
          featured: false
        })
      );
    } catch {
      // Skip URLs that cannot be fetched server-side.
    }
  }
  return imported;
}
