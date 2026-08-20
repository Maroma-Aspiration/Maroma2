import { kv } from "@vercel/kv";
import { readNewsletterArchive, getArchiveIssueBySlug } from "./newsletter-archive-storage";
import { getTestSnapshotBySlug, readTestSnapshots } from "./newsletter-test-snapshot-storage";
import {
  applyArchiveIssueToState,
  issueMonthFromCanvas,
  pickArchiveIssueByMonth,
  pickArchiveIssueToRestore,
  storiesStateToArchiveIssue,
} from "./newsletter-restore-issue";
import {
  readPreviousNewsletterIssue,
  writePreviousNewsletterIssue,
} from "./newsletter-previous-issue-storage";
import { revalidateStoryConsumerRoutes } from "./revalidate-story-pages";
import { readStoriesState, writeStoriesState } from "./story-storage";
import type { NewsletterArchiveIssue } from "./newsletter-archive-types";
import type { StoriesState } from "./story-types";

const julyRestoreKvKey = "maroma:newsletter-restore-july-v3";
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

async function previousIssueAsArchive(): Promise<NewsletterArchiveIssue | null> {
  const previous = await readPreviousNewsletterIssue();
  if (!previous) return null;
  return storiesStateToArchiveIssue(previous.state, previous.savedAt, "previous-issue");
}

async function allRestorableIssues(): Promise<NewsletterArchiveIssue[]> {
  const [{ issues }, tests, previous] = await Promise.all([
    readNewsletterArchive(),
    readTestSnapshots(),
    previousIssueAsArchive(),
  ]);
  return [...tests, ...issues, ...(previous ? [previous] : [])];
}

async function findRestorableIssue(
  slug?: string,
  month?: string,
  live?: StoriesState
): Promise<NewsletterArchiveIssue | null> {
  const key = slug?.trim() ?? "";
  if (key) {
    if (key === "previous-issue") return previousIssueAsArchive();
    if (key.startsWith("test-")) return getTestSnapshotBySlug(key);
    return getArchiveIssueBySlug(key);
  }

  const issues = await allRestorableIssues();
  if (month?.trim()) {
    return pickArchiveIssueByMonth(issues, month.trim());
  }
  return pickArchiveIssueToRestore(issues, live);
}

export async function restoreArchiveIssueToLive(slug?: string, month?: string): Promise<{
  state: StoriesState;
  restoredSlug: string;
}> {
  const live = await readStoriesState();
  const issue = await findRestorableIssue(slug, month, live);

  if (!issue) {
    throw new Error(
      slug?.trim()
        ? "That issue was not found."
        : month?.trim()
          ? `No ${month.trim()} issue was found in the archive, test sends, or previous draft.`
          : "No sent issue was found to restore."
    );
  }

  await writePreviousNewsletterIssue(live);
  const restored = await writeStoriesState(applyArchiveIssueToState(live, issue));
  return { state: restored, restoredSlug: issue.slug };
}

/** If May (or another month) is live and a July send/test/draft exists, put July back. */
export async function restoreJulyIssueIfAvailable(): Promise<StoriesState | null> {
  if (!hasKvConfig) return null;
  try {
    const already = await kv.get(julyRestoreKvKey);
    if (already) return null;
  } catch {
    return null;
  }

  const live = await readStoriesState();
  if (issueMonthFromCanvas(live.newsletterCanvas, live.newsletterTitle) === "july") {
    try {
      await kv.set(julyRestoreKvKey, { skipped: "already-july", at: new Date().toISOString() });
    } catch {
      // ignore
    }
    return null;
  }

  const july = await findRestorableIssue(undefined, "july", live);
  if (!july) {
    try {
      await kv.set(julyRestoreKvKey, { skipped: "no-july-found", at: new Date().toISOString() });
    } catch {
      // ignore
    }
    return null;
  }

  await writePreviousNewsletterIssue(live);
  const restored = await writeStoriesState(applyArchiveIssueToState(live, july));
  revalidateStoryConsumerRoutes();
  try {
    await kv.set(julyRestoreKvKey, {
      restoredSlug: july.slug,
      at: new Date().toISOString(),
    });
  } catch {
    // live restore still succeeded
  }
  return restored;
}
