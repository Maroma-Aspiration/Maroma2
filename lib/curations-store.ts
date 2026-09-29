import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";

export type CurationProfile = {
  email: string;
  name: string;
  category: string;
  productIds: string[];
  choices: { type: string; goal: string; routine: string };
  updatedAt: string;
};

const storagePath = path.join(process.cwd(), "data", "curations.json");
const kvKey = "maroma:curations";
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const clean = (value: unknown, max = 120): string => typeof value === "string" ? value.trim().slice(0, max) : "";

function parseProfiles(value: unknown): CurationProfile[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Partial<CurationProfile>;
    const email = clean(raw.email, 254).toLowerCase();
    if (!email) return [];
    const choices = raw.choices && typeof raw.choices === "object" ? raw.choices : { type: "", goal: "", routine: "" };
    return [{
      email,
      name: clean(raw.name, 60),
      category: clean(raw.category) || "face-care",
      productIds: Array.isArray(raw.productIds) ? raw.productIds.map((id) => clean(id)).filter(Boolean).slice(0, 24) : [],
      choices: {
        type: clean(choices.type),
        goal: clean(choices.goal),
        routine: clean(choices.routine)
      },
      updatedAt: clean(raw.updatedAt) || new Date().toISOString()
    }];
  });
}

async function readProfiles(): Promise<CurationProfile[]> {
  if (hasKvConfig) {
    try {
      const stored = await kv.get(kvKey);
      if (stored) return parseProfiles(stored);
    } catch {}
  }
  try {
    return parseProfiles(JSON.parse(await fs.readFile(storagePath, "utf8")));
  } catch {
    return [];
  }
}

export async function saveCurationProfile(profile: Omit<CurationProfile, "updatedAt">): Promise<CurationProfile> {
  const normalized = parseProfiles([{ ...profile, updatedAt: new Date().toISOString() }])[0];
  if (!normalized) throw new Error("invalid_profile");
  const profiles = await readProfiles();
  const next = [...profiles.filter((entry) => entry.email !== normalized.email), normalized];
  if (hasKvConfig) {
    await kv.set(kvKey, next);
  } else {
    await fs.mkdir(path.dirname(storagePath), { recursive: true });
    await fs.writeFile(storagePath, JSON.stringify(next, null, 2), "utf8");
  }
  return normalized;
}

export async function getCurationProfile(email: string): Promise<CurationProfile | null> {
  const normalized = clean(email, 254).toLowerCase();
  return (await readProfiles()).find((entry) => entry.email === normalized) ?? null;
}
