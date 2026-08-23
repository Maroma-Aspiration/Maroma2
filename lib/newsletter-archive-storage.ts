import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import type {
  NewsletterArchiveIssue,
  NewsletterArchiveState,
  NewsletterArchiveSummary,
} from "./newsletter-archive-types";
import type { NewsletterCanvas } from "./story-types";
import {
  archiveCanvasFingerprint,
  archiveIssueDisplayTitle,
  assignUniqueArchiveThumbnails,
  buildArchiveSlug,
  pickThumbnailFromCanvas,
  presentArchiveIssue,
} from "./newsletter-archive-utils";
import { canvasContentScore, issueMonthFromCanvas } from "./newsletter-restore-issue";
import { readTestSnapshots } from "./newsletter-test-snapshot-storage";

const storageDir = path.join(process.cwd(), "data");
const storagePath = path.join(storageDir, "newsletter-archive.json");
const archiveKvKey = "maroma:newsletter-archive";
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const MAX_ISSUES = 120;

const defaultState: NewsletterArchiveState = { issues: [] };

const MONTH_IN_TITLE_RE =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;

/** One public card per newsletter edition (e.g. May 2026, June 2026). */
function archiveListingDedupeKey(issue: NewsletterArchiveIssue): string {
  const editionMonth =
    issueMonthFromCanvas(issue.canvas, issue.subject) ??
    archiveIssueDisplayTitle(issue).toLowerCase().match(MONTH_IN_TITLE_RE)?.[1]?.toLowerCase() ??
    null;
  const year = issue.sentAt.slice(0, 4);
  if (editionMonth && year.length === 4) return `edition:${year}-${editionMonth}`;

  const fingerprint = archiveCanvasFingerprint(issue.canvas);
  if (fingerprint) return `fp:${fingerprint}`;
  return `id:${issue.id.trim() || issue.slug.trim() || issue.sentAt}`;
}

function pickPreferredArchiveIssue(
  existing: NewsletterArchiveIssue,
  candidate: NewsletterArchiveIssue
): NewsletterArchiveIssue {
  const existingSent = existing.recipientCount > 0;
  const candidateSent = candidate.recipientCount > 0;
  if (existingSent !== candidateSent) {
    return candidateSent ? candidate : existing;
  }
  if (existing.recipientCount !== candidate.recipientCount) {
    return existing.recipientCount > candidate.recipientCount ? existing : candidate;
  }
  const existingScore = canvasContentScore(existing.canvas);
  const candidateScore = canvasContentScore(candidate.canvas);
  if (existingScore !== candidateScore) {
    return existingScore > candidateScore ? existing : candidate;
  }
  return existing.sentAt >= candidate.sentAt ? existing : candidate;
}

function dedupeArchiveIssues(issues: NewsletterArchiveIssue[]): NewsletterArchiveIssue[] {
  const byKey = new Map<string, NewsletterArchiveIssue>();
  for (const issue of issues) {
    const key = archiveListingDedupeKey(issue);
    const existing = byKey.get(key);
    byKey.set(key, existing ? pickPreferredArchiveIssue(existing, issue) : issue);
  }
  return Array.from(byKey.values())
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
    .slice(0, MAX_ISSUES);
}

function isPublishableArchiveIssue(issue: NewsletterArchiveIssue): boolean {
  if (canvasContentScore(issue.canvas) >= 8) return true;
  const elements = issue.canvas?.elements ?? [];
  const hasStoryGrid = elements.some(
    (el) => el.kind === "story-grid" && (el.stories?.length ?? 0) > 0
  );
  const hasStorySections = elements.some((el) => /^migrated-st-\d+$/.test(el.id));
  if (hasStoryGrid || hasStorySections) return true;
  return canvasContentScore(issue.canvas) >= 4;
}

function normalizeCanvas(raw: unknown): NewsletterCanvas | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<NewsletterCanvas>;
  if (!Array.isArray(c.elements)) return null;
  return {
    enabled: c.enabled !== false,
    elements: c.elements,
    dividerDefaults: c.dividerDefaults,
    measuredHeights: c.measuredHeights,
    storySpacingGaps: c.storySpacingGaps,
  };
}

function normalizeIssue(raw: Partial<NewsletterArchiveIssue>): NewsletterArchiveIssue | null {
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "";
  const subject = typeof raw.subject === "string" ? raw.subject.trim() : "";
  const sentAt = typeof raw.sentAt === "string" && raw.sentAt.trim() ? raw.sentAt.trim() : "";
  const canvas = normalizeCanvas(raw.canvas);
  if (!id || !sentAt || !canvas) return null;

  const slug =
    typeof raw.slug === "string" && raw.slug.trim()
      ? raw.slug.trim()
      : buildArchiveSlug(subject || "Newsletter", sentAt, id);

  const renderMeta =
    raw.renderMeta && typeof raw.renderMeta === "object"
      ? (raw.renderMeta as NewsletterArchiveIssue["renderMeta"])
      : {};

  return {
    id,
    slug,
    subject: subject || "Maroma newsletter",
    previewText: typeof raw.previewText === "string" ? raw.previewText.trim() : "",
    sentAt,
    thumbnailUrl:
      typeof raw.thumbnailUrl === "string" && raw.thumbnailUrl.trim()
        ? raw.thumbnailUrl.trim()
        : undefined,
    canvas,
    renderMeta,
    recipientCount:
      typeof raw.recipientCount === "number" && raw.recipientCount >= 0 ? raw.recipientCount : 0,
  };
}

