import { timingSafeEqual } from "crypto";
import type { AuthUserRow } from "./auth-users-config";
import { normalizeAuthEmail, parseAuthUsersEnv } from "./auth-users-config";

/** Pad strings so timingSafeEqual can run without leaking length differences (within maxLen). */
function timingSafeStringEq(a: string, b: string, maxLen = 512): boolean {
  const pa = a.slice(0, maxLen);
  const pb = b.slice(0, maxLen);
  const bufA = Buffer.alloc(maxLen, 0);
  const bufB = Buffer.alloc(maxLen, 0);
  Buffer.from(pa, "utf8").copy(bufA);
  Buffer.from(pb, "utf8").copy(bufB);
  return timingSafeEqual(bufA, bufB);
}

export function authenticateCredentials(email: string, password: string): AuthUserRow | null {
  const users = parseAuthUsersEnv();
  const want = normalizeAuthEmail(email);
  for (const u of users) {
    if (u.email !== want) {
      continue;
    }
    if (timingSafeStringEq(password, u.password)) {
      return u;
    }
    return null;
  }
  return null;
}

export type { AuthUserRow } from "./auth-users-config";
export { authUsersConfigured, parseAuthUsersEnv } from "./auth-users-config";
