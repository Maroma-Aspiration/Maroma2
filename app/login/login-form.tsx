"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useEffect } from "react";

const reasonCopy: Record<string, string> = {
  auth_not_configured:
    "This server has not set MAROMA_SESSION_SECRET and MAROMA_AUTH_USERS yet. Ask your developer to configure sign-in.",
  sign_in_required: "Please sign in to continue.",
  admin_only: "That area is limited to admin accounts.",
  forbidden: "You do not have access to that page."
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    document.body.classList.add("auth-screen-active");
    return () => document.body.classList.remove("auth-screen-active");
  }, []);

  const reason = searchParams.get("reason") ?? "";
  const reasonMessage = reason ? reasonCopy[reason] ?? "" : "";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = (await response.json()) as { ok?: boolean; role?: string; error?: string };
      if (!response.ok) {
        setError(data.error ?? "Sign-in failed.");
        return;
      }
      const nextRaw = searchParams.get("next");
      const next =
        nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : null;
      if (data.role === "admin") {
        router.push(next ?? "/admin");
        router.refresh();
        return;
      }
      if (next?.startsWith("/admin")) {
        router.push("/account?reason=admin_only");
        router.refresh();
        return;
      }
      router.push(next ?? "/account");
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
        <h1 className="login-title">Sign in</h1>
        {reasonMessage ? <p className="login-reason">{reasonMessage}</p> : null}
        <form className="login-form" onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
          <p className="login-footer" style={{ margin: "0 0 8px", textAlign: "left" }}>
            <Link href="/forgot-password">Forgot password?</Link>
          </p>
          {error ? <p className="login-error">{error}</p> : null}
          <button type="submit" className="button primary button-sage" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="login-footer">
          <Link href="/signup">Create account</Link> ·{" "}
          <Link href="/">Back to site</Link>
        </p>
        <Link href="/admin/install" className="login-install-link">
          Install Production App
        </Link>
      </section>
    </main>
  );
}
