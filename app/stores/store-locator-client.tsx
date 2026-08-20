"use client";

import { useMemo, useState } from "react";
import type { StoreLocation } from "../../lib/store-locator-types";

export default function StoreLocatorClient({ locations }: { locations: StoreLocation[] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(locations[0]?.id ?? "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((location) =>
      [location.name, location.city, location.region, location.country, location.address, location.kind]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [locations, query]);

  const selected = filtered.find((l) => l.id === selectedId) ?? filtered[0] ?? null;
  const mapQuery = selected
    ? encodeURIComponent(
        selected.lat != null && selected.lng != null
          ? `${selected.lat},${selected.lng}`
          : `${selected.address} ${selected.city} ${selected.country}`
      )
    : "";

  return (
    <main className="store-locator-page">
      <header className="store-locator-head">
        <span className="eyebrow">Worldwide</span>
        <h1>Store locator</h1>
        <p>Find Maroma stores, retailers, distributors, the outlet, café and spa.</p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search city, country, or name"
        />
      </header>
      <div className="store-locator-grid">
        <ul className="store-locator-list">
          {filtered.map((location) => (
            <li key={location.id}>
              <button
                type="button"
                className={location.id === selected?.id ? "is-active" : ""}
                onClick={() => setSelectedId(location.id)}
              >
                <strong>{location.name}</strong>
                <span>
                  {location.kind} · {[location.city, location.country].filter(Boolean).join(", ")}
                </span>
              </button>
            </li>
          ))}
          {filtered.length === 0 ? <li>No locations match that search.</li> : null}
        </ul>
        {selected ? (
          <article className="store-locator-detail">
            <h2>{selected.name}</h2>
            <p>
              {[selected.address, selected.city, selected.region, selected.postalCode, selected.country]
                .filter(Boolean)
                .join(", ")}
            </p>
            {selected.phone ? <p>{selected.phone}</p> : null}
            {selected.email ? (
              <p>
                <a href={`mailto:${selected.email}`}>{selected.email}</a>
              </p>
            ) : null}
            {selected.website ? (
              <p>
                <a href={selected.website} target="_blank" rel="noopener noreferrer">
                  Website
                </a>
              </p>
            ) : null}
            {mapQuery ? (
              <iframe
                title={`Map of ${selected.name}`}
                src={`https://maps.google.com/maps?q=${mapQuery}&z=12&output=embed`}
                loading="lazy"
              />
            ) : null}
          </article>
        ) : null}
      </div>
    </main>
  );
}
