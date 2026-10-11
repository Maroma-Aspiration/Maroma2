/**
 * Upload unique How To USE catalogue matches through the production
 * Video ID path: sign URL, PUT to Firebase, complete, attach-video.
 *
 * Usage: node scripts/publish-how-to-use-missing-videos.mjs
 */
import { createHash, createHmac } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const videoDir = path.join(root, "public", "staging-media", "product-videos");
const jobsPath = path.join(root, "outputs", "how-to-use-missing-jobs.json");
const overridePath = path.join(root, "data", "product-overrides.json");
const SITE = "https://www.maromashopping.com";
const uploadConcurrency = 2;

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
      if (!value || value === "[SENSITIVE]" || value === "SENSITIVE") continue;
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

function bytesToB64Url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signSessionPayload(payload, secret) {
  const body = bytesToB64Url(Buffer.from(JSON.stringify(payload), "utf8"));
  const key = createHash("sha256").update(secret, "utf8").digest();
  const sig = createHmac("sha256", key).update(body, "utf8").digest();
  return `${body}.${bytesToB64Url(sig)}`;
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

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} ${response.status}: ${data.error || "request failed"}`);
  }
  return data;
}

async function publishOne(job, cookie) {
  const localPath = path.join(videoDir, job.file);
  const buffer = await fs.readFile(localPath);
  const objectPath = `admin-product-videos/${job.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
  const headers = { "Content-Type": "application/json", Cookie: cookie };

  const sign = await jsonFetch(`${SITE}/api/public-media/sign`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path: objectPath, contentType: "video/mp4" }),
  });
  if (!sign.uploadUrl || !sign.path || !sign.downloadToken) {
    throw new Error(`Could not sign upload for ${job.id}`);
  }

  const putRes = await fetch(sign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": sign.contentType || "video/mp4" },
    body: buffer,
  });
  if (!putRes.ok) throw new Error(`Firebase PUT failed for ${job.id}: ${putRes.status}`);

  const done = await jsonFetch(`${SITE}/api/public-media/complete`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      path: sign.path,
      contentType: sign.contentType || "video/mp4",
      downloadToken: sign.downloadToken,
      label: job.file,
      skipGallery: true,
    }),
  });
  if (!done.url) throw new Error(`Complete failed for ${job.id}`);

  await jsonFetch(`${SITE}/api/products/upload`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "attach-video", productId: job.id, url: done.url }),
  });

  return { ...job, url: done.url };
}

async function main() {
  await loadEnvFile(path.join(root, ".env.republish.tmp"));
  await loadEnvFile(path.join(root, ".env.production.local"));
  const secret = process.env.MAROMA_SESSION_SECRET?.trim();
  if (!secret) throw new Error("MAROMA_SESSION_SECRET is not available.");

  const jobs = JSON.parse(await fs.readFile(jobsPath, "utf8"));
  if (!Array.isArray(jobs) || jobs.length === 0) throw new Error("No publish jobs.");

  for (const job of jobs) {
    await fs.access(path.join(videoDir, job.file));
  }

  const token = signSessionPayload(
    { email: "video-publish@maroma.local", role: "admin", exp: Date.now() + 1000 * 60 * 60 * 6 },
    secret
  );
  const cookie = `maroma_session=${token}`;

  const uploaded = await mapPool(jobs, uploadConcurrency, async (job, index) => {
    console.log(`[${index + 1}/${jobs.length}] publish ${job.id} ${job.name}`);
    return publishOne(job, cookie);
  });

  const now = new Date().toISOString();
  let disk = { overrides: {} };
  try {
    disk = JSON.parse(await fs.readFile(overridePath, "utf8"));
  } catch {
    disk = { overrides: {} };
  }
  disk.overrides = disk.overrides ?? {};
  for (const item of uploaded) {
    disk.overrides[item.id] = {
      ...disk.overrides[item.id],
      videos: [item.url],
      updatedAt: now,
    };
  }
  await fs.writeFile(overridePath, `${JSON.stringify(disk, null, 2)}\n`, "utf8");

  const report = uploaded.map(({ id, name, file, url }) => ({ id, name, file, url }));
  await fs.writeFile(
    path.join(root, "outputs", "how-to-use-missing-result.json"),
    `${JSON.stringify({ uploadedAt: now, count: report.length, videos: report }, null, 2)}\n`,
    "utf8"
  );
  console.log(`uploaded ${uploaded.length} videos and attached them on production`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
