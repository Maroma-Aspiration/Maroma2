import { readJsonKv, writeJsonKv } from "./json-kv-store";
import type { QrProductPage, QrProductPageStore } from "./qr-product-page-types";

const KV_KEY = "maroma:qr-product-pages";
const FILE_NAME = "qr-product-pages.json";
const emptyStore = (): QrProductPageStore => ({ pages: {} });

export async function readQrProductPageStore(): Promise<QrProductPageStore> {
  const value = await readJsonKv<QrProductPageStore>(KV_KEY, FILE_NAME, emptyStore());
  return value?.pages && typeof value.pages === "object" ? value : emptyStore();
}

export async function writeQrProductPageStore(store: QrProductPageStore): Promise<void> {
  await writeJsonKv(KV_KEY, FILE_NAME, store);
}

export async function readPublishedQrProductPage(slug: string): Promise<QrProductPage | null> {
  const store = await readQrProductPageStore();
  const page = Object.values(store.pages).find((item) => item.slug === slug && item.status === "published");
  return page ?? null;
}
