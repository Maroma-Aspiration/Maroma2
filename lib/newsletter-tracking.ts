import { createHmac, timingSafeEqual } from "crypto";

export type TrackingPayload = {
  sid: string;
  cid: string;
  typ: "o" | "c" | "u";
  exp: number;
};

export function signTrackingPayload(payload: TrackingPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyTrackingToken(token: string, secret: string): TrackingPayload | null {
  const i = token.lastIndexOf(".");
  if (i <= 0) {
    return null;
  }
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  try {
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TrackingPayload;
    if (!parsed || typeof parsed.sid !== "string" || typeof parsed.cid !== "string") {
      return null;
    }
    if (parsed.typ !== "o" && parsed.typ !== "c" && parsed.typ !== "u") {
      return null;
    }
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function trackingTtlMs(days: number): number {
  return Date.now() + days * 86400000;
}
