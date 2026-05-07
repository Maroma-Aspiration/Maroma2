import type { UserRole } from "./auth-types";

export type SessionPayload = {
  email: string;
  role: UserRole;
  exp: number;
};

export const SESSION_COOKIE = "maroma_session";

/** Two-week sliding sessions (issued at login). */
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14;

function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", utf8Encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function bytesToB64Url(buf: Uint8Array): string {
  let binary = "";
  buf.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlToBytes(s: string): Uint8Array | null {
  try {
    const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
    const base64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const bin = atob(base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

export function getSessionSecret(): string | null {
  const s = process.env.MAROMA_SESSION_SECRET?.trim();
  return s || null;
}

export async function signSessionPayload(payload: SessionPayload, secret: string): Promise<string> {
  const body = bytesToB64Url(utf8Encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sigBuf = await crypto.subtle.sign("HMAC", key, utf8Encode(body));
  const sig = bytesToB64Url(new Uint8Array(sigBuf));
  return `${body}.${sig}`;
}

export async function verifySessionPayload(token: string, secret: string): Promise<SessionPayload | null> {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const body = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);
  const sigBytes = b64UrlToBytes(sigPart);
  if (!sigBytes) {
    return null;
  }
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify("HMAC", key, sigBytes, utf8Encode(body));
  if (!ok) {
    return null;
  }
  const payloadBytes = b64UrlToBytes(body);
  if (!payloadBytes) {
    return null;
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload;
    if (typeof parsed.email !== "string" || typeof parsed.exp !== "number") {
      return null;
    }
    if (parsed.role !== "admin" && parsed.role !== "user") {
      return null;
    }
    if (parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
