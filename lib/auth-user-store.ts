import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import type { AuthUserRow } from "./auth-users-config";
import { normalizeAuthEmail, parseAuthUsersEnv } from "./auth-users-config";
import { hashPassword, isPasswordHash, verifyPassword } from "./auth-password";
import type { UserRole } from "./auth-types";
import { isUserRole } from "./auth-roles";

const storageDir = path.join(process.cwd(), "data");
const storagePath = path.join(storageDir, "auth-users.json");
const authUsersKvKey = "maroma:auth-users";
const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

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
    if (!email || !password || !isUserRole(role)) continue;
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
    await kv.set(authUsersKvKey, next);
    // Verify the write landed — a silent filesystem fallback on Vercel loses passwords on the next cold start.
    const verify = await kv.get(authUsersKvKey);
    const verified = parseRows(verify);
    if (verified.length !== next.length) {
      throw new Error("kv_write_verify_failed");
    }
    return;
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

async function persistHashedPassword(email: string, role: UserRole, plaintext: string): Promise<void> {
  const hashed = await hashPassword(plaintext);
  const storedUsers = await readStoredAuthUsers();
  const others = storedUsers.filter((u) => u.email !== email);
  await writeStoredAuthUsers([...others, { email, password: hashed, role }]);
}

export async function authenticateCredentialsAsync(email: string, password: string): Promise<AuthUserRow | null> {
  const users = await readAllAuthUsers();
  const want = normalizeAuthEmail(email);
  for (const u of users) {
    if (u.email !== want) continue;
    const ok = await verifyPassword(password, u.password);
    if (!ok) return null;

    // Upgrade legacy plaintext (or env plaintext) to a stored hash on successful login.
    if (!isPasswordHash(u.password)) {
      try {
        await persistHashedPassword(u.email, u.role, password);
      } catch {
        // Login still succeeds even if upgrade write fails.
      }
    }

    return { email: u.email, role: u.role, password: "" };
  }
  return null;
}

export async function createAuthUser(email: string, password: string, role: UserRole = "user"): Promise<AuthUserRow> {
  const normalized = normalizeAuthEmail(email);
  const users = await readAllAuthUsers();
  const existing = users.find((u) => u.email === normalized);
  if (existing) {
    throw new Error("exists");
  }
  const stored = await readStoredAuthUsers();
  const hashed = await hashPassword(password);
  const next: AuthUserRow = { email: normalized, password: hashed, role };
  await writeStoredAuthUsers([...stored, next]);
  return { email: normalized, password: "", role };
}

export type AuthUserPublicRow = {
  email: string;
  role: UserRole;
  source: "env" | "stored";
};

export type AuthUserAdminRow = AuthUserPublicRow & {
  /** Where credentials are managed — never expose the secret itself. */
  credentialSource: "env" | "stored";
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
      credentialSource: stored ? "stored" : "env",
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
  if (newPassword.trim().length < 8) throw new Error("password_too_short");
  const allUsers = await readAllAuthUsers();
  const existing = allUsers.find((u) => u.email === normalized);
  if (!existing) throw new Error("not_found");
  await persistHashedPassword(normalized, existing.role, newPassword.trim());
  // Confirm the new password authenticates before returning success.
  const check = await authenticateCredentialsAsync(normalized, newPassword.trim());
  if (!check) throw new Error("password_verify_failed");
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
  // Keep existing hash/secret; only role changes. If user was env-only, copy credential into stored.
  const nextStored: AuthUserRow = { email: normalized, password: existing.password, role };
  await writeStoredAuthUsers([...others, nextStored]);
  return { email: normalized, role, source: "stored" };
}

export async function editStoredAuthUser(
  email: string,
  updates: { email?: string; role?: UserRole; password?: string }
): Promise<AuthUserPublicRow> {
  const currentEmail = normalizeAuthEmail(email);
  const nextEmail = normalizeAuthEmail(updates.email ?? email);
  if (!currentEmail || !nextEmail) throw new Error("invalid_email");

  const storedUsers = await readStoredAuthUsers();
  const existing = storedUsers.find((user) => user.email === currentEmail);
  if (!existing) throw new Error("not_stored");

  if (nextEmail !== currentEmail) {
    const allUsers = await readAllAuthUsers();
    if (allUsers.some((user) => user.email === nextEmail)) throw new Error("exists");
  }

  const nextPassword = updates.password?.trim()
    ? await hashPassword(updates.password.trim())
    : existing.password;

  const next: AuthUserRow = {
    email: nextEmail,
    role: updates.role ?? existing.role,
    password: nextPassword,
  };
  await writeStoredAuthUsers([...storedUsers.filter((user) => user.email !== currentEmail), next]);
  return { email: next.email, role: next.role, source: "stored" };
}

export async function deleteStoredAuthUser(email: string): Promise<void> {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) throw new Error("invalid_email");
  const storedUsers = await readStoredAuthUsers();
  if (!storedUsers.some((user) => user.email === normalized)) throw new Error("not_stored");
  await writeStoredAuthUsers(storedUsers.filter((user) => user.email !== normalized));
}
