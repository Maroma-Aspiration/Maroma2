import { kv } from "@vercel/kv";
import type {
  B2bAssortmentItem,
  B2bCommerceMode,
  B2bCompany,
  B2bCompanyStatus,
  B2bQuoteRequest,
  B2bStore,
} from "./b2b-types";

const B2B_KV_KEY = "maroma:b2b";

const emptyStore = (): B2bStore => ({ companies: [], quotes: [] });

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function normalizeAssortment(raw: unknown): B2bAssortmentItem[] {
  if (!Array.isArray(raw)) return [];
  const out: B2bAssortmentItem[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const productId = typeof row.productId === "string" ? row.productId.trim() : "";
    if (!productId || seen.has(productId)) continue;
    const priceInr = Number(row.priceInr);
    const moq = Number(row.moq);
    seen.add(productId);
    out.push({
      productId,
      priceInr: Number.isFinite(priceInr) && priceInr >= 0 ? Math.round(priceInr * 100) / 100 : 0,
      moq: Number.isFinite(moq) && moq >= 1 ? Math.floor(moq) : 1,
    });
  }
  return out;
}

function normalizeCompany(raw: unknown): B2bCompany | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const slug = slugify(typeof row.slug === "string" ? row.slug : "");
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const userEmail = typeof row.userEmail === "string" ? row.userEmail.trim().toLowerCase() : "";
  if (!id || !slug || !name || !userEmail) return null;

  const modeRaw = typeof row.commerceMode === "string" ? row.commerceMode : "quote";
  const commerceMode: B2bCommerceMode = modeRaw === "checkout" ? "checkout" : "quote";
  const statusRaw = typeof row.status === "string" ? row.status : "active";
  const status: B2bCompanyStatus =
    statusRaw === "pending" || statusRaw === "paused" || statusRaw === "active"
      ? statusRaw
      : "active";

  return {
    id,
    slug,
    name,
    userEmail,
    commerceMode,
    status,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    assortment: normalizeAssortment(row.assortment),
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
  };
}

function normalizeStore(raw: unknown): B2bStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const row = raw as Record<string, unknown>;
  const companies = Array.isArray(row.companies)
    ? row.companies.map(normalizeCompany).filter((c): c is B2bCompany => Boolean(c))
    : [];
  const quotes = Array.isArray(row.quotes) ? (row.quotes as B2bQuoteRequest[]) : [];
  return { companies, quotes };
}

export async function readB2bStore(): Promise<B2bStore> {
  try {
    const stored = await kv.get(B2B_KV_KEY);
    return normalizeStore(stored);
  } catch {
    return emptyStore();
  }
}

export async function writeB2bStore(store: B2bStore): Promise<void> {
  await kv.set(B2B_KV_KEY, normalizeStore(store));
}

export function suggestB2bSlug(name: string): string {
  return slugify(name) || `client-${Date.now().toString(36)}`;
}

export async function listB2bCompanies(): Promise<B2bCompany[]> {
  const store = await readB2bStore();
  return [...store.companies].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getB2bCompanyById(id: string): Promise<B2bCompany | null> {
  const store = await readB2bStore();
  return store.companies.find((c) => c.id === id) ?? null;
}

export async function getB2bCompanyBySlug(slug: string): Promise<B2bCompany | null> {
  const key = slugify(slug);
  if (!key) return null;
  const store = await readB2bStore();
  return store.companies.find((c) => c.slug === key) ?? null;
}

export async function getB2bCompanyByUserEmail(email: string): Promise<B2bCompany | null> {
  const key = email.trim().toLowerCase();
  if (!key) return null;
  const store = await readB2bStore();
  return store.companies.find((c) => c.userEmail === key) ?? null;
}

export type UpsertB2bCompanyInput = {
  id?: string;
  slug: string;
  name: string;
  userEmail: string;
  commerceMode?: B2bCommerceMode;
  status?: B2bCompanyStatus;
  notes?: string;
  assortment?: B2bAssortmentItem[];
};

export async function upsertB2bCompany(input: UpsertB2bCompanyInput): Promise<B2bCompany> {
  const store = await readB2bStore();
  const now = new Date().toISOString();
  const slug = slugify(input.slug);
  const userEmail = input.userEmail.trim().toLowerCase();
  const name = input.name.trim();
  if (!slug) throw new Error("Slug is required.");
  if (!name) throw new Error("Company name is required.");
  if (!userEmail || !EMAIL_RE.test(userEmail)) throw new Error("A valid client email is required.");

  const existingBySlug = store.companies.find((c) => c.slug === slug);
  const existingById = input.id ? store.companies.find((c) => c.id === input.id) : null;
  if (existingBySlug && existingById && existingBySlug.id !== existingById.id) {
    throw new Error("That slug is already used by another company.");
  }
  if (existingBySlug && !existingById) {
    throw new Error("That slug is already used by another company.");
  }

  const emailOwner = store.companies.find((c) => c.userEmail === userEmail);
  if (emailOwner && (!existingById || emailOwner.id !== existingById.id)) {
    throw new Error("That email is already linked to another B2B company.");
  }

  if (existingById) {
    const updated: B2bCompany = {
      ...existingById,
      slug,
      name,
      userEmail,
      commerceMode: input.commerceMode ?? existingById.commerceMode,
      status: input.status ?? existingById.status,
      notes: input.notes ?? existingById.notes,
      assortment: input.assortment ? normalizeAssortment(input.assortment) : existingById.assortment,
      updatedAt: now,
    };
    store.companies = store.companies.map((c) => (c.id === updated.id ? updated : c));
    await writeB2bStore(store);
    return updated;
  }

  const created: B2bCompany = {
    id: crypto.randomUUID(),
    slug,
    name,
    userEmail,
    commerceMode: input.commerceMode ?? "quote",
    status: input.status ?? "active",
    notes: input.notes,
    assortment: normalizeAssortment(input.assortment ?? []),
    createdAt: now,
    updatedAt: now,
  };
  store.companies.push(created);
  await writeB2bStore(store);
  return created;
}

export async function deleteB2bCompany(id: string): Promise<boolean> {
  const store = await readB2bStore();
  const before = store.companies.length;
  store.companies = store.companies.filter((c) => c.id !== id);
  if (store.companies.length === before) return false;
  await writeB2bStore(store);
  return true;
}

export async function appendB2bQuote(quote: B2bQuoteRequest): Promise<B2bQuoteRequest> {
  const store = await readB2bStore();
  store.quotes = [quote, ...store.quotes].slice(0, 500);
  await writeB2bStore(store);
  return quote;
}

export async function listB2bQuotes(limit = 50): Promise<B2bQuoteRequest[]> {
  const store = await readB2bStore();
  return store.quotes.slice(0, Math.max(1, Math.min(limit, 200)));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export { slugify as slugifyB2bSlug };
