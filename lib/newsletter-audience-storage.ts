import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import type {
  NewsletterAudienceState,
  NewsletterCampaignMetrics,
  NewsletterCampaignSummary,
  NewsletterSubscriber
} from "./newsletter-audience-types";
import { verifyTrackingToken } from "./newsletter-tracking";

const storageDir = path.join(process.cwd(), "data");
const storagePath = path.join(storageDir, "newsletter-audience.json");
const audienceKvKey = "maroma:newsletter-audience";
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const MAX_CAMPAIGNS = 60;

const defaultState: NewsletterAudienceState = {
  subscribers: [],
  campaigns: []
};

const normalizeSubscriber = (raw: Partial<NewsletterSubscriber>): NewsletterSubscriber | null => {
  const email = (raw.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  const now = new Date().toISOString();
  const unsub =
    typeof raw.unsubscribedAt === "string" && raw.unsubscribedAt.trim() ? raw.unsubscribedAt.trim() : undefined;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
    email,
    name: (raw.name ?? "").trim(),
    subscribedAt: typeof raw.subscribedAt === "string" ? raw.subscribedAt : now,
    unsubscribedAt: unsub
  };
};

const normalizeCampaign = (raw: Partial<NewsletterCampaignMetrics>): NewsletterCampaignMetrics | null => {
  const id = typeof raw.id === "string" ? raw.id : "";
  const subject = typeof raw.subject === "string" ? raw.subject : "";
  const sentAt = typeof raw.sentAt === "string" ? raw.sentAt : "";
  if (!id || !sentAt) {
    return null;
  }
  const openSubscriberIds = Array.isArray(raw.openSubscriberIds)
    ? raw.openSubscriberIds.filter((x): x is string => typeof x === "string")
    : [];
  const clickSubscriberIds = Array.isArray(raw.clickSubscriberIds)
    ? raw.clickSubscriberIds.filter((x): x is string => typeof x === "string")
    : [];
  const unsubscribeSubscriberIds = Array.isArray(raw.unsubscribeSubscriberIds)
    ? raw.unsubscribeSubscriberIds.filter((x): x is string => typeof x === "string")
    : [];
  return {
    id,
    subject,
    sentAt,
    recipientCount: typeof raw.recipientCount === "number" && raw.recipientCount >= 0 ? raw.recipientCount : 0,
    openSubscriberIds,
    clickCount: typeof raw.clickCount === "number" && raw.clickCount >= 0 ? raw.clickCount : 0,
    clickSubscriberIds,
    unsubscribeSubscriberIds
  };
};

const parseAudienceState = (value: unknown): NewsletterAudienceState => {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const subs = Array.isArray(raw.subscribers)
    ? (raw.subscribers
        .map((s) => normalizeSubscriber(s as Partial<NewsletterSubscriber>))
        .filter(Boolean) as NewsletterSubscriber[])
    : [];
  const byEmail = new Map<string, NewsletterSubscriber>();
  for (const s of subs) {
    byEmail.set(s.email, s);
  }
  const subscribers = Array.from(byEmail.values());

  const campaignsRaw = Array.isArray(raw.campaigns) ? raw.campaigns : [];
  const campaigns = campaignsRaw
    .map((c) => normalizeCampaign(c as Partial<NewsletterCampaignMetrics>))
    .filter(Boolean) as NewsletterCampaignMetrics[];

  return { subscribers, campaigns: campaigns.slice(-MAX_CAMPAIGNS) };
};

export async function readNewsletterAudience(): Promise<NewsletterAudienceState> {
  if (hasKvConfig) {
    try {
      const stored = await kv.get(audienceKvKey);
      if (stored) {
        return parseAudienceState(stored);
      }
    } catch {
      // fall through
    }
  }
  try {
    const raw = await fs.readFile(storagePath, "utf8");
    return parseAudienceState(JSON.parse(raw));
  } catch {
    return defaultState;
  }
}

export async function writeNewsletterAudience(state: NewsletterAudienceState): Promise<NewsletterAudienceState> {
  const parsed = parseAudienceState(state);
  if (hasKvConfig) {
    try {
      await kv.set(audienceKvKey, parsed);
      return parsed;
    } catch {
      // fall through
    }
  }
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(parsed, null, 2), "utf8");
  return parsed;
}

