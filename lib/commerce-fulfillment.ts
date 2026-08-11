import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import type { OrderLineSnapshot, OrderRecord } from "./commerce-types";
import {
  expandOrderGiftSets,
  giftSetCategoryLabel,
  orderHasGiftSets,
  orderRegularLines,
  type ProductionGiftSetLine,
} from "./gift-set-production";

const fulfillmentKvKey = "maroma:commerce-fulfillment";
const storagePath = path.join(process.cwd(), "data", "commerce-fulfillment.json");
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export type FulfillmentStage = "prepare" | "pack" | "ship";

export type FulfillmentChecklistItem = {
  key: string;
  stage: FulfillmentStage;
  label: string;
  sublabel?: string;
  image?: string;
  setName?: string;
  copyLabel?: string;
};

export type OrderFulfillmentState = {
  checked: Record<string, boolean>;
  updatedAt: string;
};

type FulfillmentStore = {
  orders: Record<string, OrderFulfillmentState>;
};

const emptyStore = (): FulfillmentStore => ({ orders: {} });

function parseStore(raw: unknown): FulfillmentStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const record = raw as Record<string, unknown>;
  const ordersRaw =
    record.orders && typeof record.orders === "object"
      ? (record.orders as Record<string, unknown>)
      : {};
  const orders: Record<string, OrderFulfillmentState> = {};

  for (const [orderId, entry] of Object.entries(ordersRaw)) {
    if (!entry || typeof entry !== "object") continue;
    const value = entry as Record<string, unknown>;
    const checkedRaw =
      value.checked && typeof value.checked === "object"
        ? (value.checked as Record<string, unknown>)
        : {};
    const checked: Record<string, boolean> = {};
    for (const [key, flag] of Object.entries(checkedRaw)) {
      checked[key] = Boolean(flag);
    }
    orders[orderId] = {
      checked,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
    };
  }

  return { orders };
}

