import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import type {
  NewsletterArchiveIssue,
  NewsletterArchiveState,
  NewsletterArchiveSummary,
} from "./newsletter-archive-types";
import type { NewsletterCanvas } from "./story-types";
import { buildArchiveSlug } from "./newsletter-archive-utils";

const storageDir = path.join(process.cwd(), "data");
const storagePath = path.join(storageDir, "newsletter-archive.json");
const archiveKvKey = "maroma:newsletter-archive";
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const MAX_ISSUES = 120;

const defaultState: NewsletterArchiveState = { issues: [] };

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

  const bySlug = new Map<string, NewsletterArchiveIssue>();
  for (const issue of issues) {
    bySlug.set(issue.slug, issue);
  }

  const deduped = Array.from(bySlug.values())
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
    .slice(0, MAX_ISSUES);

  return { issues: deduped };
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

export async function listArchiveSummaries(): Promise<NewsletterArchiveSummary[]> {
  const { issues } = await readNewsletterArchive();
  return issues.map(({ id, slug, subject, previewText, sentAt, thumbnailUrl, recipientCount }) => ({
    id,
    slug,
    subject,
    previewText,
    sentAt,
    thumbnailUrl,
    recipientCount,
  }));
}

export async function getArchiveIssueBySlug(slug: string): Promise<NewsletterArchiveIssue | null> {
  const key = slug.trim();
  if (!key) return null;
  const { issues } = await readNewsletterArchive();
  return issues.find((issue) => issue.slug === key) ?? null;
}

export async function appendArchiveIssue(issue: NewsletterArchiveIssue): Promise<NewsletterArchiveIssue> {
  const state = await readNewsletterArchive();
  const normalized = normalizeIssue(issue);
  if (!normalized) {
    throw new Error("Invalid archive issue payload.");
  }
  const withoutDup = state.issues.filter((item) => item.id !== normalized.id && item.slug !== normalized.slug);
  const next = parseArchiveState({ issues: [normalized, ...withoutDup] });
  await writeNewsletterArchive(next);
  return normalized;
}
