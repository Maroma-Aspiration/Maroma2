import { kv } from "@vercel/kv";
import { parseState } from "./story-storage";
import type { StoriesState } from "./story-types";
import { backupSnapshot } from "./newsletter-restore-issue";

const previousKvKey = "maroma:newsletter-previous-issue";
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

type PreviousIssueRecord = {
  savedAt: string;
  state: StoriesState;
};

export async function readPreviousNewsletterIssue(): Promise<PreviousIssueRecord | null> {
  if (!hasKvConfig) return null;
  try {
    const stored = await kv.get(previousKvKey);
    if (!stored || typeof stored !== "object") return null;
    const raw = stored as Partial<PreviousIssueRecord>;
    if (!raw.state || typeof raw.state !== "object") return null;
    return {
      savedAt: typeof raw.savedAt === "string" ? raw.savedAt : new Date().toISOString(),
      state: parseState(raw.state),
    };
  } catch {
    return null;
  }
}

export async function writePreviousNewsletterIssue(state: StoriesState): Promise<PreviousIssueRecord> {
  if (!hasKvConfig) {
    throw new Error("Newsletter backup storage is not configured.");
  }
  const record: PreviousIssueRecord = {
    savedAt: new Date().toISOString(),
    state: parseState(backupSnapshot(state)),
  };
  await kv.set(previousKvKey, record);
  return record;
}

export async function clearPreviousNewsletterIssueServer(): Promise<void> {
  if (!hasKvConfig) return;
  try {
    await kv.del(previousKvKey);
  } catch {
    // ignore
  }
}