function parseArchiveState(value: unknown): NewsletterArchiveState {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const issuesRaw = Array.isArray(raw.issues) ? raw.issues : [];
  const issues = issuesRaw
    .map((item) => normalizeIssue(item as Partial<NewsletterArchiveIssue>))
    .filter(Boolean) as NewsletterArchiveIssue[];

  return { issues: dedupeArchiveIssues(issues) };
}

export async function readNewsletterArchive(): Promise<NewsletterArchiveState> {
  if (hasKvConfig) {
    try {
      const stored = await kv.get(archiveKvKey);
      if (stored) return parseArchiveState(stored);
    } catch {
      // fall through
    }
  }
  try {
    const raw = await fs.readFile(storagePath, "utf8");
    return parseArchiveState(JSON.parse(raw));
  } catch {
    return defaultState;
  }
}

export async function writeNewsletterArchive(state: NewsletterArchiveState): Promise<NewsletterArchiveState> {
  const parsed = parseArchiveState(state);
  if (hasKvConfig) {
    try {
      await kv.set(archiveKvKey, parsed);
      return parsed;
    } catch {
      // fall through
    }
  }
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(parsed, null, 2), "utf8");
  return parsed;
}

function uniqueIssuesForListing(issues: NewsletterArchiveIssue[]): NewsletterArchiveIssue[] {
  return dedupeArchiveIssues(issues.filter(isPublishableArchiveIssue));
}

async function allIssuesForPublicListing(): Promise<NewsletterArchiveIssue[]> {
  await compactArchiveStorage();
  const [{ issues }, testSnapshots] = await Promise.all([readNewsletterArchive(), readTestSnapshots()]);
  return uniqueIssuesForListing([...issues, ...testSnapshots]);
}

const archiveCompactKey = "maroma:newsletter-archive-compacted-v1";

/** Rewrite KV once with edition-based dedupe after test-send merge bloated the store. */
async function compactArchiveStorage(): Promise<void> {
  if (!hasKvConfig) return;
  try {
    if (await kv.get(archiveCompactKey)) return;
  } catch {
    return;
  }

  let rawIssues: NewsletterArchiveIssue[] = [];
  try {
    const stored = await kv.get<{ issues?: unknown[] }>(archiveKvKey);
    if (stored?.issues && Array.isArray(stored.issues)) {
      rawIssues = stored.issues
        .map((item) => normalizeIssue(item as Partial<NewsletterArchiveIssue>))
        .filter(Boolean) as NewsletterArchiveIssue[];
    }
  } catch {
    return;
  }

  if (rawIssues.length === 0) {
    try {
      await kv.set(archiveCompactKey, { skipped: "empty", at: new Date().toISOString() });
    } catch {
      // ignore
    }
    return;
  }

  const compacted = dedupeArchiveIssues(rawIssues);
  await writeNewsletterArchive({ issues: compacted });

  try {
    await kv.set(archiveCompactKey, {
      before: rawIssues.length,
      after: compacted.length,
      at: new Date().toISOString(),
    });
  } catch {
    // compact write still succeeded
  }
}

export async function listArchiveSummaries(): Promise<NewsletterArchiveSummary[]> {
  const issues = assignUniqueArchiveThumbnails(await allIssuesForPublicListing());
  return issues.map((issue) => {
    const presented = presentArchiveIssue(issue);
    return {
      id: presented.id,
      slug: presented.slug,
      subject: presented.subject,
      previewText: presented.previewText,
      sentAt: presented.sentAt,
      thumbnailUrl: presented.thumbnailUrl,
      recipientCount: presented.recipientCount,
    };
  });
}

export async function getArchiveIssueBySlug(slug: string): Promise<NewsletterArchiveIssue | null> {
  const key = slug.trim();
  if (!key) return null;
  const [{ issues }, testSnapshots] = await Promise.all([readNewsletterArchive(), readTestSnapshots()]);
  const issue = [...issues, ...testSnapshots].find((item) => item.slug === key) ?? null;
  return issue ? presentArchiveIssue(issue) : null;
}

export async function appendArchiveIssue(issue: NewsletterArchiveIssue): Promise<NewsletterArchiveIssue> {
  const state = await readNewsletterArchive();
  const normalized = normalizeIssue(issue);
  if (!normalized) {
    throw new Error("Invalid archive issue payload.");
  }

  const fingerprint = archiveCanvasFingerprint(normalized.canvas);
  const existing = state.issues.find((item) => archiveCanvasFingerprint(item.canvas) === fingerprint);
  const stored: NewsletterArchiveIssue = existing
    ? {
        ...existing,
        subject: normalized.subject,
        previewText: normalized.previewText || existing.previewText,
        sentAt: normalized.sentAt,
        thumbnailUrl: pickThumbnailFromCanvas(normalized.canvas) || existing.thumbnailUrl,
        canvas: normalized.canvas,
        renderMeta: normalized.renderMeta,
        recipientCount: Math.max(existing.recipientCount, normalized.recipientCount),
      }
    : normalized;

  const withoutDup = state.issues.filter(
    (item) => item.id !== stored.id && item.slug !== stored.slug && archiveCanvasFingerprint(item.canvas) !== fingerprint
  );
  const next = parseArchiveState({ issues: [stored, ...withoutDup] });
  await writeNewsletterArchive(next);
  return stored;
}
