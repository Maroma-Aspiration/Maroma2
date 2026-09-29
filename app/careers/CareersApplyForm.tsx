"use client";

import { useState } from "react";

const AREAS = [
  "Production and packing",
  "Fragrance and product development",
  "Design and storytelling",
  "Retail and hospitality",
  "Digital and commerce",
  "Other",
] as const;

export function CareersApplyForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [startDate, setStartDate] = useState("");
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");
  const [needs, setNeeds] = useState("");
  const [cvLink, setCvLink] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/careers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          area,
          startDate,
          duration,
          note,
          needs,
          cvLink,
          company: honeypot,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not send your application.");
        return;
      }
      setDone(true);
    } catch {
      setError("Could not send your application. Please try again or email maroma@maroma.com.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p className="careers-form-success" role="status">
        Thank you. We have received your application and will write back if a place is open. This can take two to
        three weeks.
      </p>
    );
  }

  return (
    <form
      className="careers-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label className="careers-hp" aria-hidden="true">
        Company
        <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} />
      </label>
      <label>
        Full name
        <input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Email
        <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        Phone
        <input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </label>
      <label>
        Area you want to join
        <select required value={area} onChange={(event) => setArea(event.target.value)}>
          <option value="">Select an area</option>
          {AREAS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <div className="careers-form-row">
        <label>
          Available from
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label>
          How long you can stay
          <input
            placeholder="e.g. 8 weeks"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </label>
      </div>
      <label>
        Why Maroma, and what you hope to learn
        <textarea required rows={5} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <label>
        Visa or housing needs
        <textarea rows={3} value={needs} onChange={(event) => setNeeds(event.target.value)} />
      </label>
      <label>
        Link to your CV (optional)
        <input
          type="url"
          inputMode="url"
          placeholder="https://"
          value={cvLink}
          onChange={(event) => setCvLink(event.target.value)}
        />
      </label>
      <button type="submit" className="button primary careers-form-submit" disabled={busy}>
        {busy ? "Sending…" : "Send application"}
      </button>
      {error ? (
        <p className="careers-form-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
