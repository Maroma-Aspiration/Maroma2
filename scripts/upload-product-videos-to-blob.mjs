/**
 * Upload public/staging-media/product-videos to Vercel Blob and write
 * data/product-video-blob-map.json so production can serve them without
 * shipping the 690MB folder in each deploy.
 *
 * Usage: node scripts/upload-product-videos-to-blob.mjs
 */
import { createReadStream } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { list, put } from "@vercel/blob";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const videoDir = path.join(root, "public", "staging-media", "product-videos");
const mapPath = path.join(root, "data", "product-video-blob-map.json");
const publicPrefix = "/staging-media/product-videos/";
const blobPrefix = "how-to-use/";
const concurrency = 3;

async function loadEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional env file
  }
}

function contentTypeFor(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  return "video/mp4";
}

function blobPathname(fileName) {
  return `${blobPrefix}${fileName.replace(/\s+/g, "-")}`;
}

async function listExisting() {
  const byPath = new Map();
  let cursor;
  do {
    const page = await list({ prefix: blobPrefix, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      byPath.set(blob.pathname, blob.url);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return byPath;
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function main() {
  await loadEnvFile(path.join(root, ".env.production.local"));
  await loadEnvFile(path.join(root, ".env.local"));

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set.");
  }

  const names = (await fs.readdir(videoDir))
    .filter((name) => /\.(mp4|mov|webm|m4v)$/i.test(name))
    .sort();

  let map = {};
  try {
    map = JSON.parse(await fs.readFile(mapPath, "utf8"));
  } catch {
    map = {};
  }

  const existing = await listExisting();
  console.log(`local videos ${names.length}; existing blob objects ${existing.size}`);

  await mapPool(names, concurrency, async (name, index) => {
    const localUrl = `${publicPrefix}${name}`;
    const pathname = blobPathname(name);
    if (map[localUrl] && existing.get(pathname) === map[localUrl]) {
      console.log(`[${index + 1}/${names.length}] skip ${name}`);
      return;
    }
    const already = existing.get(pathname);
    if (already) {
      map[localUrl] = already;
      console.log(`[${index + 1}/${names.length}] mapped ${name}`);
      return;
    }
    console.log(`[${index + 1}/${names.length}] upload ${name}`);
    const uploaded = await put(pathname, createReadStream(path.join(videoDir, name)), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      multipart: true,
      contentType: contentTypeFor(name),
      cacheControlMaxAge: 31536000,
    });
    map[localUrl] = uploaded.url;
    existing.set(pathname, uploaded.url);
    await fs.writeFile(mapPath, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  });

  const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
  await fs.writeFile(mapPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  const missing = names.filter((name) => !sorted[`${publicPrefix}${name}`]);
  console.log(`wrote ${Object.keys(sorted).length} blob urls`);
  if (missing.length) {
    throw new Error(`missing uploads: ${missing.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
