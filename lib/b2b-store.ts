import { kv } from "@vercel/kv";
import type {
  B2bAssortmentItem,
  B2bCommerceMode,
  B2bCompany,
  B2bCompanyStatus,
  B2bDeliveryAddress,
  B2bOrder,
  B2bProgram,
  B2bQuoteRequest,
  B2bStore,
} from "./b2b-types";
import { WHITE_LABEL_DISCOUNT_RATE, WHITE_LABEL_MIN_SPEND_INR } from "./b2b-pricing";

const B2B_KV_KEY = "maroma:b2b";

const emptyStore = (): B2bStore => ({ companies: [], quotes: [], orders: [] });

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

export function normalizeDeliveryAddresses(raw: unknown): B2bDeliveryAddress[] {
  if (!Array.isArray(raw)) return [];
  const out: B2bDeliveryAddress[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id =
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim()
        : crypto.randomUUID();
    if (seen.has(id)) continue;
    const label = typeof row.label === "string" ? row.label.trim().slice(0, 80) : "";
    const contactName =
      typeof row.contactName === "string" ? row.contactName.trim().slice(0, 120) : "";
    const phone = typeof row.phone === "string" ? row.phone.trim().slice(0, 40) : "";
    const address = typeof row.address === "string" ? row.address.trim().slice(0, 300) : "";
    const city = typeof row.city === "string" ? row.city.trim().slice(0, 80) : "";
    const state = typeof row.state === "string" ? row.state.trim().slice(0, 80) : "";
    const pincode = typeof row.pincode === "string" ? row.pincode.trim().slice(0, 20) : "";
    const country =
      typeof row.country === "string" && row.country.trim()
        ? row.country.trim().slice(0, 80)
        : "India";
    if (!label || !contactName || !phone || !address || !city || !pincode) continue;
    seen.add(id);
    out.push({
      id,
      label,
      contactName,
      phone,
      address,
      city,
      state,
      pincode,
      country,
      isDefault: row.isDefault === true,
    });
  }
  if (out.length > 0 && !out.some((a) => a.isDefault)) {
    out[0] = { ...out[0], isDefault: true };
  }
  if (out.filter((a) => a.isDefault).length > 1) {
    let kept = false;
    for (let i = 0; i < out.length; i++) {
      if (out[i].isDefault) {
        if (kept) out[i] = { ...out[i], isDefault: false };
        else kept = true;
      }
    }
  }
  return out.slice(0, 20);
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
  const program: B2bProgram = row.program === "white_label" ? "white_label" : "custom";
  const discountPct = Number(row.whiteLabelDiscountPercent);
  const minSpend = Number(row.whiteLabelMinSpendInr);

  return {
    id,
    slug,
    name,
    userEmail,
    commerceMode,
    status,
    program,
    whiteLabelDiscountPercent:
      program === "white_label"
        ? Number.isFinite(discountPct) && discountPct > 0
          ? discountPct
          : WHITE_LABEL_DISCOUNT_RATE * 100
        : undefined,
    whiteLabelMinSpendInr:
      program === "white_label"
        ? Number.isFinite(minSpend) && minSpend > 0
          ? minSpend
          : WHITE_LABEL_MIN_SPEND_INR
        : undefined,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    assortment: normalizeAssortment(row.assortment),
    deliveryAddresses: normalizeDeliveryAddresses(row.deliveryAddresses),
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
  const orders = Array.isArray(row.orders) ? (row.orders as B2bOrder[]) : [];
  return { companies, quotes, orders };
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
  program?: B2bProgram;
  whiteLabelDiscountPercent?: number;
  whiteLabelMinSpendInr?: number;
  notes?: string;
  assortment?: B2bAssortmentItem[];
  deliveryAddresses?: B2bDeliveryAddress[];
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
      program: input.program ?? existingById.program,
      whiteLabelDiscountPercent:
        input.whiteLabelDiscountPercent ?? existingById.whiteLabelDiscountPercent,
      whiteLabelMinSpendInr: input.whiteLabelMinSpendInr ?? existingById.whiteLabelMinSpendInr,
      notes: input.notes ?? existingById.notes,
      assortment: input.assortment ? normalizeAssortment(input.assortment) : existingById.assortment,
      deliveryAddresses: input.deliveryAddresses
        ? normalizeDeliveryAddresses(input.deliveryAddresses)
        : existingById.deliveryAddresses,
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
    program: input.program ?? "custom",
    whiteLabelDiscountPercent: input.whiteLabelDiscountPercent,
    whiteLabelMinSpendInr: input.whiteLabelMinSpendInr,
    notes: input.notes,
    assortment: normalizeAssortment(input.assortment ?? []),
    deliveryAddresses: normalizeDeliveryAddresses(input.deliveryAddresses ?? []),
    createdAt: now,
    updatedAt: now,
  };
  store.companies.push(created);
  await writeB2bStore(store);
  return created;
}

export async function setB2bCompanyDeliveryAddresses(
  companyId: string,
  addresses: B2bDeliveryAddress[]
): Promise<B2bCompany> {
  const store = await readB2bStore();
  const existing = store.companies.find((c) => c.id === companyId);
  if (!existing) throw new Error("Company not found.");
  const updated: B2bCompany = {
    ...existing,
    deliveryAddresses: normalizeDeliveryAddresses(addresses),
    updatedAt: new Date().toISOString(),
  };
  store.companies = store.companies.map((c) => (c.id === updated.id ? updated : c));
  await writeB2bStore(store);
  return updated;
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

export async function appendB2bOrder(order: B2bOrder): Promise<B2bOrder> {
  const store = await readB2bStore();
  store.orders = [order, ...store.orders].slice(0, 500);
  await writeB2bStore(store);
  return order;
}

export async function getB2bOrderById(id: string): Promise<B2bOrder | null> {
  const store = await readB2bStore();
  return store.orders.find((o) => o.id === id) ?? null;
}

export async function updateB2bOrder(
  id: string,
  patch: Partial<Pick<B2bOrder, "status" | "payment" | "paymentMode">>
): Promise<B2bOrder | null> {
  const store = await readB2bStore();
  const existing = store.orders.find((o) => o.id === id);
  if (!existing) return null;
  const updated: B2bOrder = {
    ...existing,
    ...patch,
    payment: patch.payment ? { ...existing.payment, ...patch.payment } : existing.payment,
  };
  store.orders = store.orders.map((o) => (o.id === id ? updated : o));
  await writeB2bStore(store);
  return updated;
}

export async function listB2bQuotes(limit = 50): Promise<B2bQuoteRequest[]> {
  const store = await readB2bStore();
  return store.quotes.slice(0, Math.max(1, Math.min(limit, 200)));
}

export async function listB2bOrders(limit = 50): Promise<B2bOrder[]> {
  const store = await readB2bStore();
  return store.orders.slice(0, Math.max(1, Math.min(limit, 200)));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export { slugify as slugifyB2bSlug };
