/**
 * Transcode product how-to MOV files to H.264/AAC MP4 and publish every
 * how-to video to Firebase Storage. Updates data/product-video-blob-map.json
 * so production no longer depends on the suspended Vercel Blob store.
 *
 * Usage: node scripts/publish-product-videos-to-firebase.mjs
 */
import { spawn } from "child_process";
import { createReadStream, promises as fs } from "fs";
import os from "os";
import path from "path";
import { pipeline } from "stream/promises";
import { fileURLToPath } from "url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const videoDir = path.join(root, "public", "staging-media", "product-videos");
const mapPath = path.join(root, "data", "product-video-blob-map.json");
const publicPrefix = "/staging-media/product-videos/";
const remotePrefix = "how-to-use/";
const transcodeDir = path.join(os.tmpdir(), "maroma-how-to-mp4");
const ffmpegBin = "/opt/homebrew/bin/ffmpeg";
const uploadConcurrency = 3;
const transcodeConcurrency = 2;

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
      if (value === "[SENSITIVE]" || value === "SENSITIVE") continue;
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

function normalizePrivateKey(raw) {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
}

function firebaseConfig() {
  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw && jsonRaw.startsWith("{")) {
    try {
      const parsed = JSON.parse(jsonRaw);
      const projectId = parsed.project_id?.trim();
      const clientEmail = parsed.client_email?.trim();
      const privateKey = parsed.private_key ? normalizePrivateKey(parsed.private_key) : "";
      const storageBucket =
        process.env.FIREBASE_STORAGE_BUCKET?.trim() || (projectId ? `${projectId}.appspot.com` : "");
      if (projectId && clientEmail && privateKey && storageBucket) {
        return { projectId, clientEmail, privateKey, storageBucket };
      }
    } catch {
      /* use discrete env vars */
    }
  }
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)
    : "";
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET?.trim() || (projectId ? `${projectId}.appspot.com` : "");
  if (!projectId || !clientEmail || !privateKey || !storageBucket) {
    throw new Error("Firebase Storage is not configured.");
  }
  return { projectId, clientEmail, privateKey, storageBucket };
}

function getBucket() {
  const config = firebaseConfig();
  const existing = getApps()[0];
  const app =
    existing ||
    initializeApp({
      credential: cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey,
      }),
      storageBucket: config.storageBucket,
    });
  return { bucket: getStorage(app).bucket(config.storageBucket), config };
}

function remoteName(fileName, forceMp4) {
  const spaced = fileName.replace(/\s+/g, "-");
  return forceMp4 ? spaced.replace(/\.mov$/i, ".mp4") : spaced;
}

function publicUrl(storageBucket, objectPath, token) {
  const encoded = encodeURIComponent(objectPath);
  return `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encoded}?alt=media&token=${token}`;
}

function runFfmpeg(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegBin,
      [
        "-y",
        "-i",
        inputPath,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        outputPath,
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-800) || `ffmpeg exited ${code}`));
    });
  });
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

async function uploadFile(bucket, localPath, objectPath, contentType, token) {
  const file = bucket.file(objectPath);
  await pipeline(
    createReadStream(localPath),
    file.createWriteStream({
      resumable: true,
      contentType,
      metadata: {
        contentType,
        cacheControl: "public, max-age=31536000, immutable",
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    })
  );
  try {
    await file.makePublic();
  } catch {
    /* uniform bucket access */
  }
}

async function main() {
  await loadEnvFile(path.join(root, ".env.production.local"));
  await loadEnvFile(path.join(root, ".env.local"));
  await loadEnvFile(path.join(root, ".env.vercel.production.tmp"));
  const { bucket, config } = getBucket();
  await fs.mkdir(transcodeDir, { recursive: true });

  const names = (await fs.readdir(videoDir))
    .filter((name) => /\.(mp4|mov|webm|m4v)$/i.test(name))
    .sort();

  let map = {};
  try {
    map = JSON.parse(await fs.readFile(mapPath, "utf8"));
  } catch {
    map = {};
  }

  const prepared = await mapPool(names, transcodeConcurrency, async (name, index) => {
    const localUrl = `${publicPrefix}${name}`;
    const sourcePath = path.join(videoDir, name);
    const isMov = /\.mov$/i.test(name);
    let uploadPath = sourcePath;
    if (isMov) {
      const outName = remoteName(name, true);
      uploadPath = path.join(transcodeDir, outName);
      try {
        const stat = await fs.stat(uploadPath);
        if (stat.size > 1024) {
          console.log(`[${index + 1}/${names.length}] reuse ${name}`);
          return { localUrl, uploadPath, objectPath: `${remotePrefix}${outName}`, contentType: "video/mp4" };
        }
      } catch {
        /* transcode */
      }
      console.log(`[${index + 1}/${names.length}] transcode ${name}`);
      await runFfmpeg(sourcePath, uploadPath);
      return { localUrl, uploadPath, objectPath: `${remotePrefix}${outName}`, contentType: "video/mp4" };
    }
    const objectPath = `${remotePrefix}${remoteName(name, false)}`;
    const contentType = name.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4";
    console.log(`[${index + 1}/${names.length}] queue ${name}`);
    return { localUrl, uploadPath, objectPath, contentType };
  });

  await mapPool(prepared, uploadConcurrency, async (item, index) => {
    const token = randomUUID();
    console.log(`[${index + 1}/${prepared.length}] upload ${item.objectPath}`);
    await uploadFile(bucket, item.uploadPath, item.objectPath, item.contentType, token);
    map[item.localUrl] = publicUrl(config.storageBucket, item.objectPath, token);
    if ((index + 1) % 5 === 0) {
      await fs.writeFile(mapPath, `${JSON.stringify(map, null, 2)}\n`, "utf8");
    }
  });

  const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
  await fs.writeFile(mapPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  const missing = names.filter((name) => !sorted[`${publicPrefix}${name}`] || /blob\.vercel-storage\.com/.test(sorted[`${publicPrefix}${name}`]));
  console.log(`wrote ${Object.keys(sorted).length} firebase urls`);
  if (missing.length) {
    throw new Error(`missing or still on blob: ${missing.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
