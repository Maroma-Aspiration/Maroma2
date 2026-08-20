import { kv } from "@vercel/kv";
import type { NewsletterArchiveIssue, NewsletterArchiveSummary } from "./newsletter-archive-types";
import type { NewsletterCanvas } from "./story-types";
import {
  archiveCanvasFingerprint,
  pickThumbnailFromCanvas,
  presentArchiveIssue,
} from "./newsletter-archive-utils";

const kvKey = "maroma:newsletter-test-snapshots";
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const MAX_SNAPSHOTS = 24;

export type NewsletterTestSnapshot = NewsletterArchiveIssue & {
  testOnly: true;
  sentTo: string[];
};

type TestSnapshotState = { snapshots: NewsletterTestSnapshot[] };

function normalizeCanvas(raw: unknown): NewsletterCanvas | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<NewsletterCanvas>;
  if (!Array.isArray(c.elements) || c.elements.length === 0) return null;
  return {
    enabled: c.enabled !== false,
    elements: c.elements,
    dividerDefaults: c.dividerDefaults,
    measuredHeights: c.measuredHeights,
    storySpacingGaps: c.storySpacingGaps,
  };
}

function normalizeSnapshot(raw: Partial<NewsletterTestSnapshot>): NewsletterTestSnapshot | null {
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "";
  const sentAt = typeof raw.sentAt === "string" && raw.sentAt.trim() ? raw.sentAt.trim() : "";
  const canvas = normalizeCanvas(raw.canvas);
  if (!id || !sentAt || !canvas) return null;
  const sentTo = Array.isArray(raw.sentTo)
    ? raw.sentTo.filter((item): item is string => typeof item === "string" && item.includes("@"))
    : [];
  return {
    id,
    slug: typeof raw.slug === "string" && raw.slug.trim() ? raw.slug.trim() : `test-${id}`,
    subject: typeof raw.subject === "string" && raw.subject.trim() ? raw.subject.trim() : "Maroma newsletter",
    previewText: typeof raw.previewText === "string" ? raw.previewText.trim() : "",
    sentAt,
    thumbnailUrl: typeof raw.thumbnailUrl === "string" && raw.thumbnailUrl.trim() ? raw.thumbnailUrl.trim() : undefined,
    canvas,
    renderMeta: raw.renderMeta && typeof raw.renderMeta === "object" ? raw.renderMeta : {},
    recipientCount: sentTo.length || (typeof raw.recipientCount === "number" ? raw.recipientCount : 0),
    testOnly: true,
    sentTo,
  };
}

function parseState(value: unknown): TestSnapshotState {
  const raw = value && typeof value === "object" ? (value as { snapshots?: unknown[] }) : {};
  const snapshots = (Array.isArray(raw.snapshots) ? raw.snapshots : [])
    .map((item) => normalizeSnapshot(item as Partial<NewsletterTestSnapshot>))
    .filter(Boolean) as NewsletterTestSnapshot[];
  return {
    snapshots: snapshots.sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, MAX_SNAPSHOTS),
  };
}

async function readTestSnapshotState(): Promise<TestSnapshotState> {
  if (!hasKvConfig) return { snapshots: [] };
  try {
    const stored = await kv.get(kvKey);
    if (stored) return parseState(stored);
  } catch {
    // ignore
  }
  return { snapshots: [] };
}

async function writeTestSnapshotState(state: TestSnapshotState): Promise<TestSnapshotState> {
  const parsed = parseState(state);
  if (hasKvConfig) {
    await kv.set(kvKey, parsed);
  }
  return parsed;
}

export async function appendTestSnapshot(
  snapshot: Omit<NewsletterTestSnapshot, "slug" | "testOnly" | "recipientCount"> & {
    slug?: string;
    recipientCount?: number;
  }
): Promise<NewsletterTestSnapshot | null> {
  const normalized = normalizeSnapshot({
    ...snapshot,
    slug: snapshot.slug || `test-${snapshot.id}`,
    testOnly: true,
    recipientCount: snapshot.sentTo.length,
  });
  if (!normalized) return null;

  const state = await readTestSnapshotState();
  const fingerprint = archiveCanvasFingerprint(normalized.canvas);
  const existing = state.snapshots.find((item) => archiveCanvasFingerprint(item.canvas) === fingerprint);
  const stored: NewsletterTestSnapshot = existing
    ? {
        ...existing,
        subject: normalized.subject,
        previewText: normalized.previewText || existing.previewText,
        sentAt: normalized.sentAt,
        thumbnailUrl: pickThumbnailFromCanvas(normalized.canvas) || existing.thumbnailUrl,
        canvas: normalized.canvas,
        renderMeta: normalized.renderMeta,
        sentTo: Array.from(new Set([...existing.sentTo, ...normalized.sentTo])),
        recipientCount: Array.from(new Set([...existing.sentTo, ...normalized.sentTo])).length,
      }
    : normalized;

  const withoutDup = state.snapshots.filter(
    (item) => item.id !== stored.id && archiveCanvasFingerprint(item.canvas) !== fingerprint
  );
  const next = await writeTestSnapshotState({ snapshots: [stored, ...withoutDup] });
  return next.snapshots.find((item) => item.id === stored.id) ?? stored;
}

export async function listTestSnapshotSummaries(): Promise<Array<NewsletterArchiveSummary & { testOnly: true }>> {
  const { snapshots } = await readTestSnapshotState();
  return snapshots.map((snapshot) => {
    const presented = presentArchiveIssue(snapshot);
    return {
      id: presented.id,
      slug: presented.slug,
      subject: presented.subject,
      previewText: presented.previewText,
      sentAt: presented.sentAt,
      thumbnailUrl: presented.thumbnailUrl,
      recipientCount: presented.recipientCount,
      testOnly: true as const,
    };
  });
}

export async function readTestSnapshots(): Promise<NewsletterArchiveIssue[]> {
  const { snapshots } = await readTestSnapshotState();
  return snapshots;
}

export async function getTestSnapshotBySlug(slug: string): Promise<NewsletterArchiveIssue | null> {
  const key = slug.trim();
  if (!key) return null;
  const { snapshots } = await readTestSnapshotState();
  return snapshots.find((item) => item.slug === key || item.id === key) ?? null;
}
