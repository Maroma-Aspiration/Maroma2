"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoreLocation } from "../../lib/store-locator-types";
import {
  filterStoreLocations,
  filterStoreLocationsByKind,
  filterStoreLocationsByRegion,
  sortStoreLocations,
  storeKindLabel,
  type StoreKindFilter,
  type StoreRegionFilter,
} from "../../lib/store-locator-search";

const REGION_FILTERS: { id: StoreRegionFilter; label: string }[] = [
  { id: "all", label: "All regions" },
  { id: "india", label: "India" },
  { id: "international", label: "International" },
];

const KIND_FILTERS: { id: StoreKindFilter; label: string }[] = [
  { id: "all", label: "All types" },
  { id: "outlet", label: "Outlets" },
  { id: "store", label: "Boutiques" },
  { id: "spa", label: "Spas" },
  { id: "retailer", label: "Retailers" },
  { id: "distributor", label: "Distributors" },
];

function formatAddress(location: StoreLocation): string {
  return [location.address, location.city, location.region, location.postalCode, location.country]
    .filter(Boolean)
    .join(", ");
}

function mapEmbedUrl(location: StoreLocation): string {
  const query =
    location.lat != null && location.lng != null
      ? `${location.lat},${location.lng}`
      : formatAddress(location);
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=13&output=embed`;
}

export default function StoreLocatorClient({ locations }: { locations: StoreLocation[] }) {
  const sorted = useMemo(() => sortStoreLocations(locations), [locations]);
  const [query, setQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<StoreRegionFilter>("all");
  const [kindFilter, setKindFilter] = useState<StoreKindFilter>("all");
  const [selectedId, setSelectedId] = useState(sorted[0]?.id ?? "");

  const filtered = useMemo(() => {
    let next = sorted;
    next = filterStoreLocationsByRegion(next, regionFilter);
    next = filterStoreLocationsByKind(next, kindFilter);
    next = filterStoreLocations(next, query);
    return next;
  }, [sorted, regionFilter, kindFilter, query]);

  useEffect(() => {
    if (filtered.length === 0) return;
    if (!filtered.some((location) => location.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((location) => location.id === selectedId) ?? filtered[0] ?? null;
  const indiaCount = sorted.filter((l) => l.country.toLowerCase() === "india").length;
  const internationalCount = sorted.length - indiaCount;

  return (
    <main className="store-locator-page">
      <header
        className="store-locator-hero"
        data-review="Store locator"
        data-review-id="stores-hero"
        data-review-files="app/stores/store-locator-client.tsx"
      >
        <p className="store-locator-eyebrow">Worldwide</p>
        <h1>Store locator</h1>
        <p className="store-locator-lead">
          Find Maroma outlets, Kalki boutiques, the spa, and partners across India and around the world.
        </p>
        <div className="store-locator-stats">
          <span>{sorted.length} locations</span>
          <span>{indiaCount} in India</span>
          <span>{internationalCount} international</span>
        </div>
      </header>

      <section className="store-locator-toolbar" aria-label="Search and filters">
        <label className="store-locator-search">
          <span className="sr-only">Search city, country, or store name</span>
          <svg className="store-locator-search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M10.5 3a7.5 7.5 0 015.92 12.08l4.35 4.35-1.42 1.42-4.35-4.35A7.5 7.5 0 1110.5 3zm0 2a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"
              fill="currentColor"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try Miami, London, Pondicherry, spa, distributor…"
            autoComplete="off"
          />
        </label>

        <div className="store-locator-filter-row">
          <div className="store-locator-filter-group" role="group" aria-label="Region">
            {REGION_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`store-locator-chip${regionFilter === filter.id ? " is-active" : ""}`}
                onClick={() => setRegionFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="store-locator-filter-group" role="group" aria-label="Location type">
            {KIND_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`store-locator-chip${kindFilter === filter.id ? " is-active" : ""}`}
                onClick={() => setKindFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <p className="store-locator-result-count">
          {filtered.length === sorted.length
            ? `Showing all ${filtered.length} locations`
            : `${filtered.length} of ${sorted.length} locations match`}
        </p>
      </section>

      <div className="store-locator-layout">
        <aside className="store-locator-sidebar" aria-label="Location list">
          <ul className="store-locator-list">
            {filtered.map((location) => {
              const active = location.id === selected?.id;
              return (
                <li key={location.id}>
                  <button
                    type="button"
                    className={`store-locator-card${active ? " is-active" : ""}`}
                    onClick={() => setSelectedId(location.id)}
                    aria-current={active ? "true" : undefined}
                  >
                    <span className={`store-locator-kind store-locator-kind--${location.kind}`}>
                      {storeKindLabel(location.kind)}
                    </span>
                    <strong>{location.name}</strong>
                    <span className="store-locator-card-meta">
                      {[location.city, location.country].filter(Boolean).join(", ")}
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 ? (
              <li className="store-locator-empty">
                <p>No locations match that search.</p>
                <button type="button" className="button secondary" onClick={() => setQuery("")}>
                  Clear search
                </button>
              </li>
            ) : null}
          </ul>
        </aside>

        {selected ? (
          <article className="store-locator-detail" aria-label="Selected location">
            <div className="store-locator-detail-card">
              <div className="store-locator-detail-head">
                <span className={`store-locator-kind store-locator-kind--${selected.kind}`}>
                  {storeKindLabel(selected.kind)}
                </span>
                <h2>{selected.name}</h2>
                <p className="store-locator-detail-address">{formatAddress(selected)}</p>
              </div>

              <div className="store-locator-detail-actions">
                {selected.phone ? (
                  <a href={`tel:${selected.phone.replace(/\s/g, "")}`} className="store-locator-contact">
                    {selected.phone}
                  </a>
                ) : null}
                {selected.email ? (
                  <a href={`mailto:${selected.email}`} className="store-locator-contact">
                    {selected.email}
                  </a>
                ) : null}
                {selected.website ? (
                  <a
                    href={selected.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button primary button-sage store-locator-website-btn"
                  >
                    Visit website
                  </a>
                ) : null}
              </div>

              <div className="store-locator-map-wrap">
                <iframe title={`Map of ${selected.name}`} src={mapEmbedUrl(selected)} loading="lazy" />
              </div>
            </div>
          </article>
        ) : (
          <article className="store-locator-detail store-locator-detail--empty">
            <div className="store-locator-detail-card">
              <h2>Search for a location</h2>
              <p>Try a city, country, or partner name to see details and a map.</p>
            </div>
          </article>
        )}
      </div>
    </main>
  );
}
