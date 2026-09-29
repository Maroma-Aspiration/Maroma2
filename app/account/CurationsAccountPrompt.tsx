"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Selection = {
  category: string;
  productIds: string[];
  choices: { type: string; goal: string; routine: string };
};

export function CurationsAccountPrompt({
  email,
  initialName,
  selection,
  returnHref,
  createNewHref
}: {
  email: string;
  initialName: string;
  selection: Selection;
  returnHref: string;
  createNewHref: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState<"existing" | "new" | null>(null);
  const [error, setError] = useState("");

  const useExistingAccount = async () => {
    if (!name.trim()) {
      setError("Please tell us your name.");
      return;
    }
    setPending("existing");
    setError("");
    try {
      const response = await fetch("/api/curations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...selection, name: name.trim() })
      });
      if (!response.ok) throw new Error("save_failed");
      const destination = new URL(returnHref, window.location.origin);
      destination.searchParams.set("name", name.trim());
      router.push(`${destination.pathname}${destination.search}`);
      router.refresh();
    } catch {
      setError("We could not save your recommendations just now. Please try again.");
      setPending(null);
    }
  };

  const createNewAccount = async () => {
    setPending("new");
    setError("");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push(createNewHref);
      router.refresh();
    } catch {
      setError("We could not start a new account just now. Please try again.");
      setPending(null);
    }
  };

  return (
    <main className="curations-account-page">
      <section className="curations-account-card">
        <div className="curations-account-mark" aria-hidden="true">M</div>
        <p className="curations-account-kicker">Maroma Curations</p>
        <h1>This account already exists.</h1>
        <p className="curations-account-question">Would you like to make this your Maroma Curations account?</p>
        <p className="curations-account-email">Signed in as <strong>{email}</strong></p>
        <label className="curations-account-name">
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
        {error ? <p className="login-error">{error}</p> : null}
        <div className="curations-account-actions">
          <button type="button" onClick={useExistingAccount} disabled={pending !== null || !name.trim()}>
            {pending === "existing" ? "Saving..." : "Yes, use this account"}
          </button>
          <span>or</span>
          <button type="button" className="is-secondary" onClick={createNewAccount} disabled={pending !== null}>
            {pending === "new" ? "Opening..." : "Create new"}
          </button>
        </div>
      </section>
    </main>
  );
}
