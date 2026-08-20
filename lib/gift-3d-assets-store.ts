import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import type { GiftShapeFamily } from "./gift-shape-family";

export type Gift3dRefLabel = "front" | "back" | "left" | "right" | "top" | "label" | "other";

export type Gift3dAssetStatus = "missing" | "draft" | "approved" | "rejected";

export type Gift3dReconstructionStatus = "idle" | "queued" | "running" | "ready" | "failed";

export type Gift3dRefImage = {
  id: string;
  url: string;
  label: Gift3dRefLabel;
  /** When true (default), this ref is sent to the reconstruction model. */
  useFor3d?: boolean;
  uploadedAt: string;
};

export type Gift3dProductAsset = {
  productId: string;
  /** Optional gift-builder element id when this product is in the gift catalogue. */
  elementId?: string;
  status: Gift3dAssetStatus;
  /** Packaging silhouette override for the placeholder shape only. */
  shapeFamily: GiftShapeFamily | "auto";
  catalogImageUsable: boolean;
  primaryRefUrl?: string;
  refs: Gift3dRefImage[];
  /** Reconstructed GLB from the image-to-3D model. */
  glbUrl?: string;
  glbThumbnailUrl?: string;
  reconstructionStatus?: Gift3dReconstructionStatus;
  reconstructionError?: string;
  reconstructionProvider?: string;
  reconstructedAt?: string;
  notes: string;
  updatedAt: string;
};

export type Gift3dAssetsStore = {
  products: Record<string, Gift3dProductAsset>;
  updatedAt: string;
};

/** Public builder payload — approved reconstructed meshes only. */
export type Gift3dPublicAsset = {
  productId: string;
  shapeFamily: GiftShapeFamily | "auto";
  glbUrl: string;
  thumbnailUrl?: string;
};

const kvKey = "maroma:gift-3d-assets";
const filePath = path.join(process.cwd(), "data", "gift-3d-assets.json");
const hasKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const RECON_STATUSES: Gift3dReconstructionStatus[] = ["idle", "queued", "running", "ready", "failed"];

function isReconstructionStatus(value: unknown): value is Gift3dReconstructionStatus {
  return typeof value === "string" && RECON_STATUSES.includes(value as Gift3dReconstructionStatus);
}

const REF_LABELS: Gift3dRefLabel[] = ["front", "back", "left", "right", "top", "label", "other"];
const STATUSES: Gift3dAssetStatus[] = ["missing", "draft", "approved", "rejected"];
const SHAPES: Array<GiftShapeFamily | "auto"> = [
  "auto",
  "bottle",
  "jar",
  "bar",
  "box",
  "candle",
  "tube",
  "pouch",
];

function isRefLabel(value: unknown): value is Gift3dRefLabel {
  return typeof value === "string" && REF_LABELS.includes(value as Gift3dRefLabel);
}

function isStatus(value: unknown): value is Gift3dAssetStatus {
  return typeof value === "string" && STATUSES.includes(value as Gift3dAssetStatus);
}

function isShape(value: unknown): value is GiftShapeFamily | "auto" {
  return typeof value === "string" && SHAPES.includes(value as GiftShapeFamily | "auto");
}

export function defaultGift3dAssetsStore(): Gift3dAssetsStore {
  return { products: {}, updatedAt: new Date().toISOString() };
}

