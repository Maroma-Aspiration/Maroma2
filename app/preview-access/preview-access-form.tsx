"use client";

import { FormEvent, useState } from "react";

export default function PreviewAccessForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/preview-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (response.ok) {
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
      return;
    }
    setError("Incorrect password.");
    setLoading(false);
  }

  return (
    <form className="preview-access-form" onSubmit={submit}>
      <label>
        <span>Password</span>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus required />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={loading}>{loading ? "Opening…" : "Enter site"}</button>
    </form>
  );
}

