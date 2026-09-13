import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { kv } from "@vercel/kv";
import {
  FLAT_SHIPPING_INR,
  FREE_SHIPPING_THRESHOLD,
  MAX_LINE_QUANTITY,
} from "./commerce-config";
import { resolveCommerceProduct, resolveCommerceProducts } from "./commerce-product";
import { getRitualSet } from "./commerce-ritual-sets";
import { buildGiftSetProductId, parseGiftSetProductId, validateGiftSet } from "./gift-builder";
import { giftSetCartDisplayName, encodeGiftSetVariant } from "./gift-set-variant";
import { hasActivePromo, validateCouponForSubtotal } from "./commerce-coupons";
import type {
  CartLine,
  CartRecord,
  CartTotals,
  CartView,
  CartItemView,
} from "./commerce-types";

const cartKvPrefix = "maroma:cart:";
const storageDir = path.join(process.cwd(), "data");
const storagePath = path.join(storageDir, "commerce-carts.json");
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

type FileCartStore = Record<string, CartRecord>;

function emptyCart(id: string): CartRecord {
  return {
    id,
    lines: [],
    discountRate: 0,
    updatedAt: new Date().toISOString(),
  };
}

function parseCart(value: unknown, fallbackId: string): CartRecord {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : fallbackId;
  const linesRaw = Array.isArray(raw.lines) ? raw.lines : [];
  const lines: CartLine[] = [];
  for (const entry of linesRaw) {
    if (!entry || typeof entry !== "object") continue;
    const line = entry as Record<string, unknown>;
    const productId = typeof line.productId === "string" ? line.productId.trim() : "";
    const lineId = typeof line.id === "string" && line.id.trim() ? line.id.trim() : "";
    const quantity = typeof line.quantity === "number" ? Math.floor(line.quantity) : 0;
    if (!productId || !lineId || quantity < 1) continue;
    lines.push({
      id: lineId,
      productId,
      quantity: Math.min(MAX_LINE_QUANTITY, quantity),
      variant: typeof line.variant === "string" && line.variant ? line.variant : undefined,
    });
  }
  const discountRate =
    typeof raw.discountRate === "number" && Number.isFinite(raw.discountRate)
      ? Math.min(1, Math.max(0, raw.discountRate))
      : 0;
  const couponCode = typeof raw.couponCode === "string" && raw.couponCode.trim() ? raw.couponCode.trim() : undefined;
  const couponDiscountAmount =
    typeof raw.couponDiscountAmount === "number" && Number.isFinite(raw.couponDiscountAmount)
      ? Math.max(0, raw.couponDiscountAmount)
      : undefined;
  return {
    id,
    lines,
    discountRate,
    couponCode,
    couponDiscountAmount,
    updatedAt:
      typeof raw.updatedAt === "string" && raw.updatedAt ? raw.updatedAt : new Date().toISOString(),
  };
}

async function readFileStore(): Promise<FileCartStore> {
  try {
    const raw = await fs.readFile(storagePath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: FileCartStore = {};
    for (const [key, value] of Object.entries(parsed)) {
      out[key] = parseCart(value, key);
    }
    return out;
  } catch {
    return {};
  }
}

async function writeFileStore(store: FileCartStore): Promise<void> {
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(store, null, 2), "utf8");
}

export async function readCart(cartId: string): Promise<CartRecord> {
  const id = cartId.trim();
  if (!id) return emptyCart(randomUUID());

  if (hasKvConfig) {
    try {
      const stored = await kv.get(`${cartKvPrefix}${id}`);
      if (stored) return parseCart(stored, id);
    } catch {
      // fall through
    }
  }

  const store = await readFileStore();
  return store[id] ? parseCart(store[id], id) : emptyCart(id);
}

export async function writeCart(cart: CartRecord): Promise<CartRecord> {
  const next = parseCart(cart, cart.id);
  next.updatedAt = new Date().toISOString();

  if (hasKvConfig) {
    try {
      await kv.set(`${cartKvPrefix}${next.id}`, next);
      return next;
    } catch {
      // fall through
    }
  }

  const store = await readFileStore();
  store[next.id] = next;
  await writeFileStore(store);
  return next;
}

export async function createCart(): Promise<CartRecord> {
  const cart = emptyCart(randomUUID());
  return writeCart(cart);
}

export function computeTotals(
  items: Array<{ price: number; quantity: number }>,
  discountRate: number,
  couponDiscountAmount = 0
): CartTotals {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const rate = Math.min(1, Math.max(0, discountRate));
  const ritualDiscount = Math.round(subtotal * rate * 100) / 100;
  const afterRitual = Math.max(0, subtotal - ritualDiscount);
  const couponDiscount = Math.min(afterRitual, Math.max(0, couponDiscountAmount));
  const discountAmount = ritualDiscount + couponDiscount;
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const shipping =
    discountedSubtotal === 0 || discountedSubtotal >= FREE_SHIPPING_THRESHOLD
      ? 0
      : FLAT_SHIPPING_INR;
  const total = discountedSubtotal + shipping;
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    subtotal,
    discountRate: rate,
    discountAmount,
    shipping,
    total,
    totalItems,
  };
}

