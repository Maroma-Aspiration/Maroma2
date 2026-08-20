"use client";

import { useState, type FormEvent } from "react";

export function JournalSubscribeForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Could not subscribe.");
        return;
      }
      setStatus("ok");
      setMessage("You’re on the list. Thank you.");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Could not subscribe. Try again.");
    }
  };

  return (
    <div className="stories-subscribe">
      <form className="stories-subscribe-form" onSubmit={(event) => void onSubmit(event)}>
        <label className="sr-only" htmlFor="journal-subscribe-email">
          Email address
        </label>
        <input
          id="journal-subscribe-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="Your email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={status === "saving"}
        />
        <button type="submit" className="button primary button-sage" disabled={status === "saving"}>
          {status === "saving" ? "Subscribing…" : "Subscribe"}
        </button>
      </form>
      {message ? (
        <p className={`stories-subscribe-note${status === "error" ? " is-error" : ""}`} role="status">
          {message}
        </p>
      ) : (
        <p className="stories-subscribe-note">Get new stories and the Maroma newsletter by email.</p>
      )}
    </div>
  );
}
