import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const HASH_PREFIX = "scrypt$";
const KEY_LEN = 64;

/** Pad strings so timingSafeEqual can run without leaking length differences (within maxLen). */
export function timingSafeStringEq(a: string, b: string, maxLen = 512): boolean {
  const pa = a.slice(0, maxLen);
  const pb = b.slice(0, maxLen);
  const bufA = Buffer.alloc(maxLen, 0);
  const bufB = Buffer.alloc(maxLen, 0);
  Buffer.from(pa, "utf8").copy(bufA);
  Buffer.from(pb, "utf8").copy(bufB);
  return timingSafeEqual(bufA, bufB);
}

export function isPasswordHash(value: string): boolean {
  return value.startsWith(HASH_PREFIX);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return `${HASH_PREFIX}${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;

  if (isPasswordHash(stored)) {
    const parts = stored.split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") return false;
    const salt = parts[1];
    const expectedHex = parts[2];
    if (!salt || !expectedHex) return false;
    try {
      const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
      const expected = Buffer.from(expectedHex, "hex");
      if (expected.length !== derived.length) return false;
      return timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }

  // Legacy plaintext (env users / pre-migration stored rows).
  return timingSafeStringEq(password, stored);
}
