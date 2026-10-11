import { uploadCanvasPublicBuffer } from "./canvas-public-upload";
import { normalizeStory } from "./story-storage";
import { stripAiCitationMarkers } from "./strip-ai-citation-markers";
import type { StoryRecord } from "./story-types";

const DEFAULT_VERSION = "v21.0";
const MEDIA_FIELDS =
  "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username,children{media_type,media_url,thumbnail_url}";

type GraphPaging = { cursors?: { after?: string }; next?: string };

type GraphMediaChild = {
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
};

type GraphMedia = GraphMediaChild & {
  id?: string;
  caption?: string;
  permalink?: string;
  timestamp?: string;
  username?: string;
  children?: { data?: GraphMediaChild[] };
};

type GraphList<T> = { data?: T[]; paging?: GraphPaging; error?: { message?: string } };

export type InstagramImportOptions = {
  days?: number;
  replaceStories?: boolean;
};

export type InstagramConfigStatus = {
  configured: boolean;
  userIdSet: boolean;
  username?: string;
  hint: string;
};

function graphVersion(): string {
  return process.env.INSTAGRAM_GRAPH_VERSION?.trim() || DEFAULT_VERSION;
}

function graphHosts(): string[] {
  const explicit = process.env.INSTAGRAM_GRAPH_HOST?.trim();
  if (explicit) return [explicit.replace(/^https?:\/\//, "").replace(/\/$/, "")];
  return ["graph.facebook.com", "graph.instagram.com"];
}

function accessToken(): string {
  return (
    process.env.INSTAGRAM_ACCESS_TOKEN?.trim() ||
    process.env.META_ACCESS_TOKEN?.trim() ||
    ""
  );
}

function configuredUserId(): string {
  return (
    process.env.INSTAGRAM_USER_ID?.trim() ||
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim() ||
    ""
  );
}

export function instagramApiConfigured(): boolean {
  return Boolean(accessToken());
}

export function instagramConfigStatus(): InstagramConfigStatus {
  const configured = instagramApiConfigured();
  return {
    configured,
    userIdSet: Boolean(configuredUserId()),
    hint: configured
      ? "Ready. This uses the Instagram Graph API for @maromaindia (or the account on the token)."
      : "Add INSTAGRAM_ACCESS_TOKEN on Vercel. The account must be a Business or Creator profile linked to a Facebook Page. Optional: INSTAGRAM_USER_ID.",
  };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function titleFromCaption(caption: string): string {
  const first = caption.split(/\n+/)[0]?.replace(/#[^\s#]+/g, " ").replace(/\s+/g, " ").trim();
  if (!first) return "Instagram update";
  if (first.length <= 90) return first;
  return `${first.slice(0, 87).replace(/\s+\S*$/, "")}...`;
}

function excerptFromCaption(caption: string): string {
  const plain = caption.replace(/\s+/g, " ").trim();
  if (plain.length <= 220) return plain;
  return `${plain.slice(0, 217).replace(/\s+\S*$/, "")}...`;
}

function captionToHtml(caption: string): string {
  const cleaned = stripAiCitationMarkers(caption).trim();
  if (!cleaned) return "<p></p>";
  return cleaned
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function imageUrlsFromMedia(item: GraphMedia): string[] {
  const urls: string[] = [];
  const add = (url?: string) => {
    const value = url?.trim() ?? "";
    if (value && !urls.includes(value)) urls.push(value);
  };
  if (item.media_type === "VIDEO") add(item.thumbnail_url || item.media_url);
  else add(item.media_url || item.thumbnail_url);
  for (const child of item.children?.data ?? []) {
    if (child.media_type === "VIDEO") add(child.thumbnail_url || child.media_url);
    else add(child.media_url || child.thumbnail_url);
  }
  return urls;
}

async function graphGet<T>(host: string, path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://${host}/${graphVersion()}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", accessToken());
  const response = await fetch(url, { cache: "no-store" });
  const json = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(json.error?.message || `Instagram API ${response.status}`);
  }
  return json;
}

async function resolveUser(host: string): Promise<{ id: string; username?: string }> {
  const configured = configuredUserId();
  if (configured) {
    try {
      const me = await graphGet<{ id?: string; username?: string }>(host, `/${configured}`, {
        fields: "id,username",
      });
      if (me.id) return { id: me.id, username: me.username };
    } catch {
      return { id: configured };
    }
    return { id: configured };
  }

  try {
    const me = await graphGet<{ id?: string; username?: string; account_type?: string }>(host, "/me", {
      fields: "id,username,account_type",
    });
    if (me.id && (me.account_type === "BUSINESS" || me.account_type === "MEDIA_CREATOR" || !me.account_type)) {
      return { id: me.id, username: me.username };
    }
  } catch {
    /* try page path */
  }

  const pages = await graphGet<
    GraphList<{ instagram_business_account?: { id?: string; username?: string } }>
  >(host, "/me/accounts", {
    fields: "instagram_business_account{id,username}",
  });
  const ig = pages.data?.map((page) => page.instagram_business_account).find((account) => account?.id);
  if (!ig?.id) {
    throw new Error("Could not find an Instagram Business account on this token. Set INSTAGRAM_USER_ID.");
  }
  return { id: ig.id, username: ig.username };
}

async function fetchRecentMedia(host: string, userId: string, sinceMs: number): Promise<GraphMedia[]> {
  const out: GraphMedia[] = [];
  let after = "";
  for (let page = 0; page < 8; page += 1) {
    const params: Record<string, string> = { fields: MEDIA_FIELDS, limit: "50" };
    if (after) params.after = after;
    const json = await graphGet<GraphList<GraphMedia>>(host, `/${userId}/media`, params);
    const batch = json.data ?? [];
    if (batch.length === 0) break;
    let olderThanWindow = false;
    for (const item of batch) {
      const stamp = item.timestamp ? Date.parse(item.timestamp) : NaN;
      if (Number.isFinite(stamp) && stamp < sinceMs) {
        olderThanWindow = true;
        continue;
      }
      out.push(item);
    }
    after = json.paging?.cursors?.after ?? "";
    if (!after || olderThanWindow) break;
  }
  return out;
}

async function rehostImage(src: string): Promise<string> {
  const response = await fetch(src, {
    cache: "no-store",
    headers: { Accept: "image/*,*/*" },
  });
  if (!response.ok) return src;
  const type = (response.headers.get("content-type") ?? "").split(";")[0].trim();
  if (type && !type.startsWith("image/")) return src;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 32) return src;
  try {
    const uploaded = await uploadCanvasPublicBuffer(
      "canvas/instagram",
      buffer,
      type.startsWith("image/") ? type : "image/jpeg",
    );
    return uploaded.url;
  } catch {
    return src;
  }
}

function mediaToStory(item: GraphMedia, hostedImages: string[]): StoryRecord | null {
  const id = item.id?.trim();
  const permalink = item.permalink?.trim();
  if (!id || !permalink) return null;
  const caption = stripAiCitationMarkers(item.caption?.trim() || "");
  const title = titleFromCaption(caption);
  const images = hostedImages.filter(Boolean);
  return normalizeStory({
    id: `ig-${id}`,
    slug: title,
    title,
    excerpt: excerptFromCaption(caption) || title,
    body: captionToHtml(caption),
    imageUrl: images[0] || "",
    images: images.length > 0 ? images : undefined,
    sourceUrl: permalink,
    source: "instagram",
    ctaLabel: "View on Instagram",
    ctaUrl: permalink,
    publishedAt: item.timestamp && !Number.isNaN(Date.parse(item.timestamp))
      ? new Date(item.timestamp).toISOString()
      : new Date().toISOString(),
    featured: false,
  });
}

export async function importInstagramStories(
  options: InstagramImportOptions = {},
): Promise<{ stories: StoryRecord[]; username?: string; scanned: number; withImages: number }> {
  if (!instagramApiConfigured()) {
    throw new Error("INSTAGRAM_ACCESS_TOKEN is not set.");
  }
  const days = Math.min(90, Math.max(1, Math.round(options.days ?? 30)));
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
  let lastError = "Instagram API request failed.";
  for (const host of graphHosts()) {
    try {
      const user = await resolveUser(host);
      const media = await fetchRecentMedia(host, user.id, sinceMs);
      const stories: StoryRecord[] = [];
      let withImages = 0;
      for (const item of media) {
        const rawImages = imageUrlsFromMedia(item);
        const hosted = [];
        for (const url of rawImages.slice(0, 8)) {
          hosted.push(await rehostImage(url));
        }
        const story = mediaToStory(item, hosted);
        if (!story) continue;
        if (story.imageUrl) withImages += 1;
        stories.push(story);
      }
      return { stories, username: user.username, scanned: media.length, withImages };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastError);
}