export function emptyGift3dProductAsset(productId: string, elementId?: string): Gift3dProductAsset {
  return {
    productId,
    elementId,
    status: "missing",
    shapeFamily: "auto",
    catalogImageUsable: false,
    refs: [],
    reconstructionStatus: "idle",
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

function normalizeRef(raw: unknown): Gift3dRefImage | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<Gift3dRefImage>;
  if (typeof value.id !== "string" || typeof value.url !== "string" || !value.url.trim()) return null;
  return {
    id: value.id,
    url: value.url.trim(),
    label: isRefLabel(value.label) ? value.label : "other",
    useFor3d: value.useFor3d !== false,
    uploadedAt: typeof value.uploadedAt === "string" ? value.uploadedAt : new Date().toISOString(),
  };
}

function normalizeProduct(raw: unknown, fallbackId?: string): Gift3dProductAsset | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<Gift3dProductAsset>;
  const productId = typeof value.productId === "string" ? value.productId : fallbackId;
  if (!productId) return null;
  const refs = (Array.isArray(value.refs) ? value.refs : [])
    .map(normalizeRef)
    .filter((item): item is Gift3dRefImage => Boolean(item));
  const primary =
    typeof value.primaryRefUrl === "string" && value.primaryRefUrl.trim()
      ? value.primaryRefUrl.trim()
      : refs.find((ref) => ref.useFor3d !== false && (ref.label === "front" || ref.label === "label"))?.url ??
        refs.find((ref) => ref.useFor3d !== false)?.url;
  let status: Gift3dAssetStatus = isStatus(value.status) ? value.status : "missing";
  if (status === "missing" && (refs.length > 0 || value.catalogImageUsable || value.glbUrl)) {
    status = "draft";
  }
  const glbUrl = typeof value.glbUrl === "string" && value.glbUrl.trim() ? value.glbUrl.trim() : undefined;
  if (status === "approved" && !glbUrl) {
    status = refs.length > 0 || value.catalogImageUsable ? "draft" : "missing";
  }
  return {
    productId,
    elementId: typeof value.elementId === "string" ? value.elementId : undefined,
    status,
    shapeFamily: isShape(value.shapeFamily) ? value.shapeFamily : "auto",
    catalogImageUsable: value.catalogImageUsable === true,
    primaryRefUrl: primary,
    refs,
    glbUrl,
    glbThumbnailUrl:
      typeof value.glbThumbnailUrl === "string" && value.glbThumbnailUrl.trim()
        ? value.glbThumbnailUrl.trim()
        : undefined,
    reconstructionStatus: isReconstructionStatus(value.reconstructionStatus)
      ? value.reconstructionStatus
      : glbUrl
        ? "ready"
        : "idle",
    reconstructionError: typeof value.reconstructionError === "string" ? value.reconstructionError : undefined,
    reconstructionProvider:
      typeof value.reconstructionProvider === "string" ? value.reconstructionProvider : undefined,
    reconstructedAt: typeof value.reconstructedAt === "string" ? value.reconstructedAt : undefined,
    notes: typeof value.notes === "string" ? value.notes : "",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
}

export function normalizeGift3dAssetsStore(raw: unknown): Gift3dAssetsStore {
  if (!raw || typeof raw !== "object") return defaultGift3dAssetsStore();
  const value = raw as Partial<Gift3dAssetsStore>;
  const products: Record<string, Gift3dProductAsset> = {};
  const source = value.products && typeof value.products === "object" ? value.products : {};
  for (const [id, entry] of Object.entries(source)) {
    const normalized = normalizeProduct(entry, id);
    if (normalized) products[normalized.productId] = normalized;
  }
  return {
    products,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
}

export async function readGift3dAssetsStore(): Promise<Gift3dAssetsStore> {
  if (hasKv) {
    try {
      const saved = await kv.get(kvKey);
      if (saved) return normalizeGift3dAssetsStore(saved);
    } catch {
      /* fall through */
    }
  }
  try {
    return normalizeGift3dAssetsStore(JSON.parse(await fs.readFile(filePath, "utf8")));
  } catch {
    return defaultGift3dAssetsStore();
  }
}

export async function writeGift3dAssetsStore(value: Gift3dAssetsStore): Promise<Gift3dAssetsStore> {
  const next = normalizeGift3dAssetsStore({ ...value, updatedAt: new Date().toISOString() });
  if (hasKv) {
    await kv.set(kvKey, next);
    return next;
  }
  if (process.env.VERCEL) {
    throw new Error("KV is not configured, so 3D assets cannot be saved on Vercel.");
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

/** Public assets are reconstructed GLBs only — not photo-wrapped primitives. */
export function toPublicGift3dAssets(store: Gift3dAssetsStore): Record<string, Gift3dPublicAsset> {
  const out: Record<string, Gift3dPublicAsset> = {};
  for (const asset of Object.values(store.products)) {
    if (asset.status !== "approved" || !asset.glbUrl) continue;
    out[asset.productId] = {
      productId: asset.productId,
      shapeFamily: asset.shapeFamily,
      glbUrl: asset.glbUrl,
      thumbnailUrl: asset.glbThumbnailUrl,
    };
  }
  return out;
}
