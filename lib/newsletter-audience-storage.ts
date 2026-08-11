import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import type {
  NewsletterAudienceState,
  NewsletterCampaignMetrics,
  NewsletterCampaignSummary,
  NewsletterMailingList,
  NewsletterMailingListSummary,
  NewsletterSubscriber
} from "./newsletter-audience-types";
import { verifyTrackingToken } from "./newsletter-tracking";

const storageDir = path.join(process.cwd(), "data");
const storagePath = path.join(storageDir, "newsletter-audience.json");
const audienceKvKey = "maroma:newsletter-audience";
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const MAX_CAMPAIGNS = 60;

const DEFAULT_LIST_NAME = "Main list";

const defaultState: NewsletterAudienceState = {
  subscribers: [],
  mailingLists: [],
  selectedListId: null,
  campaigns: []
};

const normalizeMailingList = (raw: Partial<NewsletterMailingList>): NewsletterMailingList | null => {
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!id || !name) {
    return null;
  }
  const now = new Date().toISOString();
  const subscriberIds = Array.isArray(raw.subscriberIds)
    ? [
        ...new Set(
          raw.subscriberIds.filter(
            (x): x is string => typeof x === "string" && x.trim().length > 0
          )
        ),
      ]
    : [];
  return {
    id,
    name,
    createdAt: typeof raw.createdAt === "string" && raw.createdAt ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" && raw.updatedAt ? raw.updatedAt : now,
    subscriberIds,
  };
};

function normalizeListName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function findListByName(lists: NewsletterMailingList[], name: string): NewsletterMailingList | undefined {
  const key = normalizeListName(name).toLowerCase();
  return lists.find((list) => normalizeListName(list.name).toLowerCase() === key);
}

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

  let mailingLists = Array.isArray(raw.mailingLists)
    ? (raw.mailingLists
        .map((list) => normalizeMailingList(list as Partial<NewsletterMailingList>))
        .filter(Boolean) as NewsletterMailingList[])
    : [];

  let selectedListId =
    typeof raw.selectedListId === "string" && raw.selectedListId.trim() ? raw.selectedListId.trim() : null;

  const subscriberIds = new Set(subscribers.map((s) => s.id));
  mailingLists = mailingLists.map((list) => ({
    ...list,
    subscriberIds: list.subscriberIds.filter((id) => subscriberIds.has(id)),
  }));

  if (mailingLists.length === 0 && subscribers.length > 0) {
    const now = new Date().toISOString();
    const defaultId = crypto.randomUUID();
    mailingLists = [
      {
        id: defaultId,
        name: DEFAULT_LIST_NAME,
        createdAt: now,
        updatedAt: now,
        subscriberIds: subscribers.map((s) => s.id),
      },
    ];
    selectedListId = defaultId;
  }

  if (selectedListId && !mailingLists.some((list) => list.id === selectedListId)) {
    selectedListId = mailingLists[0]?.id ?? null;
  }
  if (!selectedListId && mailingLists.length > 0) {
    selectedListId = mailingLists[0].id;
  }

  return {
    subscribers,
    mailingLists,
    selectedListId,
    campaigns: campaigns.slice(-MAX_CAMPAIGNS),
  };
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
  const nextSubscribers = Array.from(byEmail.values());
  const next: NewsletterAudienceState = {
    subscribers: nextSubscribers,
    mailingLists: state.mailingLists,
    selectedListId: state.selectedListId,
    campaigns: state.campaigns,
  };
  await writeNewsletterAudience(next);
  return { state: next, added, updated };
}

export function summarizeMailingLists(state: NewsletterAudienceState): NewsletterMailingListSummary[] {
  const byId = new Map(state.subscribers.map((s) => [s.id, s]));
  return [...state.mailingLists]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((list) => {
      const members = list.subscriberIds
        .map((id) => byId.get(id))
        .filter((s): s is NewsletterSubscriber => Boolean(s));
      return {
        id: list.id,
        name: list.name,
        activeCount: countActiveSubscribers(members),
        totalCount: members.length,
        updatedAt: list.updatedAt,
      };
    });
}

export function getMailingListRecipients(
  state: NewsletterAudienceState,
  listId: string | null | undefined
): NewsletterSubscriber[] {
  const id = listId ?? state.selectedListId;
  if (!id) {
    return [];
  }
  const list = state.mailingLists.find((entry) => entry.id === id);
  if (!list) {
    return [];
  }
  const byId = new Map(state.subscribers.map((s) => [s.id, s]));
  return list.subscriberIds
    .map((subscriberId) => byId.get(subscriberId))
    .filter((s): s is NewsletterSubscriber => Boolean(s && !s.unsubscribedAt));
}

export async function setSelectedMailingList(listId: string): Promise<NewsletterAudienceState> {
  const state = await readNewsletterAudience();
  if (!state.mailingLists.some((list) => list.id === listId)) {
    throw new Error("Mailing list not found.");
  }
  return writeNewsletterAudience({ ...state, selectedListId: listId });
}

export async function importToMailingList(
  listName: string,
  incoming: { email: string; name?: string }[]
): Promise<{
  state: NewsletterAudienceState;
  listId: string;
  listName: string;
  added: number;
  updated: number;
  importedRows: number;
  listActiveCount: number;
}> {
  const normalizedName = normalizeListName(listName);
  if (!normalizedName) {
    throw new Error("Enter a name for the mailing list.");
  }

  const { state: mergedState, added, updated } = await mergeNewsletterSubscribers(incoming);
  const byEmail = new Map(mergedState.subscribers.map((s) => [s.email, s]));
  const importedIds: string[] = [];
  for (const row of incoming) {
    const norm = normalizeSubscriber({ email: row.email, name: row.name ?? "" });
    if (!norm) {
      continue;
    }
    const sub = byEmail.get(norm.email);
    if (sub) {
      importedIds.push(sub.id);
    }
  }

  const now = new Date().toISOString();
  let lists = [...mergedState.mailingLists];
  let list = findListByName(lists, normalizedName);
  if (!list) {
    list = {
      id: crypto.randomUUID(),
      name: normalizedName,
      createdAt: now,
      updatedAt: now,
      subscriberIds: [],
    };
    lists.push(list);
  }

  const memberSet = new Set(list.subscriberIds);
  for (const id of importedIds) {
    memberSet.add(id);
  }
  lists = lists.map((entry) =>
    entry.id === list!.id
      ? {
          ...entry,
          name: entry.name || normalizedName,
          subscriberIds: Array.from(memberSet),
          updatedAt: now,
        }
      : entry
  );

  const selectedListId = mergedState.selectedListId ?? list.id;
  const next: NewsletterAudienceState = {
    ...mergedState,
    mailingLists: lists,
    selectedListId,
  };
  const saved = await writeNewsletterAudience(next);
  const savedList = saved.mailingLists.find((entry) => entry.id === list!.id);
  return {
    state: saved,
    listId: list.id,
    listName: savedList?.name ?? normalizedName,
    added,
    updated,
    importedRows: incoming.length,
    listActiveCount: getMailingListRecipients(saved, list.id).length,
  };
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
