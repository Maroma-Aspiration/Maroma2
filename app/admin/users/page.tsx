"use client";

import { useEffect, useState } from "react";
import { roleDisplayLabel } from "../../../lib/auth-roles";
import type { UserRole } from "../../../lib/auth-types";

type UserRow = {
  email: string;
  role: UserRole;
  source: "env" | "stored";
  credentialSource: "env" | "stored";
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState<string | null>(null);
  const [resetingEmail, setResetingEmail] = useState<string | null>(null);
  const [newPasswords, setNewPasswords] = useState<Record<string, string>>({});
  const [rowFeedback, setRowFeedback] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRow["role"]>("admin");
  const [creating, setCreating] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/auth/users", { cache: "no-store" });
      const data = (await response.json()) as { users?: UserRow[]; error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Could not load users.");
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setStatus("Could not load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    void fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { user?: { email?: string } }) => setCurrentEmail(data.user?.email?.toLowerCase() ?? ""));
  }, []);

  const editUser = async (row: UserRow) => {
    if (row.source !== "stored") {
      setFeedback(row.email, false, "Environment-managed users must be edited in Vercel settings");
      return;
    }
    const nextEmail = window.prompt("User email", row.email)?.trim().toLowerCase();
    if (!nextEmail) return;
    const password = window.prompt("New password (leave blank to keep the current password)", "");
    if (password === null) return;
    setEditingEmail(row.email);
    try {
      const response = await fetch("/api/auth/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: row.email, newEmail: nextEmail, role: row.role, password, action: "edit_user" }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not edit user.");
      await loadUsers();
      setStatus(`User ${nextEmail} updated.`);
    } catch (error) {
      setFeedback(row.email, false, error instanceof Error ? error.message : "Could not edit user");
    } finally {
      setEditingEmail(null);
    }
  };

  const deleteUser = async (row: UserRow) => {
    if (row.email.toLowerCase() === currentEmail) {
      setFeedback(
        row.email,
        false,
        "You are signed in as this user — sign in as another admin first, then delete"
      );
      return;
    }
    if (!window.confirm(`Delete ${row.email}? This account will immediately lose access.`)) return;
    setDeletingEmail(row.email);
    try {
      const response = await fetch("/api/auth/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: row.email }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete user.");
      setUsers((current) => current.filter((user) => user.email !== row.email));
      setStatus(`${row.email} deleted.`);
    } catch (error) {
      setFeedback(row.email, false, error instanceof Error ? error.message : "Could not delete user");
    } finally {
      setDeletingEmail(null);
    }
  };

  const setFeedback = (email: string, ok: boolean, msg: string) => {
    setRowFeedback((prev) => ({ ...prev, [email]: { ok, msg } }));
    setTimeout(() => setRowFeedback((prev) => { const n = { ...prev }; delete n[email]; return n; }), 4000);
  };

  const resetPassword = async (email: string) => {
    const pw = newPasswords[email]?.trim();
    if (!pw) {
      setFeedback(email, false, "Enter a new password first");
      return;
    }
    if (pw.length < 8) {
      setFeedback(email, false, "Password must be at least 8 characters");
      return;
    }
    setResetingEmail(email);
    try {
      const response = await fetch("/api/auth/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, action: "reset_password", password: pw })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        setFeedback(email, false, data.error ?? `HTTP ${response.status}`);
        return;
      }
      const isSelf = email.toLowerCase() === currentEmail;
      setFeedback(
        email,
        true,
        isSelf
          ? "Password updated — use it next time you sign in"
          : "Password updated"
      );
      setNewPasswords((prev) => ({ ...prev, [email]: "" }));
      await loadUsers();
    } catch (e) {
      setFeedback(email, false, e instanceof Error ? e.message : "Network error");
    } finally {
      setResetingEmail(null);
    }
  };

  const updateRole = async (email: string, role: UserRow["role"]) => {
    setSavingEmail(email);
    try {
      const response = await fetch("/api/auth/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFeedback(email, false, data.error ?? "Role update failed.");
        return;
      }
      setUsers((prev) => prev.map((row) => (row.email === email ? { ...row, role, source: "stored", credentialSource: "stored" } : row)));
      setFeedback(email, true, `Role changed to ${roleDisplayLabel(role)}`);
    } catch {
      setFeedback(email, false, "Network error");
    } finally {
      setSavingEmail(null);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword.trim()) return;
    setCreating(true);
    setStatus("");
    try {
      const response = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), password: newPassword, role: newRole })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Could not create user.");
        return;
      }
      setStatus(`Account created for ${newEmail.trim()}.`);
      setNewEmail("");
      setNewPassword("");
      setNewRole("admin");
      await loadUsers();
    } catch {
      setStatus("Could not create user.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="admin" style={{ maxWidth: 920, margin: "0 auto", padding: "2rem 1rem" }}>
      <nav className="admin-top-nav" aria-label="Admin sections">
        <a href="/?skipIntro=1">Site editor</a>
        <a href="/newsletter?edit=1">Newsletter editor</a>
        <a href="/admin/products">Products</a>
        <a href="/admin/users">Manage Users</a>
      </nav>
      <header className="admin-header">
        <div>
          <h1>Manage Users</h1>
          <p>Create accounts, reset passwords, and assign roles. Passwords are stored hashed and cannot be viewed.</p>
          {currentEmail ? (
            <p style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
              Signed in as <strong>{currentEmail}</strong>. To delete that account, sign in as another admin first.
              To change its password, type a new password (8+ characters) and click <strong>Reset password</strong>.
            </p>
          ) : null}
        </div>
      </header>

      {status ? <div className="admin-status">{status}</div> : null}

      <section className="admin-section" style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>Create new account</h2>
        <form onSubmit={(e) => void createUser(e)} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: "6px 12px", alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, opacity: 0.7 }}>
            Email / name
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="name@example.com"
              required
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.07)", color: "inherit", fontSize: 14 }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, opacity: 0.7 }}>
            Password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Choose a password"
              required
              minLength={8}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.07)", color: "inherit", fontSize: 14 }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, opacity: 0.7 }}>
            Role
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRow["role"])}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(30,40,35,1)", color: "#e8f3f0", fontSize: 14, height: "38px" }}
            >
              <option value="admin" style={{ background: "#1e2823", color: "#e8f3f0" }}>Admin (can edit)</option>
              <option value="production" style={{ background: "#1e2823", color: "#e8f3f0" }}>Production (fulfillment only)</option>
              <option value="newsletter" style={{ background: "#1e2823", color: "#e8f3f0" }}>Newsletter (editor only)</option>
              <option value="user" style={{ background: "#1e2823", color: "#e8f3f0" }}>User (read-only)</option>
            </select>
          </label>
          <button
            type="submit"
            className="button primary"
            disabled={creating || !newEmail.trim() || !newPassword.trim()}
            style={{ padding: "8px 12px", fontSize: 14, alignSelf: "end" }}
          >
            {creating ? "Creating…" : "Create account"}
          </button>
        </form>
      </section>

      <section className="admin-section">
        <h2 style={{ marginBottom: "1rem" }}>Existing accounts</h2>
        {loading ? (
          <p>Loading users...</p>
        ) : users.length === 0 ? (
          <p style={{ opacity: 0.6 }}>No accounts yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {users.map((row) => (
              <article key={row.email} style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "center",
                gap: "8px 14px",
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.email}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                      background: row.role === "admin" ? "rgba(30,180,120,0.18)" : row.role === "newsletter" ? "rgba(60,140,200,0.18)" : "rgba(180,140,30,0.18)",
                      color: row.role === "admin" ? "#3ecf8e" : row.role === "newsletter" ? "#6eb8e8" : "#d4a830",
                      border: `1px solid ${row.role === "admin" ? "rgba(62,207,142,0.3)" : row.role === "newsletter" ? "rgba(110,184,232,0.3)" : "rgba(212,168,48,0.3)"}`,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}>
                      {roleDisplayLabel(row.role)}
                    </span>
                    <span style={{ fontSize: 11, opacity: 0.55 }}>
                      {row.credentialSource === "env" ? "env credentials" : "stored (hashed)"}
                    </span>
                  </div>
                </div>

                {rowFeedback[row.email] && (
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                    background: rowFeedback[row.email].ok ? "rgba(30,180,120,0.15)" : "rgba(220,60,60,0.15)",
                    color: rowFeedback[row.email].ok ? "#3ecf8e" : "#f07070",
                    border: `1px solid ${rowFeedback[row.email].ok ? "rgba(62,207,142,0.3)" : "rgba(220,60,60,0.3)"}`,
                    whiteSpace: "nowrap", gridColumn: "1 / -1",
                  }}>
                    {rowFeedback[row.email].ok ? "✓ " : "✗ "}{rowFeedback[row.email].msg}
                  </span>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                  <select value={row.role} disabled={savingEmail === row.email} onChange={(event) => void updateRole(row.email, event.target.value as UserRow["role"])} style={{ padding: "6px 10px", borderRadius: 6, background: "#1e2823", color: "#e8f3f0" }}><option value="admin">Admin</option><option value="production">Production</option><option value="newsletter">Newsletter</option><option value="user">Read-only</option></select>

                  <div style={{ display: "flex", gap: 7 }}>
                    <button type="button" onClick={() => void editUser(row)} disabled={editingEmail === row.email || deletingEmail === row.email} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(19,74,87,.24)", background: "rgba(255,255,255,.56)", color: "#134a57", fontWeight: 700, cursor: "pointer" }}>
                      {editingEmail === row.email ? "Saving…" : "Edit user"}
                    </button>
                    <button type="button" onClick={() => void deleteUser(row)} disabled={deletingEmail === row.email || row.email.toLowerCase() === currentEmail} title={row.email.toLowerCase() === currentEmail ? "Sign in as a different admin to delete this account" : "Delete user"} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(181,67,55,.3)", background: "rgba(181,67,55,.08)", color: "#a23d32", fontWeight: 700, cursor: "pointer", opacity: row.email.toLowerCase() === currentEmail ? .45 : 1 }}>
                      {deletingEmail === row.email ? "Deleting…" : row.email.toLowerCase() === currentEmail ? "Current session" : "Delete"}
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="password"
                      placeholder="New password (min 8)"
                      minLength={8}
                      autoComplete="new-password"
                      value={newPasswords[row.email] ?? ""}
                      onChange={(e) => setNewPasswords((prev) => ({ ...prev, [row.email]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void resetPassword(row.email);
                        }
                      }}
                      style={{
                        padding: "6px 10px", borderRadius: 6, fontSize: 12, width: 160,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.05)", color: "inherit",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void resetPassword(row.email)}
                      disabled={resetingEmail === row.email || (newPasswords[row.email]?.trim().length ?? 0) < 8}
                      title={(newPasswords[row.email]?.trim().length ?? 0) < 8 ? "Enter at least 8 characters" : "Save new password"}
                      style={{
                        padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: "none", cursor: "pointer", whiteSpace: "nowrap",
                        background: "rgba(100,140,255,0.15)", color: "#8aadff",
                        outline: "1px solid rgba(100,140,255,0.3)",
                        opacity: (newPasswords[row.email]?.trim().length ?? 0) < 8 ? 0.4 : 1,
                      }}
                    >
                      {resetingEmail === row.email ? "Saving…" : "Reset password"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
