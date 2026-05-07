import { createHash } from "crypto";

export type WebSearchResult = {
  urls: string[];
  provider: string;
  /** Hint when no API keys configured */
  hint?: string;
};

const MAX_RETURN = 20;

function dedupeNormalizeUrls(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let u of raw) {
    u = u.trim();
    if (!u || !/^https?:\/\//i.test(u)) {
      continue;
    }
    try {
      const parsed = new URL(u);
      if (parsed.hostname === "duckduckgo.com" || parsed.hostname === "www.google.com") {
        continue;
      }
      const key = `${parsed.origin}${parsed.pathname}${parsed.search}`.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(parsed.href);
    } catch {
      // skip invalid
    }
  }
  return out;
}

async function searchBrave(query: string, max: number): Promise<string[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!key) {
    return [];
  }
  const url = new URL("https://api.search.brave.com/res/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(Math.min(max, 20)));
  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": key,
      "User-Agent": "MaromaStoriesBot/1.0"
    },
    cache: "no-store"
  });
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as { web?: { results?: Array<{ url?: string }> } };
  const results = data.web?.results ?? [];
  return results.map((r) => r.url ?? "").filter(Boolean);
}

async function searchGoogleCustom(query: string, max: number): Promise<string[]> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY?.trim();
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_CX?.trim();
  if (!apiKey || !cx) {
    return [];
  }
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(max, 10)));
  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as { items?: Array<{ link?: string }> };
  return (data.items ?? []).map((i) => i.link ?? "").filter(Boolean);
}

/** DuckDuckGo lite HTML — best-effort when no API keys (may rate-limit). */
async function searchDuckDuckGoLite(query: string, max: number): Promise<string[]> {
  const body = new URLSearchParams();
  body.set("q", query);

  const response = await fetch("https://lite.duckduckgo.com/lite/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    },
    body: body.toString(),
    cache: "no-store"
  });
  if (!response.ok) {
    return [];
  }
  const html = await response.text();
  const urls: string[] = [];
  const re = /uddg=([^&"'<>]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && urls.length < max * 2) {
    try {
      const decoded = decodeURIComponent(m[1].replace(/\+/g, "%20"));
      if (decoded.startsWith("http")) {
        urls.push(decoded);
      }
    } catch {
      // skip
    }
  }
  return urls.slice(0, max);
}

/**
 * Discover article URLs for a query. Prefer Brave or Google Custom Search env vars; fallback DDG lite.
 */
export async function discoverUrlsForQuery(query: string, maxResults = 12): Promise<WebSearchResult> {
  const max = Math.min(Math.max(1, maxResults), MAX_RETURN);
  const trimmed = query.trim();
  if (!trimmed) {
    return { urls: [], provider: "none", hint: "Empty search query." };
  }

  let urls = await searchBrave(trimmed, max);
  let provider = "brave";

  if (urls.length === 0) {
    urls = await searchGoogleCustom(trimmed, max);
    provider = "google-custom-search";
  }

  if (urls.length === 0) {
    urls = await searchDuckDuckGoLite(trimmed, max);
    provider = "duckduckgo-lite";
  }

  const normalized = dedupeNormalizeUrls(urls).slice(0, max);

  if (normalized.length === 0) {
    return {
      urls: [],
      provider: "none",
      hint:
        "No results returned. Set BRAVE_SEARCH_API_KEY (Brave Search API) or GOOGLE_CUSTOM_SEARCH_API_KEY + GOOGLE_CUSTOM_SEARCH_CX on Vercel for reliable search; otherwise DuckDuckGo lite may block datacenter IPs."
    };
  }

  return { urls: normalized, provider };
}

export function webStoryFingerprint(url: string): { id: string; slugSeed: string } {
  const h = createHash("sha256").update(url.trim(), "utf8").digest("hex");
  return {
    id: `web-${h.slice(0, 40)}`,
    slugSeed: `mention-${h.slice(0, 18)}`
  };
}
