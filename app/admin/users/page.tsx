"use client";

import { useEffect, useState } from "react";

type UserRow = {
  email: string;
  role: "admin" | "user";
  source: "env" | "stored";
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState<string | null>(null);

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

  const updateRole = async (email: string, role: "admin" | "user") => {
    setSavingEmail(email);
    setStatus("");
    try {
      const response = await fetch("/api/auth/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Role update failed.");
        return;
      }
      setUsers((prev) => prev.map((row) => (row.email === email ? { ...row, role, source: "stored" } : row)));
      setStatus(`Updated ${email} to ${role}.`);
    } catch {
      setStatus("Role update failed.");
    } finally {
      setSavingEmail(null);
    }
  };

  return (
    <main className="admin" style={{ maxWidth: 920, margin: "0 auto", padding: "2rem 1rem" }}>
      <nav className="admin-top-nav" aria-label="Admin sections">
        <a href="/admin">Main Admin</a>
        <a href="/newsletter?edit=1">Newsletter editor</a>
        <a href="/admin/users">Manage Users</a>
      </nav>
      <header className="admin-header">
        <div>
          <h1>Manage Users</h1>
          <p>Assign or remove admin role. Changes apply immediately to future requests.</p>
        </div>
      </header>
      {status ? <div className="admin-status">{status}</div> : null}
      {loading ? (
        <p>Loading users...</p>
      ) : (
        <section className="admin-section">
          <div className="admin-grid">
            {users.map((row) => (
              <article key={row.email} className="admin-card">
                <h3>{row.email}</h3>
                <p>
                  <strong>Role:</strong> {row.role}
                </p>
                <p>
                  <strong>Source:</strong> {row.source}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => void updateRole(row.email, "user")}
                    disabled={savingEmail === row.email || row.role === "user"}
                  >
                    Remove admin
                  </button>
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => void updateRole(row.email, "admin")}
                    disabled={savingEmail === row.email || row.role === "admin"}
                  >
                    Make admin
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

