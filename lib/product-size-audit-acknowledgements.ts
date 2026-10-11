import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import type { ProductSizeAudit } from "./product-size-audit";

export type ProductSizeAuditAcknowledgement = {
  fingerprint: string;
  acknowledgedAt: string;
};

type AcknowledgementStore = {
  acknowledgements: Record<string, ProductSizeAuditAcknowledgement>;
  updatedAt: string;
};

const key = "maroma:product-size-audit-acknowledgements";
const storagePath = path.join(process.cwd(), "data", "product-size-audit-acknowledgements.json");
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const emptyStore = (): AcknowledgementStore => ({ acknowledgements: {}, updatedAt: new Date().toISOString() });

function parseStore(value: unknown): AcknowledgementStore {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rows = raw.acknowledgements && typeof raw.acknowledgements === "object"
    ? raw.acknowledgements as Record<string, unknown>
    : {};
  const acknowledgements: Record<string, ProductSizeAuditAcknowledgement> = {};
  for (const [productId, value] of Object.entries(rows)) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    if (typeof row.fingerprint !== "string" || !row.fingerprint) continue;
    acknowledgements[productId] = {
      fingerprint: row.fingerprint.slice(0, 2000),
      acknowledgedAt: typeof row.acknowledgedAt === "string" ? row.acknowledgedAt : new Date().toISOString(),
    };
  }
  return {
    acknowledgements,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

export function sizeAuditFingerprint(productId: string, audit: ProductSizeAudit): string {
  return JSON.stringify({
    productId,
    status: audit.status,
    reason: audit.reason,
    expected: audit.expected,
    imageSizes: audit.imageSizes,
  });
}

export async function readSizeAuditAcknowledgements(): Promise<AcknowledgementStore> {
  if (hasKvConfig) {
    try {
      const stored = await kv.get(key);
      if (stored) return parseStore(stored);
    } catch {
      // Fall through to the local project store for development.
    }
  }
  try {
    return parseStore(JSON.parse(await fs.readFile(storagePath, "utf8")));
  } catch {
    return emptyStore();
  }
}

export async function acknowledgeSizeAudit(productId: string, fingerprint: string): Promise<void> {
  const store = await readSizeAuditAcknowledgements();
  store.acknowledgements[productId] = { fingerprint, acknowledgedAt: new Date().toISOString() };
  store.updatedAt = new Date().toISOString();
  if (hasKvConfig) {
    await kv.set(key, store);
    return;
  }
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(store, null, 2), "utf8");
}
