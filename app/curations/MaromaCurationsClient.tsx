"use client";

import Link from "next/link";
import { useState } from "react";
import { useCurrency } from "../../context/CurrencyContext";
import { decodeBasicHtmlEntities } from "../../lib/decode-html-entities";
import { getDisplayImageUrl } from "../../lib/product-image";
import { productPriceState } from "../../lib/product-pricing";
import type { ProductRecord } from "../../lib/product-types";

type Props = {
  products: ProductRecord[];
  categorySlug: string;
  categoryLabel: string;
  choices: { type: string; goal: string; routine: string };
  saved?: boolean;
  customerName?: string;
};

const DETAIL_QUESTIONS = [
  {
    id: "feel",
    label: "How would you like it to feel?",
    options: ["Light and refreshing", "Rich and nourishing", "Calm and gentle"]
  },
  {
    id: "priority",
    label: "What matters most?",
    options: ["Natural ingredients", "A beautiful scent", "Easy daily use"]
  }
] as const;

const choiceLabel = (value: string): string => {
  if (!value || value === "all") return "A little of everything";
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export function MaromaCurationsClient({ products, categorySlug, categoryLabel, choices, saved = false, customerName = "" }: Props) {
  const { formatCatalogPrice, isEstimated } = useCurrency();
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [detailAnswers, setDetailAnswers] = useState<Record<string, string>>({});
  const activeProduct = products.find((product) => product.id === activeProductId) ?? null;
  const accountParams = new URLSearchParams({
    view: "curations",
    category: categorySlug,
    products: products.map((product) => product.id).join(","),
    type: choices.type,
    goal: choices.goal,
    routine: choices.routine
  });
  const accountHref = `/account?${accountParams.toString()}`;
  const signupHref = `/signup?source=maroma-curations&next=${encodeURIComponent(accountHref)}`;
  const returnParams = new URLSearchParams({
    category: categorySlug,
    products: products.map((product) => product.id).join(","),
    type: choices.type,
    goal: choices.goal,
    routine: choices.routine
  });
  if (saved) returnParams.set("saved", "1");
  if (customerName) returnParams.set("name", customerName);
  const curationsReturnHref = `/curations?${returnParams.toString()}`;

  return (
    <main className="curations-page">
      <div className="curations-shell">
        <Link href={`/${categorySlug}`} className="curations-back">Back to {categoryLabel}</Link>

        <header className="curations-hero">
          <p>Maroma Curations</p>
          <h1>Chosen just for you.</h1>
          <span>{saved && customerName ? <>Hi {customerName}! Here are your products: <span aria-hidden="true">↓</span></> : <>Please see your personally-curated products below <span aria-hidden="true">↓</span></>}</span>
          <div className="curations-choice-summary" aria-label="Your choices">
            <strong>Your selection:</strong>
            <span>{choiceLabel(choices.type)}</span>
            <span>{choiceLabel(choices.goal)}</span>
            <span>{choiceLabel(choices.routine)}</span>
          </div>
        </header>

        <aside className={`curations-join${saved ? " is-saved" : ""}`}>
          <div className="curations-join-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <path d="M24 6c7 6 13 13 13 22a13 13 0 0 1-26 0C11 19 17 12 24 6Z" />
              <path d="M17 29c4-1 8-5 10-11 2 7 2 14-3 20" />
            </svg>
          </div>
          <div>
            <p>{saved ? "Saved to your Maroma Curations account" : "Would you like us to save your recommendations?"}</p>
            <span>{saved ? "Your personally-curated product range is ready whenever you return." : <>Get your own free Maroma page, with your own personally-curated product range just for you, special offers and more! Join now <span aria-hidden="true">↓</span></>}</span>
          </div>
          {saved ? <Link href="/account">Account settings</Link> : <Link href={signupHref}>Join Maroma Curations</Link>}
        </aside>

        <section className="curations-results" aria-labelledby="curations-results-title">
          <div className="curations-results-heading">
            <h2 id="curations-results-title">Recommended for you</h2>
            <span>Select any recommendation for a little more guidance.</span>
          </div>

          {products.length > 0 ? (
            <div className="curations-grid">
              {products.map((product) => {
                const imageSrc = getDisplayImageUrl(product);
                const priceState = productPriceState(product);
                const convertedPrice = formatCatalogPrice(priceState.active);
                const priceLabel = convertedPrice ? `${isEstimated ? "Approx. " : ""}${convertedPrice}` : "Price on request";
                const active = product.id === activeProductId;
                return (
                  <button
                    key={product.id}
                    type="button"
                    className={`curations-card${active ? " is-active" : ""}`}
                    aria-expanded={active}
                    onClick={() => {
                      setActiveProductId((current) => current === product.id ? null : product.id);
                      setDetailAnswers({});
                    }}
                  >
                    <span className="curations-card-image">
                      {imageSrc ? <img src={imageSrc} alt={`${decodeBasicHtmlEntities(product.name)} - Maroma`} /> : null}
                    </span>
                    <span className="curations-card-copy">
                      <strong>{decodeBasicHtmlEntities(product.name)}</strong>
                      <small>{priceState.onSale ? "Special price " : ""}{priceLabel}</small>
                      <em>Personalise this choice <span aria-hidden="true">+</span></em>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="curations-empty">
              <p>We could not prepare this selection yet.</p>
              <Link href={`/${categorySlug}`}>Tell us what you are looking for</Link>
            </div>
          )}

          {activeProduct ? (
            <section
              className="curations-detail"
              role="dialog"
              aria-modal="true"
              aria-label={`Fine-tune ${decodeBasicHtmlEntities(activeProduct.name)}`}
            >
              <div className="curations-detail-heading">
                <div>
                  <p>Let&apos;s make it more personal</p>
                  <h3>{decodeBasicHtmlEntities(activeProduct.name)}</h3>
                </div>
                <button type="button" onClick={() => setActiveProductId(null)} aria-label="Close detailed questions">×</button>
              </div>
              <div className="curations-detail-questions">
                {DETAIL_QUESTIONS.map((question) => (
                  <fieldset key={question.id}>
                    <legend>{question.label}</legend>
                    <div>
                      {question.options.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={detailAnswers[question.id] === option ? "is-selected" : ""}
                          aria-pressed={detailAnswers[question.id] === option}
                          onClick={() => setDetailAnswers((current) => ({ ...current, [question.id]: option }))}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <Link href={`/product/${activeProduct.id}?curations=${encodeURIComponent(curationsReturnHref)}`} className="curations-product-link">
                View your guided product choice <span aria-hidden="true">→</span>
              </Link>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}
