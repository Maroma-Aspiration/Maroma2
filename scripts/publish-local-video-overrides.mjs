import { createHash, createHmac } from "crypto";
import { promises as fs } from "fs";
import { spawn } from "child_process";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = "https://www.maromashopping.com";
const videoRoot = path.join(root, "public");
const overridesPath = path.join(root, "data", "product-overrides.json");
const workDir = path.join(os.tmpdir(), "maroma-product-video-mp4");

async function loadEnv(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    for (const line of text.split("\n")) {
      const value = line.trim();
      if (!value || value.startsWith("#")) continue;
      const split = value.indexOf("=");
      if (split < 1) continue;
      let v = value.slice(split + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (v && v !== "[SENSITIVE]" && v !== "SENSITIVE" && !process.env[value.slice(0, split).trim()]) process.env[value.slice(0, split).trim()] = v;
    }
  } catch {}
}

function encode(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function sessionCookie(secret) {
  const body = encode({ email: "video-republish@maroma.local", role: "admin", exp: Date.now() + 6 * 60 * 60 * 1000 });
  const key = createHash("sha256").update(secret).digest();
  const signature = createHmac("sha256", key).update(body).digest("base64url");
  return `maroma_session=${body}.${signature}`;
}

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${options.method || "GET"} ${response.status}: ${data.error || "request failed"}`);
  return data;
}

function transcode(input, output) {
  return new Promise((resolve, reject) => {
    const child = spawn("/opt/homebrew/bin/ffmpeg", ["-y", "-i", input, "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", output], { stdio: ["ignore", "ignore", "pipe"] });
    let error = "";
    child.stderr.on("data", (chunk) => { error += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(error.slice(-700) || `ffmpeg exited ${code}`)));
  });
}

async function main() {
  await loadEnv(path.join(root, ".env.republish.tmp"));
  await loadEnv(path.join(root, ".env.production.local"));
  const secret = process.env.MAROMA_SESSION_SECRET?.trim();
  if (!secret) throw new Error("MAROMA_SESSION_SECRET is not available.");
  const disk = JSON.parse(await fs.readFile(overridesPath, "utf8"));
  const jobs = [];
  for (const [id, override] of Object.entries(disk.overrides || {})) {
    for (const localUrl of override.videos || []) {
      if (!localUrl.startsWith("/staging-media/product-videos/")) continue;
      const source = path.join(videoRoot, localUrl.replace(/^\//, ""));
      try { await fs.access(source); } catch { console.log(`skip missing ${localUrl}`); continue; }
      jobs.push({ id, localUrl, source });
    }
  }
  await fs.mkdir(workDir, { recursive: true });
  const cookie = sessionCookie(secret);
  const uploaded = [];
  for (let i = 0; i < jobs.length; i += 1) {
    const job = jobs[i];
    const ext = path.extname(job.source).toLowerCase();
    const base = path.basename(job.source, ext).replace(/[^a-z0-9._-]+/gi, "-");
    const uploadFile = ext === ".mp4" ? job.source : path.join(workDir, `${base}.mp4`);
    if (uploadFile !== job.source) {
      try { await fs.access(uploadFile); } catch { await transcode(job.source, uploadFile); }
    }
    const buffer = await fs.readFile(uploadFile);
    const objectPath = `admin-product-videos/${job.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
    const headers = { "Content-Type": "application/json", Cookie: cookie };
    const sign = await jsonFetch(`${site}/api/public-media/sign`, { method: "POST", headers, body: JSON.stringify({ path: objectPath, contentType: "video/mp4" }) });
    const put = await fetch(sign.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: buffer });
    if (!put.ok) throw new Error(`Firebase PUT failed for ${job.localUrl}: ${put.status}`);
    const done = await jsonFetch(`${site}/api/public-media/complete`, { method: "POST", headers, body: JSON.stringify({ path: sign.path, contentType: "video/mp4", downloadToken: sign.downloadToken, label: path.basename(job.source), skipGallery: true }) });
    await jsonFetch(`${site}/api/products/upload`, { method: "POST", headers, body: JSON.stringify({ action: "attach-video", productId: job.id, url: done.url }) });
    uploaded.push({ id: job.id, localUrl: job.localUrl, url: done.url });
    console.log(`[${i + 1}/${jobs.length}] uploaded ${job.localUrl}`);
  }
  const now = new Date().toISOString();
  for (const item of uploaded) disk.overrides[item.id] = { ...disk.overrides[item.id], videos: [item.url], updatedAt: now };
  await fs.writeFile(overridesPath, `${JSON.stringify(disk, null, 2)}\n`);
  console.log(`uploaded and attached ${uploaded.length} local video overrides`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
