import { createHash } from "crypto";
import { normalizeStory } from "./story-storage";
import type { StoryRecord } from "./story-types";

/** Deterministic story id so re-running RSS import updates the same row. */
export function rssStoryId(feedUrl: string, itemLink: string): string {
  const h = createHash("sha256").update(`${feedUrl}\n${itemLink}`, "utf8").digest("hex");
  return `rss-${h.slice(0, 32)}`;
}

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const stripCdata = (s: string): string => {
  const m = s.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return m ? m[1].trim() : s.trim();
};

const stripTags = (html: string): string =>
  decodeEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

const firstImgSrc = (html: string): string => {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1]?.trim() ?? "";
};

const enclosureUrl = (block: string): string => {
  const m = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  return m?.[1]?.trim() ?? "";
};

const mediaContentUrl = (block: string): string => {
  const m = block.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  return m?.[1]?.trim() ?? "";
};

function parseDate(value: string): string | null {
  const t = Date.parse(value);
  if (Number.isNaN(t)) {
    return null;
  }
  return new Date(t).toISOString();
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m?.[1]) {
    return "";
  }
  return stripCdata(m[1].trim());
}

/** RSS 2.0 channel items */
function parseRss2Items(xml: string): string[] {
  const items: string[] = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    items.push(m[1]);
  }
  return items;
}

/** Atom 1.0 entries */
function parseAtomEntries(xml: string): string[] {
  const entries: string[] = [];
  const re = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    entries.push(m[1]);
  }
  return entries;
}

function parseRss2Item(feedUrl: string, block: string): StoryRecord | null {
  const title = extractTag(block, "title") || "Feed item";
  let link = extractTag(block, "link");
  const guid = extractTag(block, "guid");
  if (!link && guid?.startsWith("http")) {
    link = guid;
  }
  if (!link) {
    return null;
  }
  const description = extractTag(block, "description") || extractTag(block, "content:encoded") || "";
  const pubRaw = extractTag(block, "pubDate") || extractTag(block, "dc:date");
  const publishedAt = parseDate(pubRaw) ?? new Date().toISOString();
  const excerpt = stripTags(description).slice(0, 360) || title;
  const imageUrl =
    mediaContentUrl(block) ||
    enclosureUrl(block) ||
    firstImgSrc(description) ||
    "";
  const id = rssStoryId(feedUrl, link);
  const body = [
    title,
    "",
    excerpt,
    "",
    `Imported from RSS feed.`,
    "",
    `Source: ${link}`,
    "",
    ...(description && stripTags(description) !== excerpt ? [`Full text (HTML stripped):`, stripTags(description)] : [])
  ].join("\n");

  return normalizeStory({
    id,
    title,
    excerpt,
    body,
    imageUrl,
    sourceUrl: link,
    source: "rss",
    ctaLabel: "View original",
    ctaUrl: link,
    publishedAt,
    featured: false
  });
}

function parseAtomEntry(feedUrl: string, block: string): StoryRecord | null {
  const title = extractTag(block, "title") || "Feed item";
  let link = "";
  const relAlt = block.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  const hrefAlt = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']alternate["'][^>]*\/?>/i);
  const anyLink =
    block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  link = (relAlt?.[1] ?? hrefAlt?.[1] ?? anyLink?.[1] ?? "").trim();
  if (!link) {
    return null;
  }
  const summary = extractTag(block, "summary") || extractTag(block, "content") || "";
  const updated = extractTag(block, "updated") || extractTag(block, "published");
  const publishedAt = parseDate(updated) ?? new Date().toISOString();
  const excerpt = stripTags(summary).slice(0, 360) || title;
  const imageUrl = firstImgSrc(summary) || mediaContentUrl(block) || "";
  const id = rssStoryId(feedUrl, link);
  const body = [
    title,
    "",
    excerpt,
    "",
    `Imported from Atom/RSS feed.`,
    "",
    `Source: ${link}`,
    "",
    ...(summary ? [`Summary:`, stripTags(summary)] : [])
  ].join("\n");

  return normalizeStory({
    id,
    title,
    excerpt,
    body,
    imageUrl,
    sourceUrl: link,
    source: "rss",
    ctaLabel: "View original",
    ctaUrl: link,
    publishedAt,
    featured: false
  });
}

const MAX_ITEMS_PER_FEED = 30;

/** Fetch one feed URL and return story drafts (deduped by id upstream). */
export async function importStoriesFromRssFeed(feedUrl: string): Promise<StoryRecord[]> {
  const response = await fetch(feedUrl, {
    headers: {
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      "User-Agent": "Mozilla/5.0 (compatible; MaromaRSSReader/1.0)"
    },
    cache: "no-store"
  });
  if (!response.ok) {
    return [];
  }
  const xml = await response.text();
  const out: StoryRecord[] = [];

  if (/<feed\b[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(xml) || /<entry\b/i.test(xml)) {
    const blocks = parseAtomEntries(xml);
    for (const block of blocks.slice(0, MAX_ITEMS_PER_FEED)) {
      const story = parseAtomEntry(feedUrl, block);
      if (story) {
        out.push(story);
      }
    }
    return out;
  }

  const blocks = parseRss2Items(xml);
  for (const block of blocks.slice(0, MAX_ITEMS_PER_FEED)) {
    const story = parseRss2Item(feedUrl, block);
    if (story) {
      out.push(story);
    }
  }
  return out;
}

export async function importStoriesFromRssFeeds(feedUrls: string[]): Promise<StoryRecord[]> {
  const unique = Array.from(new Set(feedUrls.map((u) => u.trim()).filter(Boolean)));
  const all: StoryRecord[] = [];
  for (const url of unique) {
    try {
      const batch = await importStoriesFromRssFeed(url);
      all.push(...batch);
    } catch {
      // Skip unreachable or invalid feeds.
    }
  }
  return all;
}
