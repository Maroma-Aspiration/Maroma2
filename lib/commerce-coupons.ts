import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import type { CouponRecord } from "./commerce-types";

const couponsKvKey = "maroma:commerce-coupons";
const storagePath = path.join(process.cwd(), "data", "commerce-coupons.json");
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

type CouponStore = {
  coupons: Record<string, CouponRecord>;
};

const emptyStore = (): CouponStore => ({ coupons: {} });

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function parseCoupon(value: unknown): CouponRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const code = typeof raw.code === "string" ? normalizeCode(raw.code) : "";
  const type = raw.type;
  const valueNum = typeof raw.value === "number" ? raw.value : NaN;
  if (!code || (type !== "percent" && type !== "fixed") || !Number.isFinite(valueNum) || valueNum <= 0) {
    return null;
  }
  if (type === "percent" && valueNum > 100) return null;
  return {
    code,
    type,
    value: valueNum,
    minSubtotal: typeof raw.minSubtotal === "number" ? raw.minSubtotal : undefined,
    active: raw.active !== false,
    expiresAt: typeof raw.expiresAt === "string" ? raw.expiresAt : undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
  };
}

function parseStore(value: unknown): CouponStore {
  if (!value || typeof value !== "object") return emptyStore();
  const raw = value as Record<string, unknown>;
  const coupons: Record<string, CouponRecord> = {};
  const couponsRaw =
    raw.coupons && typeof raw.coupons === "object" ? (raw.coupons as Record<string, unknown>) : {};
  for (const [, entry] of Object.entries(couponsRaw)) {
    const coupon = parseCoupon(entry);
    if (coupon) coupons[coupon.code] = coupon;
  }
  return { coupons };
}

async function readStore(): Promise<CouponStore> {
  if (hasKvConfig) {
    try {
      const stored = await kv.get(couponsKvKey);
      if (stored) return parseStore(stored);
    } catch {
      // fall through
    }
  }
  try {
    const raw = await fs.readFile(storagePath, "utf8");
    return parseStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: CouponStore): Promise<void> {
  if (hasKvConfig) {
    try {
      await kv.set(couponsKvKey, store);
      return;
    } catch {
      // fall through
    }
  }
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(store, null, 2), "utf8");
}

export function couponIsActive(coupon: CouponRecord, now = Date.now()): boolean {
  if (!coupon.active) return false;
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) return false;
  return true;
}

export async function listCoupons(): Promise<CouponRecord[]> {
  const store = await readStore();
  return Object.values(store.coupons).sort((a, b) => a.code.localeCompare(b.code));
}

export async function hasActivePromo(): Promise<boolean> {
  const coupons = await listCoupons();
  return coupons.some((coupon) => couponIsActive(coupon));
}

export async function getCoupon(code: string): Promise<CouponRecord | null> {
  const store = await readStore();
  return store.coupons[normalizeCode(code)] ?? null;
}

export async function upsertCoupon(coupon: CouponRecord): Promise<CouponRecord> {
  const parsed = parseCoupon(coupon);
  if (!parsed) throw new Error("Invalid coupon.");
  const store = await readStore();
  store.coupons[parsed.code] = parsed;
  await writeStore(store);
  return parsed;
}

export async function deleteCoupon(code: string): Promise<boolean> {
  const normalized = normalizeCode(code);
  const store = await readStore();
  if (!store.coupons[normalized]) return false;
  delete store.coupons[normalized];
  await writeStore(store);
  return true;
}

export type CouponValidation = {
  ok: true;
  coupon: CouponRecord;
  discountAmount: number;
};

export type CouponValidationError = {
  ok: false;
  message: string;
};

export async function validateCouponForSubtotal(
  code: string,
  subtotalAfterRitualDiscount: number
): Promise<CouponValidation | CouponValidationError> {
  const coupon = await getCoupon(code);
  if (!coupon) return { ok: false, message: "This promo code is not valid." };
  if (!coupon.active) return { ok: false, message: "This promo code is no longer active." };
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
    return { ok: false, message: "This promo code has expired." };
  }
  if (coupon.minSubtotal && subtotalAfterRitualDiscount < coupon.minSubtotal) {
    return {
      ok: false,
      message: `Minimum order of ₹${coupon.minSubtotal.toLocaleString("en-IN")} required for this code.`,
    };
  }
  const base = Math.max(0, subtotalAfterRitualDiscount);
  const discountAmount =
    coupon.type === "percent"
      ? Math.round(base * (coupon.value / 100) * 100) / 100
      : Math.min(base, coupon.value);
  if (discountAmount <= 0) {
    return { ok: false, message: "This promo code does not apply to your basket." };
  }
  return { ok: true, coupon, discountAmount };
}