export function summarizeCampaigns(campaigns: NewsletterCampaignMetrics[]): NewsletterCampaignSummary[] {
  return [...campaigns]
    .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1))
    .map((c) => ({
      id: c.id,
      subject: c.subject,
      sentAt: c.sentAt,
      recipientCount: c.recipientCount,
      uniqueOpens: c.openSubscriberIds.length,
      totalClicks: c.clickCount,
      uniqueClickers: c.clickSubscriberIds.length,
      unsubscribes: c.unsubscribeSubscriberIds.length
    }));
}

export async function mergeNewsletterSubscribers(
  incoming: { email: string; name?: string }[]
): Promise<{ state: NewsletterAudienceState; added: number; updated: number }> {
  const state = await readNewsletterAudience();
  const byEmail = new Map(state.subscribers.map((s) => [s.email, { ...s }]));
  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();
  for (const row of incoming) {
    const norm = normalizeSubscriber({ email: row.email, name: row.name ?? "" });
    if (!norm) {
      continue;
    }
    const prev = byEmail.get(norm.email);
    if (!prev) {
      byEmail.set(norm.email, { ...norm, subscribedAt: now });
      added += 1;
      continue;
    }
    if (prev.unsubscribedAt) {
      if (norm.name && norm.name !== prev.name) {
        byEmail.set(norm.email, { ...prev, name: norm.name });
        updated += 1;
      }
      continue;
    }
    const nextName = norm.name || prev.name;
    if (nextName !== prev.name) {
      byEmail.set(norm.email, { ...prev, name: nextName });
      updated += 1;
    }
  }
  const next: NewsletterAudienceState = {
    subscribers: Array.from(byEmail.values()),
    campaigns: state.campaigns
  };
  await writeNewsletterAudience(next);
  return { state: next, added, updated };
}

export async function appendCampaign(campaign: NewsletterCampaignMetrics): Promise<NewsletterAudienceState> {
  const state = await readNewsletterAudience();
  const campaigns = [...state.campaigns.filter((c) => c.id !== campaign.id), campaign].slice(-MAX_CAMPAIGNS);
  return writeNewsletterAudience({ ...state, campaigns });
}

function findCampaign(state: NewsletterAudienceState, campaignId: string): NewsletterCampaignMetrics | undefined {
  return state.campaigns.find((c) => c.id === campaignId);
}

export async function recordNewsletterOpen(campaignId: string, subscriberId: string): Promise<void> {
  const state = await readNewsletterAudience();
  const c = findCampaign(state, campaignId);
  if (!c) {
    return;
  }
  if (!c.openSubscriberIds.includes(subscriberId)) {
    c.openSubscriberIds.push(subscriberId);
  }
  await writeNewsletterAudience(state);
}

export async function recordNewsletterClick(campaignId: string, subscriberId: string): Promise<void> {
  const state = await readNewsletterAudience();
  const c = findCampaign(state, campaignId);
  if (!c) {
    return;
  }
  c.clickCount += 1;
  if (!c.clickSubscriberIds.includes(subscriberId)) {
    c.clickSubscriberIds.push(subscriberId);
  }
  await writeNewsletterAudience(state);
}

export async function recordNewsletterUnsubscribe(campaignId: string, subscriberId: string): Promise<void> {
  const state = await readNewsletterAudience();
  const sub = state.subscribers.find((s) => s.id === subscriberId);
  if (sub && !sub.unsubscribedAt) {
    sub.unsubscribedAt = new Date().toISOString();
  }
  const c = findCampaign(state, campaignId);
  if (c && !c.unsubscribeSubscriberIds.includes(subscriberId)) {
    c.unsubscribeSubscriberIds.push(subscriberId);
  }
  await writeNewsletterAudience(state);
}

export type UnsubscribeResult = { ok: true } | { ok: false; reason: "invalid" | "expired" | "missing_secret" };

export async function unsubscribeFromSignedToken(token: string, secret: string | undefined): Promise<UnsubscribeResult> {
  if (!secret) {
    return { ok: false, reason: "missing_secret" };
  }
  const payload = verifyTrackingToken(token, secret);
  if (!payload || payload.typ !== "u") {
    return { ok: false, reason: "invalid" };
  }
  await recordNewsletterUnsubscribe(payload.cid, payload.sid);
  return { ok: true };
}

export function countActiveSubscribers(subscribers: NewsletterSubscriber[]): number {
  return subscribers.filter((s) => !s.unsubscribedAt).length;
}
