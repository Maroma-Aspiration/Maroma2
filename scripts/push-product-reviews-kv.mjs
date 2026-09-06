/**
 * Push data/product-reviews.json to Vercel KV (production store).
 * Usage: node scripts/push-product-reviews-kv.mjs
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@vercel/kv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reviewsPath = path.join(__dirname, "..", "data", "product-reviews.json");
const KV_KEY = "maroma:product-reviews";

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

async function main() {
  await loadEnvFile(path.join(__dirname, "..", ".env.production.local"));
  await loadEnvFile(path.join(__dirname, "..", ".env.local"));

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN are required.");
  }

  const raw = await fs.readFile(reviewsPath, "utf8");
  const store = JSON.parse(raw);
  const count = Array.isArray(store.reviews) ? store.reviews.length : 0;

  const kv = createClient({ url, token });
  await kv.set(KV_KEY, store);

  console.log(`Uploaded ${count} reviews to KV key ${KV_KEY}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
