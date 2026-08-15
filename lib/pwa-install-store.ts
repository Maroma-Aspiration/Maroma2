import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import { normalizeAuthEmail } from "./auth-users-config";

type InstallStore = { installed: Record<string, string>; updatedAt: string };
const key = "maroma:pwa-installed-accounts";
const filePath = path.join(process.cwd(), "data", "pwa-installed-accounts.json");
const hasKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const empty = (): InstallStore => ({ installed: {}, updatedAt: new Date().toISOString() });

function normalize(value: unknown): InstallStore {
  if (!value || typeof value !== "object") return empty();
  const raw = value as Partial<InstallStore>;
  const installed: Record<string, string> = {};
  if (raw.installed && typeof raw.installed === "object") {
    for (const [email, date] of Object.entries(raw.installed)) {
      const normalized = normalizeAuthEmail(email);
      if (normalized && typeof date === "string") installed[normalized] = date;
    }
  }
  return { installed, updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString() };
}

async function readStore(): Promise<InstallStore> {
  if (hasKv) try { const saved = await kv.get(key); if (saved) return normalize(saved); } catch {}
  try { return normalize(JSON.parse(await fs.readFile(filePath, "utf8"))); } catch { return empty(); }
}

async function writeStore(store: InstallStore): Promise<void> {
  store.updatedAt = new Date().toISOString();
  if (hasKv) try { await kv.set(key, store); return; } catch {}
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
}

export async function hasAccountInstalledPwa(email: string): Promise<boolean> {
  return Boolean((await readStore()).installed[normalizeAuthEmail(email)]);
}

export async function markAccountPwaInstalled(email: string): Promise<void> {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) return;
  const store = await readStore();
  store.installed[normalized] = new Date().toISOString();
  await writeStore(store);
}
