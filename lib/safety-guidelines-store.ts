import { readJsonKv, writeJsonKv } from "./json-kv-store";
import { DEFAULT_SAFETY_SETS } from "./safety-guidelines-content";
import {
  isSafetyLanguage,
  SAFETY_LANGUAGES,
  type SafetyGuidelinesStore,
  type SafetyLanguage,
  type SafetySection,
  type SafetySet,
  type SafetyTranslation,
} from "./safety-guidelines-types";

const KV_KEY = "maroma:safety-guidelines";
const FILE_NAME = "safety-guidelines.json";

const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

function normalizeSection(raw: unknown): SafetySection | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const heading = text(row.heading, 120);
  const body = text(row.body, 2000);
  const items = Array.isArray(row.items)
    ? row.items.map((item) => text(item, 600)).filter(Boolean).slice(0, 40)
    : [];
  if (!heading && !body && items.length === 0) return null;
  return { heading, body, items };
}

function normalizeTranslation(raw: unknown): SafetyTranslation | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const sections = Array.isArray(row.sections)
    ? row.sections.map(normalizeSection).filter((item): item is SafetySection => item !== null).slice(0, 12)
    : [];
  if (sections.length === 0) return null;
  return { title: text(row.title, 140), sections };
}

function normalizeSet(raw: unknown): SafetySet | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = text(row.id, 40).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "");
  if (!id) return null;
  const translations: SafetySet["translations"] = {};
  const source = (row.translations ?? {}) as Record<string, unknown>;
  for (const { code } of SAFETY_LANGUAGES) {
    const translation = normalizeTranslation(source[code]);
    if (translation) translations[code] = translation;
  }
  if (Object.keys(translations).length === 0) return null;
  return {
    id,
    label: text(row.label, 80) || id,
    summary: text(row.summary, 220),
    translations,
  };
}

function withDefaults(value: SafetyGuidelinesStore | null): SafetyGuidelinesStore {
  const stored = Array.isArray(value?.sets)
    ? value!.sets.map(normalizeSet).filter((item): item is SafetySet => item !== null)
    : [];
  if (stored.length === 0) {
    return { sets: DEFAULT_SAFETY_SETS, updatedAt: "" };
  }
  const storedById = new Map(stored.map((set) => [set.id, set]));
  const merged = DEFAULT_SAFETY_SETS.map((fallback) => {
    const existing = storedById.get(fallback.id);
    if (!existing) return fallback;
    storedById.delete(fallback.id);
    // New language copy from code fills any language the saved store does not yet have.
    return {
      ...existing,
      translations: { ...fallback.translations, ...existing.translations },
    };
  });
  return {
    sets: [...merged, ...storedById.values()],
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : "",
  };
}

export async function readSafetyGuidelines(): Promise<SafetyGuidelinesStore> {
  const value = await readJsonKv<SafetyGuidelinesStore>(KV_KEY, FILE_NAME, {
    sets: DEFAULT_SAFETY_SETS,
    updatedAt: "",
  });
  return withDefaults(value);
}

export async function writeSafetyGuidelines(sets: SafetySet[]): Promise<SafetyGuidelinesStore> {
  const store: SafetyGuidelinesStore = {
    sets: sets.map(normalizeSet).filter((item): item is SafetySet => item !== null),
    updatedAt: new Date().toISOString(),
  };
  await writeJsonKv(KV_KEY, FILE_NAME, store);
  return store;
}

export async function readSafetySet(id: string): Promise<SafetySet | null> {
  const store = await readSafetyGuidelines();
  return store.sets.find((item) => item.id === id) ?? null;
}

/** Query strings arrive as unknown strings; anything unrecognised falls back to English. */
export function safetyLanguageFromParam(value: unknown): SafetyLanguage {
  const code = typeof value === "string" ? value.trim().toLowerCase().slice(0, 2) : "";
  return isSafetyLanguage(code) ? code : "en";
}