async function readStore(): Promise<FulfillmentStore> {
  if (hasKvConfig) {
    try {
      const stored = await kv.get(fulfillmentKvKey);
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

async function writeStore(store: FulfillmentStore): Promise<void> {
  if (hasKvConfig) {
    try {
      await kv.set(fulfillmentKvKey, store);
      return;
    } catch {
      // fall through
    }
  }
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(store, null, 2), "utf8");
}

export function buildOrderChecklist(order: OrderRecord): FulfillmentChecklistItem[] {
  const items: FulfillmentChecklistItem[] = [];
  const giftSets = expandOrderGiftSets(order);
  const regularLines = orderRegularLines(order, giftSets);

  for (const set of giftSets) {
    for (let copyIndex = 0; copyIndex < set.quantity; copyIndex += 1) {
      const copyLabel =
        set.quantity > 1 ? `Copy ${copyIndex + 1} of ${set.quantity}` : undefined;
      const copyPrefix = `set:${set.lineIndex}:copy:${copyIndex}`;

      for (const element of set.elements) {
        items.push({
          key: `${copyPrefix}:slot:${element.slot}`,
          stage: "prepare",
          label: element.name,
          sublabel: `${giftSetCategoryLabel(element.category)} · Slot ${element.slot}`,
          image: element.image,
          setName: set.setName,
          copyLabel,
        });
      }

      items.push({
        key: `${copyPrefix}:box-sealed`,
        stage: "pack",
        label: `Seal ${set.box.name} box`,
        sublabel: set.setName,
        setName: set.setName,
        copyLabel,
      });

      if (set.card) {
        items.push({
          key: `${copyPrefix}:card-done`,
          stage: "pack",
          label: "Greeting card written & placed",
          sublabel: set.card.message,
          setName: set.setName,
          copyLabel,
        });
      }
    }
  }

  regularLines.forEach((line, index) => {
    items.push({
      key: `regular:${index}`,
      stage: "pack",
      label: line.name,
      sublabel: `Qty ${line.quantity}`,
      image: line.image,
    });
  });

  items.push(
    {
      key: "dispatch:qc",
      stage: "ship",
      label: "Quality checked",
      sublabel: "All items packed correctly",
    },
    {
      key: "dispatch:label",
      stage: "ship",
      label: "Shipping label applied",
      sublabel: "Address verified",
    },
    {
      key: "dispatch:ready",
      stage: "ship",
      label: "Ready for courier pickup",
      sublabel: order.orderNumber,
    }
  );

  return items;
}

export type FulfillmentProgress = {
  total: number;
  done: number;
  percent: number;
  stages: Record<FulfillmentStage, { total: number; done: number; complete: boolean }>;
};

export function computeFulfillmentProgress(
  checklist: FulfillmentChecklistItem[],
  checked: Record<string, boolean>
): FulfillmentProgress {
  const stages: FulfillmentProgress["stages"] = {
    prepare: { total: 0, done: 0, complete: false },
    pack: { total: 0, done: 0, complete: false },
    ship: { total: 0, done: 0, complete: false },
  };

  let total = 0;
  let done = 0;

  for (const item of checklist) {
    total += 1;
    const isDone = Boolean(checked[item.key]);
    if (isDone) done += 1;
    stages[item.stage].total += 1;
    if (isDone) stages[item.stage].done += 1;
  }

  for (const stage of Object.keys(stages) as FulfillmentStage[]) {
    stages[stage].complete = stages[stage].total > 0 && stages[stage].done === stages[stage].total;
  }

  return {
    total,
    done,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
    stages,
  };
}

export async function getOrderFulfillmentState(orderId: string): Promise<OrderFulfillmentState> {
  const store = await readStore();
  return store.orders[orderId] ?? { checked: {}, updatedAt: new Date(0).toISOString() };
}

export async function setFulfillmentItemChecked(
  orderId: string,
  key: string,
  checked: boolean
): Promise<OrderFulfillmentState> {
  const store = await readStore();
  const existing = store.orders[orderId] ?? { checked: {}, updatedAt: new Date(0).toISOString() };
  const nextChecked = { ...existing.checked, [key]: checked };
  if (!checked) {
    delete nextChecked[key];
  }
  const next: OrderFulfillmentState = {
    checked: nextChecked,
    updatedAt: new Date().toISOString(),
  };
  store.orders[orderId] = next;
  await writeStore(store);
  return next;
}

export type FulfillmentOrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderRecord["status"];
  customerEmail: string;
  customerName: string;
  city: string;
  pincode: string;
  total: number;
  createdAt: string;
  hasGiftSets: boolean;
  giftSetCount: number;
  lineCount: number;
  progress: FulfillmentProgress;
  fulfillmentUpdatedAt: string;
  previewImages: string[];
};

export function buildFulfillmentOrderSummary(
  order: OrderRecord,
  fulfillment: OrderFulfillmentState
): FulfillmentOrderSummary {
  const checklist = buildOrderChecklist(order);
  const giftSets = expandOrderGiftSets(order);
  const previewImages = checklist
    .map((item) => item.image)
    .filter((image): image is string => Boolean(image))
    .slice(0, 4);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerEmail: order.customerEmail,
    customerName: `${order.shipping.firstName} ${order.shipping.lastName}`.trim(),
    city: order.shipping.city,
    pincode: order.shipping.pincode,
    total: order.total,
    createdAt: order.createdAt,
    hasGiftSets: orderHasGiftSets(order),
    giftSetCount: giftSets.reduce((sum, set) => sum + set.quantity, 0),
    lineCount: order.lines.length,
    progress: computeFulfillmentProgress(checklist, fulfillment.checked),
    fulfillmentUpdatedAt: fulfillment.updatedAt,
    previewImages,
  };
}

export type FulfillmentOrderDetail = FulfillmentOrderSummary & {
  order: OrderRecord;
  giftSets: ProductionGiftSetLine[];
  regularLines: OrderLineSnapshot[];
  checklist: FulfillmentChecklistItem[];
  checked: Record<string, boolean>;
};

export async function buildFulfillmentOrderDetail(order: OrderRecord): Promise<FulfillmentOrderDetail> {
  const fulfillment = await getOrderFulfillmentState(order.id);
  const giftSets = expandOrderGiftSets(order);
  const regularLines = orderRegularLines(order, giftSets);
  const checklist = buildOrderChecklist(order);

  return {
    ...buildFulfillmentOrderSummary(order, fulfillment),
    order,
    giftSets,
    regularLines,
    checklist,
    checked: fulfillment.checked,
  };
}
