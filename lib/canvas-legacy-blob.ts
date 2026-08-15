const CANVAS_BLOB_HOST = /\.public\.blob\.vercel-storage\.com/i;

export function isCanvasBlobUrl(url: string | undefined | null): boolean {
  const trimmed = (url ?? "").trim();
  return Boolean(trimmed && CANVAS_BLOB_HOST.test(trimmed));
}

export function isBlobStoreUnavailableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    /store has been suspended/i.test(msg) ||
    /store is blocked/i.test(msg) ||
    /usage threshold limit is reached/i.test(msg) ||
    /403 forbidden/i.test(msg) ||
    /Firebase Storage is not configured/i.test(msg)
  );
}

export async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function extForMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("svg")) return "svg";
  return "jpg";
}

function makeLegacyBlobPath(prefix: string, ext: string): string {
  const safePrefix = prefix.replace(/^\/+|\/+$/g, "");
  return `${safePrefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
}

export function isCanvasBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

async function readBlobStream(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.byteLength) chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

/** Download bytes from a legacy Vercel Blob URL when the store is readable. */
export async function downloadLegacyBlobUrl(
  url: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!isCanvasBlobUrl(url)) return null;

  try {
    const { get } = await import("@vercel/blob");
    const result = await get(url, { access: "public" });
    if (!result?.stream) return null;
    const buffer = await readBlobStream(result.stream);
    return {
      buffer,
      contentType: result.blob.contentType || "image/jpeg",
    };
  } catch {
    /* fall through to fetch */
  }

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return { buffer, contentType };
  } catch {
    return null;
  }
}

/** Upload raw bytes to the legacy Vercel Blob store when still configured. */
export async function uploadLegacyBlobBuffer(
  body: Buffer | Uint8Array,
  contentType: string,
  prefix = "canvas"
): Promise<string> {
  if (!isCanvasBlobConfigured()) {
    throw new Error("Legacy Vercel Blob is not configured.");
  }

  const { put } = await import("@vercel/blob");
  const mime = contentType || "image/jpeg";
  const path = makeLegacyBlobPath(prefix, extForMime(mime));
  const result = await put(path, body, {
    access: "public",
    addRandomSuffix: false,
    cacheControlMaxAge: 31536000,
    contentType: mime,
  });
  return result.url;
}

/** Upload a canvas image to the legacy Vercel Blob store when still configured. */
export async function uploadLegacyBlobFile(file: File, prefix = "canvas"): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadLegacyBlobBuffer(buffer, file.type || "image/jpeg", prefix);
}

export async function probeCanvasBlobReadable(url: string): Promise<boolean> {
  if (!isCanvasBlobUrl(url)) return true;
  const downloaded = await downloadLegacyBlobUrl(url);
  return Boolean(downloaded?.buffer.byteLength);
}
