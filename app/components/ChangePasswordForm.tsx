"use client";

import { useState } from "react";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not update password.");
        return;
      }
      setSuccess("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      setError("Network error.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="login-form" onSubmit={submit} style={{ marginTop: 8 }}>
      <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Change password</h2>
      <label>
        Current password
        <input
          type={showPasswords ? "text" : "password"}
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </label>
      <label>
        New password
        <input
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
          required
        />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
        <input
          type="checkbox"
          checked={showPasswords}
          onChange={(e) => setShowPasswords(e.target.checked)}
        />
        Show passwords
      </label>
      {error ? <p className="login-error">{error}</p> : null}
      {success ? <p className="login-reason" style={{ color: "#3ecf8e" }}>{success}</p> : null}
      <button type="submit" className="button secondary" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
