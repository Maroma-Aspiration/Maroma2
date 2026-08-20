import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";

const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const dataDir = path.join(process.cwd(), "data");

export async function readJsonKv<T>(key: string, fileName: string, fallback: T): Promise<T> {
  if (hasKvConfig) {
    try {
      const stored = await kv.get<T>(key);
      if (stored != null) return stored;
    } catch {
      // fall through to disk
    }
  }
  try {
    const raw = await fs.readFile(path.join(dataDir, fileName), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonKv<T>(key: string, fileName: string, value: T): Promise<void> {
  if (hasKvConfig) {
    await kv.set(key, value);
    return;
  }
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, fileName), JSON.stringify(value, null, 2), "utf8");
}
