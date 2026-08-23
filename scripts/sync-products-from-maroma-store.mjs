#!/usr/bin/env node
/**
 * Pull the live WooCommerce catalogue from www.maroma.com (Store API) into
 * data/maroma-products.json and refresh data/maroma-live-product-ids.json.
 *
 * Usage:
 *   node scripts/sync-products-from-maroma-store.mjs
 *   node scripts/sync-products-from-maroma-store.mjs --dry-run
 *   node scripts/sync-products-from-maroma-store.mjs --skip-images
 */

import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PRODUCTS_PATH = join(ROOT, "data", "maroma-products.json");
const LIVE_IDS_PATH = join(ROOT, "data", "maroma-live-product-ids.json");
const BACKUP_PATH = join(ROOT, "data", "maroma-products.pre-catalog-sync.json");
const PUBLIC = join(ROOT, "public");
const STORE_BASE = "https://www.maroma.com/wp-json/wc/store/v1/products";
const PER_PAGE = 100;

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const skipImages = args.has("--skip-images");

function decodeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&ldquo;/g, '"')
    .replace(/&#8221;|&rdquo;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#0*39;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html) {
  return decodeHtml(String(html || ""))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function priceFromStore(item) {
  const prices = item.prices || {};
  const minor = prices.currency_minor_unit ?? 2;
  const divisor = 10 ** minor;
  const raw = item.on_sale && prices.sale_price ? prices.sale_price : prices.regular_price;
  if (raw == null || raw === "") return "0";
  const num = Number(raw) / divisor;
  if (!Number.isFinite(num)) return "0";
  return Number.isInteger(num) ? String(num) : String(num);
}

function isPlaceholderImage(src) {
  const u = String(src || "").toLowerCase();
  return (
    u.includes("woocommerce-placeholder") ||
    u.includes("2013/04/large.jpg")
  );
}

function toLocalPathFromSrc(src) {
  try {
    const url = new URL(src);
    const pathname = url.pathname;
    if (!pathname.startsWith("/wp-content/uploads/")) return null;
    const relativeFromStaging = pathname.slice(1);
    return {
      diskPath: join(PUBLIC, "staging-media", relativeFromStaging),
      publicUrl: `/staging-media/${relativeFromStaging}`,
    };
  } catch {
    return null;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MaromaCatalogSync/1.0",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return { json: await res.json(), headers: res.headers };
}

async function downloadFile(url, destPath) {
  mkdirSync(dirname(destPath), { recursive: true });
  const res = await fetch(url, {
    headers: { "User-Agent": "MaromaCatalogSync/1.0" },
  });
  if (!res.ok || !res.body) throw new Error(`Download failed ${res.status} ${url}`);
  const tmp = `${destPath}.part`;
  await pipeline(res.body, createWriteStream(tmp));
  renameSync(tmp, destPath);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapAttributes(attributes) {
  const out = {};
  for (const attr of attributes || []) {
    const name = String(attr?.name || "").trim();
    if (!name) continue;
    const terms = (attr.terms || [])
      .map((term) => String(term?.name || "").trim())
      .filter(Boolean);
    if (terms.length) out[name] = terms;
  }
  return out;
}

async function mapImages(item) {
  const srcs = (item.images || [])
    .map((img) => img?.src)
    .filter((src) => src && !isPlaceholderImage(src));

  const mapped = [];
  for (const src of srcs) {
    const local = toLocalPathFromSrc(src);
    if (!local) continue;
    if (!skipImages && !dryRun) {
      if (!existsSync(local.diskPath)) {
        try {
          await downloadFile(src, local.diskPath);
          await sleep(120);
        } catch (err) {
          console.warn(`Image skip ${item.sku || item.id}: ${err.message}`);
          continue;
        }
      }
    }
    mapped.push(local.publicUrl);
  }
  return mapped;
}

function mapStoreProduct(item, images) {
  const description = stripHtml(item.description);
  const shortDescription = stripHtml(item.short_description);
  const categories = (item.categories || [])
    .map((cat) => String(cat?.name || "").trim())
    .filter(Boolean);
  const tags = (item.tags || [])
    .map((tag) => String(tag?.name || "").trim())
    .filter(Boolean);
  const brand =
    (item.brands || [])
      .map((entry) => String(entry?.name || "").trim())
      .filter(Boolean)[0] || "";

  return {
    id: String(item.id),
    sku: String(item.sku || "").trim(),
    name: decodeHtml(item.name || "").trim(),
    description: description || shortDescription,
    shortDescription: shortDescription || description,
    price: priceFromStore(item),
    categories,
    tags,
    brand,
    images: [...images],
    imageUrl: images[0] || "",
    attributes: mapAttributes(item.attributes),
  };
}

async function fetchAllStoreProducts() {
  const all = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${STORE_BASE}?per_page=${PER_PAGE}&page=${page}`;
    await sleep(page === 1 ? 0 : 180);
    const { json, headers } = await fetchJson(url);
    if (!Array.isArray(json)) throw new Error(`Unexpected response on page ${page}`);
    all.push(...json);
    totalPages = Number(headers.get("x-wp-totalpages") || 1);
    console.log(`Fetched page ${page}/${totalPages} (${json.length} products)`);
    page += 1;
  }

  return all;
}

async function main() {
  console.log("Pulling catalogue from maroma.com Store API…");
  const storeProducts = await fetchAllStoreProducts();
  console.log(`Store returned ${storeProducts.length} products`);

  const mapped = [];
  let imageFailures = 0;

  for (let i = 0; i < storeProducts.length; i += 1) {
    const item = storeProducts[i];
    const images = await mapImages(item);
    if ((item.images || []).length && images.length === 0) imageFailures += 1;
    mapped.push(mapStoreProduct(item, images));
    if ((i + 1) % 50 === 0) {
      console.log(`Mapped ${i + 1}/${storeProducts.length}…`);
    }
  }

  mapped.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  const liveIds = mapped.map((product) => product.id);

  if (!dryRun) {
    if (existsSync(PRODUCTS_PATH)) {
      writeFileSync(BACKUP_PATH, readFileSync(PRODUCTS_PATH, "utf8"), "utf8");
      console.log("Backup:", BACKUP_PATH);
    }
    writeFileSync(PRODUCTS_PATH, `${JSON.stringify(mapped, null, 2)}\n`, "utf8");
    writeFileSync(LIVE_IDS_PATH, `${JSON.stringify(liveIds, null, 2)}\n`, "utf8");
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        skipImages,
        productsWritten: mapped.length,
        liveIdsWritten: liveIds.length,
        withImages: mapped.filter((p) => p.imageUrl).length,
        imageFailures,
        sample: mapped.slice(0, 3).map((p) => ({ id: p.id, sku: p.sku, name: p.name, price: p.price })),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
