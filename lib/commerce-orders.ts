import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { kv } from "@vercel/kv";
import type { OrderRecord, OrderStatus } from "./commerce-types";

const ordersKvKey = "maroma:commerce-orders";
const orderKvPrefix = "maroma:order:";
const storagePath = path.join(process.cwd(), "data", "commerce-orders.json");
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

type OrderStore = {
  orderNumberSeq: number;
  orders: Record<string, OrderRecord>;
  byEmail: Record<string, string[]>;
};

const emptyStore = (): OrderStore => ({
  orderNumberSeq: 100000,
  orders: {},
  byEmail: {},
});

function parseOrder(value: unknown): OrderRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const orderNumber = typeof raw.orderNumber === "string" ? raw.orderNumber.trim() : "";
  const status = raw.status;
  if (!id || !orderNumber || typeof status !== "string") return null;
  if (!["pending_payment", "paid", "fulfilled", "cancelled"].includes(status)) return null;
  const shipping = raw.shipping;
  if (!shipping || typeof shipping !== "object") return null;
  const ship = shipping as Record<string, unknown>;
  const linesRaw = Array.isArray(raw.lines) ? raw.lines : [];
  const lines = linesRaw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const line = entry as Record<string, unknown>;
      const productId = typeof line.productId === "string" ? line.productId : "";
      const name = typeof line.name === "string" ? line.name : "";
      const sku = typeof line.sku === "string" ? line.sku : "";
      const price = typeof line.price === "number" ? line.price : NaN;
      const quantity = typeof line.quantity === "number" ? line.quantity : 0;
      const image = typeof line.image === "string" ? line.image : "";
      if (!productId || !name || !Number.isFinite(price) || quantity < 1) return null;
      return {
        productId,
        sku,
        name,
        price,
        quantity,
        image,
        variant: typeof line.variant === "string" ? line.variant : undefined,
      };
    })
    .filter(Boolean) as OrderRecord["lines"];

  return {
    id,
    orderNumber,
    status: status as OrderStatus,
    cartId: typeof raw.cartId === "string" ? raw.cartId : "",
    customerEmail: typeof raw.customerEmail === "string" ? raw.customerEmail : "",
    shipping: {
      email: typeof ship.email === "string" ? ship.email : "",
      phone: typeof ship.phone === "string" ? ship.phone : "",
      firstName: typeof ship.firstName === "string" ? ship.firstName : "",
      lastName: typeof ship.lastName === "string" ? ship.lastName : "",
      address: typeof ship.address === "string" ? ship.address : "",
      city: typeof ship.city === "string" ? ship.city : "",
      pincode: typeof ship.pincode === "string" ? ship.pincode : "",
      state: typeof ship.state === "string" ? ship.state : "",
      country: typeof ship.country === "string" ? ship.country : "India",
    },
    lines,
    subtotal: typeof raw.subtotal === "number" ? raw.subtotal : 0,
    discountRate: typeof raw.discountRate === "number" ? raw.discountRate : 0,
    discountAmount: typeof raw.discountAmount === "number" ? raw.discountAmount : 0,
    couponCode: typeof raw.couponCode === "string" ? raw.couponCode : undefined,
    shippingInr: typeof raw.shippingInr === "number" ? raw.shippingInr : 0,
    total: typeof raw.total === "number" ? raw.total : 0,
    notifications:
      raw.notifications && typeof raw.notifications === "object"
        ? {
            email: Boolean((raw.notifications as Record<string, unknown>).email),
            whatsapp: Boolean((raw.notifications as Record<string, unknown>).whatsapp),
          }
        : { email: true, whatsapp: false },
    payment:
      raw.payment && typeof raw.payment === "object"
        ? (raw.payment as OrderRecord["payment"])
        : undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

function parseStore(value: unknown): OrderStore {
  if (!value || typeof value !== "object") return emptyStore();
  const raw = value as Record<string, unknown>;
  const orders: Record<string, OrderRecord> = {};
  const ordersRaw = raw.orders && typeof raw.orders === "object" ? (raw.orders as Record<string, unknown>) : {};
  for (const [key, entry] of Object.entries(ordersRaw)) {
    const order = parseOrder(entry);
    if (order) orders[key] = order;
  }
  const byEmail: Record<string, string[]> = {};
  const byEmailRaw = raw.byEmail && typeof raw.byEmail === "object" ? (raw.byEmail as Record<string, unknown>) : {};
  for (const [email, ids] of Object.entries(byEmailRaw)) {
    if (Array.isArray(ids)) {
      byEmail[email] = ids.filter((id): id is string => typeof id === "string");
    }
  }
  return {
    orderNumberSeq:
      typeof raw.orderNumberSeq === "number" && Number.isFinite(raw.orderNumberSeq)
        ? Math.floor(raw.orderNumberSeq)
        : 100000,
    orders,
    byEmail,
  };
}

async function readStore(): Promise<OrderStore> {
  if (hasKvConfig) {
    try {
      const stored = await kv.get(ordersKvKey);
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

async function writeStore(store: OrderStore): Promise<void> {
  if (hasKvConfig) {
    try {
      await kv.set(ordersKvKey, store);
      for (const order of Object.values(store.orders)) {
        await kv.set(`${orderKvPrefix}${order.id}`, order);
      }
      return;
    } catch {
      // fall through
    }
  }
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(store, null, 2), "utf8");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function nextOrderNumber(store: OrderStore): { orderNumber: string; nextSeq: number } {
  const seq = store.orderNumberSeq + 1;
  return { orderNumber: `MRM-${seq}`, nextSeq: seq };
}

export async function saveOrder(order: OrderRecord): Promise<OrderRecord> {
  const store = await readStore();
  const next = parseOrder(order);
  if (!next) throw new Error("Invalid order record.");
  next.updatedAt = new Date().toISOString();
  store.orders[next.id] = next;
  const email = normalizeEmail(next.customerEmail);
  if (email) {
    const existing = store.byEmail[email] ?? [];
    if (!existing.includes(next.id)) {
      store.byEmail[email] = [next.id, ...existing];
    }
  }
  await writeStore(store);
  return next;
}

export async function createOrder(
  draft: Omit<OrderRecord, "id" | "orderNumber" | "createdAt" | "updatedAt">
): Promise<OrderRecord> {
  const store = await readStore();
  const { orderNumber, nextSeq } = nextOrderNumber(store);
  const now = new Date().toISOString();
  const order: OrderRecord = {
    ...draft,
    id: randomUUID(),
    orderNumber,
    createdAt: now,
    updatedAt: now,
  };
  store.orderNumberSeq = nextSeq;
  store.orders[order.id] = order;
  const email = normalizeEmail(order.customerEmail);
  if (email) {
    const existing = store.byEmail[email] ?? [];
    store.byEmail[email] = [order.id, ...existing];
  }
  await writeStore(store);
  return order;
}

export async function getOrderById(orderId: string): Promise<OrderRecord | null> {
  const id = orderId.trim();
  if (!id) return null;
  if (hasKvConfig) {
    try {
      const stored = await kv.get(`${orderKvPrefix}${id}`);
      const order = parseOrder(stored);
      if (order) return order;
    } catch {
      // fall through
    }
  }
  const store = await readStore();
  return store.orders[id] ?? null;
}

export async function getOrderByNumber(orderNumber: string): Promise<OrderRecord | null> {
  const normalized = orderNumber.trim().toUpperCase();
  if (!normalized) return null;
  const store = await readStore();
  return Object.values(store.orders).find((o) => o.orderNumber.toUpperCase() === normalized) ?? null;
}

export async function listOrders(opts?: {
  status?: OrderStatus;
  limit?: number;
}): Promise<OrderRecord[]> {
  const store = await readStore();
  let orders = Object.values(store.orders);
  orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (opts?.status) {
    orders = orders.filter((o) => o.status === opts.status);
  }
  const limit = opts?.limit && opts.limit > 0 ? opts.limit : undefined;
  return limit ? orders.slice(0, limit) : orders;
}

export async function listOrdersForEmail(email: string, limit = 20): Promise<OrderRecord[]> {
  const store = await readStore();
  const ids = store.byEmail[normalizeEmail(email)] ?? [];
  const orders = ids
    .map((id) => store.orders[id])
    .filter((o): o is OrderRecord => Boolean(o));
  orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return orders.slice(0, limit);
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  patch?: Partial<Pick<OrderRecord, "payment">>
): Promise<OrderRecord | null> {
  const store = await readStore();
  const existing = store.orders[orderId];
  if (!existing) return null;
  const updated: OrderRecord = {
    ...existing,
    status,
    payment: patch?.payment ? { ...existing.payment, ...patch.payment } : existing.payment,
    updatedAt: new Date().toISOString(),
  };
  store.orders[orderId] = updated;
  await writeStore(store);
  return updated;
}