export async function buildCartView(cart: CartRecord): Promise<CartView> {
  const products = await resolveCommerceProducts(cart.lines.map((line) => line.productId));
  const items: CartItemView[] = [];

  for (const line of cart.lines) {
    const product = products.get(line.productId);
    if (!product || !product.active) continue;
    const quantity = Math.min(line.quantity, product.stock, MAX_LINE_QUANTITY);
    if (quantity < 1) continue;
    items.push({
      id: line.id,
      productId: product.id,
      name: parseGiftSetProductId(product.id)
        ? giftSetCartDisplayName(product.name, line.variant)
        : product.name,
      price: product.price,
      image: product.image,
      quantity,
      variant: line.variant,
      maxQuantity: Math.min(product.stock, MAX_LINE_QUANTITY),
      ukAndChannelIslandsRestricted: product.ukAndChannelIslandsRestricted === true,
    });
  }

  const totals = computeTotals(items, cart.discountRate, cart.couponDiscountAmount ?? 0);
  return {
    id: cart.id,
    items,
    couponCode: cart.couponCode,
    promoAvailable: await hasActivePromo(),
    ...totals,
  };
}

export class CartError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "CartError";
    this.status = status;
  }
}

export async function addToCartServer(
  cartId: string,
  productId: string,
  quantity = 1,
  variant?: string
): Promise<CartView> {
  const qty = Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.floor(quantity) || 1));
  const product = await resolveCommerceProduct(productId);
  if (!product) throw new CartError("Product not found.", 404);
  if (!product.active || product.stock < 1) throw new CartError("Product is out of stock.", 409);

  const cart = await readCart(cartId);
  const existing = cart.lines.find(
    (line) => line.productId === product.id && (line.variant || undefined) === (variant || undefined)
  );
  const nextQty = Math.min(MAX_LINE_QUANTITY, product.stock, (existing?.quantity ?? 0) + qty);
  if (nextQty < 1) throw new CartError("Product is out of stock.", 409);
  if (existing && nextQty === existing.quantity && existing.quantity >= product.stock) {
    throw new CartError("Not enough stock for the requested quantity.", 409);
  }

  if (existing) {
    existing.quantity = nextQty;
  } else {
    cart.lines.push({
      id: `${product.id}-${variant || "default"}-${randomUUID().slice(0, 8)}`,
      productId: product.id,
      quantity: nextQty,
      variant: variant || undefined,
    });
  }

  const ritual = getRitualSet(product.id);
  if (ritual) {
    cart.discountRate = Math.max(cart.discountRate, ritual.discountRate);
  }

  const saved = await writeCart(cart);
  return buildCartView(saved);
}

export async function addGiftSetToCartServer(
  cartId: string,
  boxId: string,
  elementIds: string[],
  quantity = 1,
  setName?: string,
  cardId?: string,
  cardMessage?: string
): Promise<CartView> {
  const validation = await validateGiftSet(boxId, elementIds, cardId);
  if (!validation.ok || !validation.elementIds) {
    throw new CartError(validation.error ?? "Invalid gift set.", 400);
  }

  const productId = buildGiftSetProductId(
    boxId,
    validation.elementIds,
    validation.cardId
  );
  const variant = encodeGiftSetVariant({
    setName: setName?.trim() || "Custom gift set",
    cardId: validation.cardId,
    cardMessage: cardMessage?.trim(),
  });
  return addToCartServer(cartId, productId, quantity, variant);
}

export async function updateCartLineServer(
  cartId: string,
  lineId: string,
  quantity: number
): Promise<CartView> {
  const cart = await readCart(cartId);
  const line = cart.lines.find((entry) => entry.id === lineId);
  if (!line) throw new CartError("Cart line not found.", 404);

  const qty = Math.floor(quantity);
  if (qty < 1) {
    cart.lines = cart.lines.filter((entry) => entry.id !== lineId);
  } else {
    const product = await resolveCommerceProduct(line.productId);
    if (!product) {
      cart.lines = cart.lines.filter((entry) => entry.id !== lineId);
    } else {
      line.quantity = Math.min(MAX_LINE_QUANTITY, product.stock, qty);
      if (line.quantity < 1) {
        cart.lines = cart.lines.filter((entry) => entry.id !== lineId);
      }
    }
  }

  if (!cart.lines.some((entry) => getRitualSet(entry.productId))) {
    cart.discountRate = 0;
  }

  const saved = await writeCart(cart);
  return buildCartView(saved);
}

export async function removeCartLineServer(cartId: string, lineId: string): Promise<CartView> {
  return updateCartLineServer(cartId, lineId, 0);
}

export async function clearCartServer(cartId: string): Promise<CartView> {
  const cart = emptyCart(cartId);
  const saved = await writeCart(cart);
  return buildCartView(saved);
}

export async function applyCouponServer(cartId: string, code: string): Promise<CartView> {
  const cart = await readCart(cartId);
  const view = await buildCartView(cart);
  if (view.items.length === 0) {
    throw new CartError("Add items to your basket before applying a promo code.", 400);
  }
  const ritualDiscount = Math.round(view.subtotal * view.discountRate * 100) / 100;
  const subtotalAfterRitual = Math.max(0, view.subtotal - ritualDiscount);
  const result = await validateCouponForSubtotal(code, subtotalAfterRitual);
  if (!result.ok) {
    throw new CartError(result.message, 400);
  }
  cart.couponCode = result.coupon.code;
  cart.couponDiscountAmount = result.discountAmount;
  const saved = await writeCart(cart);
  return buildCartView(saved);
}

export async function removeCouponServer(cartId: string): Promise<CartView> {
  const cart = await readCart(cartId);
  delete cart.couponCode;
  delete cart.couponDiscountAmount;
  const saved = await writeCart(cart);
  return buildCartView(saved);
}

export async function getOrCreateCart(cartId: string | undefined | null): Promise<CartRecord> {
  if (cartId && cartId.trim()) {
    return readCart(cartId.trim());
  }
  return createCart();
}
