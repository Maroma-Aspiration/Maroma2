import { promises as fs } from "fs";
import path from "path";
import { timingSafeEqual } from "crypto";
import { kv } from "@vercel/kv";
import type { AuthUserRow } from "./auth-users-config";
import { normalizeAuthEmail, parseAuthUsersEnv } from "./auth-users-config";
import type { UserRole } from "./auth-types";

const storageDir = path.join(process.cwd(), "data");
const storagePath = path.join(storageDir, "auth-users.json");
const authUsersKvKey = "maroma:auth-users";
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

function timingSafeStringEq(a: string, b: string, maxLen = 512): boolean {
  const pa = a.slice(0, maxLen);
  const pb = b.slice(0, maxLen);
  const bufA = Buffer.alloc(maxLen, 0);
  const bufB = Buffer.alloc(maxLen, 0);
  Buffer.from(pa, "utf8").copy(bufA);
  Buffer.from(pb, "utf8").copy(bufB);
  return timingSafeEqual(bufA, bufB);
}

function parseRows(value: unknown): AuthUserRow[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: AuthUserRow[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const raw = row as Record<string, unknown>;
    const email = typeof raw.email === "string" ? normalizeAuthEmail(raw.email) : "";
    const password = typeof raw.password === "string" ? raw.password : "";
    const role = raw.role;
    if (!email || !password || (role !== "admin" && role !== "user")) continue;
    out.push({ email, password, role });
  }
  return out;
}

export async function readStoredAuthUsers(): Promise<AuthUserRow[]> {
  if (hasKvConfig) {
    try {
      const stored = await kv.get(authUsersKvKey);
      if (stored) return parseRows(stored);
    } catch {
      // fallback
    }
  }
  try {
    const raw = await fs.readFile(storagePath, "utf8");
    return parseRows(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function writeStoredAuthUsers(users: AuthUserRow[]): Promise<void> {
  const next = parseRows(users);
  if (hasKvConfig) {
    try {
      await kv.set(authUsersKvKey, next);
      return;
    } catch {
      // fallback
    }
  }
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(next, null, 2), "utf8");
}

export async function readAllAuthUsers(): Promise<AuthUserRow[]> {
  const envUsers = parseAuthUsersEnv();
  const storedUsers = await readStoredAuthUsers();
  const byEmail = new Map<string, AuthUserRow>();
  for (const row of envUsers) byEmail.set(row.email, row);
  for (const row of storedUsers) byEmail.set(row.email, row);
  return Array.from(byEmail.values());
}

export async function authenticateCredentialsAsync(email: string, password: string): Promise<AuthUserRow | null> {
  const users = await readAllAuthUsers();
  const want = normalizeAuthEmail(email);
  for (const u of users) {
    if (u.email !== want) continue;
    if (timingSafeStringEq(password, u.password)) return u;
    return null;
  }
  return null;
}

export async function createAuthUser(email: string, password: string, role: UserRole = "admin"): Promise<AuthUserRow> {
  const normalized = normalizeAuthEmail(email);
  const users = await readAllAuthUsers();
  const existing = users.find((u) => u.email === normalized);
  if (existing) {
    throw new Error("exists");
  }
  const stored = await readStoredAuthUsers();
  const next: AuthUserRow = { email: normalized, password, role };
  await writeStoredAuthUsers([...stored, next]);
  return next;
}

export type AuthUserPublicRow = {
  email: string;
  role: UserRole;
  source: "env" | "stored";
};

export type AuthUserAdminRow = AuthUserPublicRow & {
  password: string;
  passwordSource: "env" | "stored";
};

export async function listAuthUsersAdmin(): Promise<AuthUserAdminRow[]> {
  const envUsers = parseAuthUsersEnv();
  const storedUsers = await readStoredAuthUsers();
  const storedByEmail = new Map(storedUsers.map((u) => [u.email, u]));
  const envByEmail = new Map(envUsers.map((u) => [u.email, u]));
  const emails = new Set([...envByEmail.keys(), ...storedByEmail.keys()]);
  const rows: AuthUserAdminRow[] = [];
  for (const email of emails) {
    const stored = storedByEmail.get(email);
    const env = envByEmail.get(email);
    const active = stored ?? env;
    if (!active) continue;
    rows.push({
      email,
      role: active.role,
      source: stored ? "stored" : "env",
      password: active.password,
      passwordSource: stored ? "stored" : "env",
    });
  }
  return rows.sort((a, b) => a.email.localeCompare(b.email));
}

export async function listAuthUsersPublic(): Promise<AuthUserPublicRow[]> {
  const rows = await listAuthUsersAdmin();
  return rows.map(({ email, role, source }) => ({ email, role, source }));
}

export async function changeAuthUserPassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) throw new Error("invalid_email");
  if (!newPassword.trim()) throw new Error("invalid_password");
  const match = await authenticateCredentialsAsync(normalized, currentPassword);
  if (!match) throw new Error("invalid_current");
  await resetAuthUserPassword(normalized, newPassword);
}

export async function resetAuthUserPassword(email: string, newPassword: string): Promise<void> {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) throw new Error("invalid_email");
  const allUsers = await readAllAuthUsers();
  const existing = allUsers.find((u) => u.email === normalized);
  if (!existing) throw new Error("not_found");
  const storedUsers = await readStoredAuthUsers();
  const others = storedUsers.filter((u) => u.email !== normalized);
  await writeStoredAuthUsers([...others, { email: normalized, password: newPassword, role: existing.role }]);
}

export async function setAuthUserRole(email: string, role: UserRole): Promise<AuthUserPublicRow> {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) {
    throw new Error("invalid_email");
  }
  const allUsers = await readAllAuthUsers();
  const existing = allUsers.find((u) => u.email === normalized);
  if (!existing) {
    throw new Error("not_found");
  }
  const storedUsers = await readStoredAuthUsers();
  const others = storedUsers.filter((u) => u.email !== normalized);
  const nextStored: AuthUserRow = { email: normalized, password: existing.password, role };
  await writeStoredAuthUsers([...others, nextStored]);
  return { email: normalized, role, source: "stored" };
}

