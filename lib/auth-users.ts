import type { AuthUserRow } from "./auth-users-config";
import { normalizeAuthEmail, parseAuthUsersEnv } from "./auth-users-config";
import { verifyPassword } from "./auth-password";

/**
 * Sync env-only credential check. Prefer authenticateCredentialsAsync for
 * stored users and password-hash verification.
 */
export async function authenticateCredentials(email: string, password: string): Promise<AuthUserRow | null> {
  const users = parseAuthUsersEnv();
  const want = normalizeAuthEmail(email);
  for (const u of users) {
    if (u.email !== want) {
      continue;
    }
    if (await verifyPassword(password, u.password)) {
      return { email: u.email, role: u.role, password: "" };
    }
    return null;
  }
  return null;
}

export type { AuthUserRow } from "./auth-users-config";
export { authUsersConfigured, parseAuthUsersEnv } from "./auth-users-config";
