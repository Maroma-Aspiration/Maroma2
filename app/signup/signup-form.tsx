"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);
  const nextRaw = searchParams.get("next");
  const next = nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/account";
  const isCurationsSignup = searchParams.get("source") === "maroma-curations";
  const nextWithName = (() => {
    if (!isCurationsSignup || !name.trim()) return next;
    try {
      const destination = new URL(next, "https://maroma.local");
      destination.searchParams.set("name", name.trim());
      return `${destination.pathname}${destination.search}`;
    } catch {
      return next;
    }
  })();
  const existingAccountLoginHref = `/login?next=${encodeURIComponent(nextWithName)}&email=${encodeURIComponent(email)}`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = (await response.json()) as { error?: string; role?: string };
      if (!response.ok) {
        if (response.status === 409 && isCurationsSignup) {
          setExistingAccount(true);
          setError("");
          return;
        }
        setError(data.error ?? "Create account failed.");
        return;
      }
      if (data.role === "admin") {
        router.push("/?skipIntro=1");
      } else if (data.role === "newsletter") {
        router.push("/newsletter?edit=1");
      } else {
        router.push(nextWithName);
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="login-eyebrow">Maroma</p>
        <h1 className="login-title">Create account</h1>
        {existingAccount ? (
          <div className="curations-existing-account" role="status">
            <p className="curations-existing-kicker">This account already exists</p>
            <h2>Would you like to make this your Maroma Curations account?</h2>
            <p>Sign in with <strong>{email}</strong> to keep the recommendations you have just chosen.</p>
            <div className="curations-existing-actions">
              <Link href={existingAccountLoginHref} className="button primary button-sage">Use this account</Link>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setExistingAccount(false);
                  setEmail("");
                  setPassword("");
                  setConfirmPassword("");
                }}
              >
                Create new
              </button>
            </div>
          </div>
        ) : <form className="login-form" onSubmit={submit}>
          {isCurationsSignup ? (
            <label>
              What should we call you?
              <input
                type="text"
                autoComplete="given-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                required
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          <label>
            Confirm password
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            Show password
          </label>
          {error ? <p className="login-error">{error}</p> : null}
          <button type="submit" className="button primary button-sage" disabled={pending}>
            {pending ? "Creating…" : "Create account"}
          </button>
        </form>}
        <p className="login-footer">
          <Link href={`/login?next=${encodeURIComponent(next)}`}>Already have an account?</Link> ·{" "}
          <Link href="/">Back to site</Link>
        </p>
      </section>
    </main>
  );
}
