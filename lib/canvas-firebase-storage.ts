import { randomUUID } from "crypto";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

export type CanvasFirebaseConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  storageBucket: string;
};

let app: App | null = null;

function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
}

export function getCanvasFirebaseConfig(): CanvasFirebaseConfig | null {
  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      const projectId = parsed.project_id?.trim();
      const clientEmail = parsed.client_email?.trim();
      const privateKey = parsed.private_key ? normalizePrivateKey(parsed.private_key) : "";
      const storageBucket =
        process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
        (projectId ? `${projectId}.appspot.com` : "");
      if (projectId && clientEmail && privateKey && storageBucket) {
        return { projectId, clientEmail, privateKey, storageBucket };
      }
    } catch {
      /* fall through */
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    (projectId ? `${projectId}.appspot.com` : "");
  if (!projectId || !clientEmail || !privateKey || !storageBucket) return null;
  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
    storageBucket,
  };
}

export function isCanvasFirebaseConfigured(): boolean {
  return getCanvasFirebaseConfig() !== null;
}

function getFirebaseApp(config: CanvasFirebaseConfig): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }
  app = initializeApp({
    credential: cert({
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      privateKey: normalizePrivateKey(config.privateKey),
    }),
    storageBucket: config.storageBucket,
  });
  return app;
}

function getBucket(config = getCanvasFirebaseConfig()) {
  if (!config) throw new Error("Firebase Storage is not configured.");
  return getStorage(getFirebaseApp(config)).bucket(config.storageBucket);
}

export function publicUrlForCanvasPath(path: string, config = getCanvasFirebaseConfig()): string {
  if (!config) throw new Error("Firebase Storage is not configured.");
  const normalized = path.replace(/^\/+/, "");
  const encoded = encodeURIComponent(normalized);
  return `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${encoded}?alt=media`;
}

export function isCanvasFirebaseUrl(url: string | undefined | null, config = getCanvasFirebaseConfig()): boolean {
  const trimmed = (url ?? "").trim();
  if (!trimmed || !config) return false;
  return trimmed.includes(`firebasestorage.googleapis.com/v0/b/${config.storageBucket}/`);
}

export function canvasPathFromFirebaseUrl(url: string, config = getCanvasFirebaseConfig()): string | null {
  if (!isCanvasFirebaseUrl(url, config) || !config) return null;
  try {
    const parsed = new URL(url);
    const prefix = `/v0/b/${config.storageBucket}/o/`;
    const idx = parsed.pathname.indexOf(prefix);
    if (idx < 0) return null;
    const encoded = parsed.pathname.slice(idx + prefix.length);
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

function extForMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("svg")) return "svg";
  return "jpg";
}

export function makeCanvasObjectPath(prefix: string, ext: string): string {
  const safePrefix = prefix.replace(/\/+$/, "");
  return `${safePrefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
}

export async function uploadCanvasBuffer(
  path: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const config = getCanvasFirebaseConfig();
  if (!config) throw new Error("Firebase Storage is not configured.");

  const normalized = path.replace(/^\/+/, "");
  const file = getBucket(config).file(normalized);
  const downloadToken = randomUUID();
  await file.save(body, {
    metadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
    resumable: false,
  });
  // Uniform bucket-level access rejects object ACLs; token URL still works.
  try {
    await file.makePublic();
  } catch {
    /* ignore */
  }
  return `${publicUrlForCanvasPath(normalized, config)}&token=${downloadToken}`;
}

export async function uploadCanvasFile(file: File, prefix = "canvas"): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || extForMime(file.type || "image/jpeg");
  const path = makeCanvasObjectPath(prefix, ext);
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "image/jpeg";
  return uploadCanvasBuffer(path, buffer, contentType);
}

export async function probeCanvasFirebaseReadable(): Promise<boolean> {
  const config = getCanvasFirebaseConfig();
  if (!config) return false;
  try {
    const [exists] = await getBucket(config).exists();
    return exists;
  } catch {
    return false;
  }
}
