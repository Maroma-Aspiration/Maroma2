"use client";

import { useEffect, useState } from "react";

type UserRow = {
  email: string;
  role: "admin" | "user";
  source: "env" | "stored";
  password: string;
  passwordSource: "env" | "stored";
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState<string | null>(null);
  const [resetingEmail, setResetingEmail] = useState<string | null>(null);
  const [newPasswords, setNewPasswords] = useState<Record<string, string>>({});
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [rowFeedback, setRowFeedback] = useState<Record<string, { ok: boolean; msg: string }>>({});

  // New user form state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("admin");
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
  }, []);

  const setFeedback = (email: string, ok: boolean, msg: string) => {
    setRowFeedback((prev) => ({ ...prev, [email]: { ok, msg } }));
    setTimeout(() => setRowFeedback((prev) => { const n = { ...prev }; delete n[email]; return n; }), 4000);
  };

  const resetPassword = async (email: string) => {
    const pw = newPasswords[email]?.trim();
    if (!pw) return;
    setResetingEmail(email);
    try {
      const response = await fetch("/api/auth/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action: "reset_password", password: pw })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        setFeedback(email, false, data.error ?? `HTTP ${response.status}`);
        return;
      }
      setFeedback(email, true, "Password updated");
      setNewPasswords((prev) => ({ ...prev, [email]: "" }));
      await loadUsers();
    } catch (e) {
      setFeedback(email, false, e instanceof Error ? e.message : "Network error");
    } finally {
      setResetingEmail(null);
    }
  };

  const updateRole = async (email: string, role: "admin" | "user") => {
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
      setUsers((prev) => prev.map((row) => (row.email === email ? { ...row, role, source: "stored" } : row)));
      setFeedback(email, true, role === "admin" ? "Admin granted" : "Admin revoked");
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
        <a href="/admin">Main Admin</a>
        <a href="/newsletter?edit=1">Newsletter editor</a>
        <a href="/admin/products">Products</a>
        <a href="/admin/users">Manage Users</a>
      </nav>
      <header className="admin-header">
        <div>
          <h1>Manage Users</h1>
          <p>Create accounts, view passwords, and assign roles. Admins can edit the newsletter.</p>
        </div>
      </header>

      {status ? <div className="admin-status">{status}</div> : null}

      {/* ── Create new account ───────────────────────────────────────── */}
      <section className="admin-section" style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>Create new account</h2>
        <form onSubmit={(e) => void createUser(e)} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: "6px 12px", alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, opacity: 0.7 }}>
            Email
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="editor@example.com"
              required
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.07)", color: "inherit", fontSize: 14 }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, opacity: 0.7 }}>
            Password
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Choose a password"
              required
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.07)", color: "inherit", fontSize: 14 }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, opacity: 0.7 }}>
            Role
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "admin" | "user")}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(30,40,35,1)", color: "#e8f3f0", fontSize: 14, height: "38px" }}
            >
              <option value="admin" style={{ background: "#1e2823", color: "#e8f3f0" }}>Admin (can edit)</option>
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

      {/* ── Existing users ───────────────────────────────────────────── */}
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
                {/* Email + role badge + password */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.email}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                      background: row.role === "admin" ? "rgba(30,180,120,0.18)" : "rgba(180,140,30,0.18)",
                      color: row.role === "admin" ? "#3ecf8e" : "#d4a830",
                      border: `1px solid ${row.role === "admin" ? "rgba(62,207,142,0.3)" : "rgba(212,168,48,0.3)"}`,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}>
                      {row.role === "admin" ? "Admin" : "Read-only"}
                    </span>
                    <span style={{ fontSize: 11, opacity: 0.55 }}>
                      {row.passwordSource === "env" ? "env password" : "stored password"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, opacity: 0.65 }}>Password:</span>
                    <code style={{
                      fontSize: 13, padding: "4px 8px", borderRadius: 4,
                      background: "rgba(255,255,255,0.06)", letterSpacing: visiblePasswords[row.email] ? "normal" : "0.12em",
                    }}>
                      {visiblePasswords[row.email] ? row.password : "••••••••"}
                    </code>
                    <button
                      type="button"
                      onClick={() => setVisiblePasswords((prev) => ({ ...prev, [row.email]: !prev[row.email] }))}
                      style={{
                        padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        border: "none", cursor: "pointer",
                        background: "rgba(255,255,255,0.08)", color: "inherit",
                      }}
                    >
                      {visiblePasswords[row.email] ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {/* Inline feedback */}
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
                  {/* Toggle admin */}
                  <button
                    type="button"
                    onClick={() => void updateRole(row.email, row.role === "admin" ? "user" : "admin")}
                    disabled={savingEmail === row.email}
                    style={{
                      padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                      border: "none", cursor: "pointer", whiteSpace: "nowrap",
                      background: row.role === "admin" ? "rgba(220,60,60,0.15)" : "rgba(30,180,120,0.15)",
                      color: row.role === "admin" ? "#f07070" : "#3ecf8e",
                      outline: `1px solid ${row.role === "admin" ? "rgba(220,60,60,0.3)" : "rgba(62,207,142,0.3)"}`,
                    }}
                  >
                    {savingEmail === row.email ? "Saving…" : row.role === "admin" ? "Revoke admin" : "Grant admin"}
                  </button>

                  {/* Reset password inline */}
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="text"
                      placeholder="New password"
                      value={newPasswords[row.email] ?? ""}
                      onChange={(e) => setNewPasswords((prev) => ({ ...prev, [row.email]: e.target.value }))}
                      style={{
                        padding: "6px 10px", borderRadius: 6, fontSize: 12, width: 140,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.05)", color: "inherit",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void resetPassword(row.email)}
                      disabled={resetingEmail === row.email || !newPasswords[row.email]?.trim()}
                      style={{
                        padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: "none", cursor: "pointer", whiteSpace: "nowrap",
                        background: "rgba(100,140,255,0.15)", color: "#8aadff",
                        outline: "1px solid rgba(100,140,255,0.3)",
                        opacity: !newPasswords[row.email]?.trim() ? 0.4 : 1,
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
