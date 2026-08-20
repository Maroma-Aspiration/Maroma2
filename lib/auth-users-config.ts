import type { UserRole } from "./auth-types";
import { isUserRole } from "./auth-roles";

export type AuthUserRow = {
  email: string;
  password: string;
  role: UserRole;
};

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseAuthUsersEnv(): AuthUserRow[] {
  const raw = process.env.MAROMA_AUTH_USERS?.trim();
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const out: AuthUserRow[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") {
        continue;
      }
      const r = row as Record<string, unknown>;
      const email = typeof r.email === "string" ? normalizeAuthEmail(r.email) : "";
      const password = typeof r.password === "string" ? r.password : "";
      const role = r.role;
      if (!email || !password || !isUserRole(role)) {
        continue;
      }
      out.push({ email, password, role });
    }
    return out;
  } catch {
    return [];
  }
}

export function authUsersConfigured(): boolean {
  return parseAuthUsersEnv().length > 0;
}
