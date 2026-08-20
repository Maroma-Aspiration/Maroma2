"use client";

import { useState } from "react";
import Link from "next/link";

export default function B2bApplyClient() {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(false);

  const submit = async () => {
    setStatus("");
    const res = await fetch("/api/b2b/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, contactName, email, phone, country, website, message }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setStatus(data.error || "Could not submit application.");
      return;
    }
    setDone(true);
  };

  return (
    <main className="login-page">
      <section className="login-card" style={{ maxWidth: 640, width: "100%" }}>
        <p className="login-eyebrow">Wholesale</p>
        <h1 className="login-title">White-label application</h1>
        <p className="login-reason">
          Approved partners receive the full Maroma catalogue at 35% off, with a minimum order of
          ₹15,000.
        </p>
        {done ? (
          <p>Thank you. We will review your application and email you if it is approved.</p>
        ) : (
          <form
            className="login-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <input required placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            <input required placeholder="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
            <input placeholder="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
            <textarea
              rows={4}
              placeholder="Tell us about your business"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button type="submit" className="button primary button-sage">
              Submit application
            </button>
            {status ? <p className="login-reason">{status}</p> : null}
          </form>
        )}
        <p style={{ marginTop: 16 }}>
          Already approved? <Link href="/b2b">Sign in to your B2B page</Link>
        </p>
      </section>
    </main>
  );
}
