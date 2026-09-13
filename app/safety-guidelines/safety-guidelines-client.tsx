"use client";

import Link from "next/link";
import { useState } from "react";
import {
  resolveSafetyTranslation,
  SAFETY_LANGUAGES,
  safetyLanguageLabel,
  type SafetyLanguage,
  type SafetySet,
} from "../../lib/safety-guidelines-types";

type Props = {
  sets: SafetySet[];
  initialLanguage: SafetyLanguage;
};

export default function SafetyGuidelinesClient({ sets, initialLanguage }: Props) {
  const [language, setLanguage] = useState<SafetyLanguage>(initialLanguage);

  const chooseLanguage = (next: SafetyLanguage) => {
    setLanguage(next);
    // Keep the address bar shareable without reloading the page.
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <main className="safety-page">
      <header className="safety-hero">
        <p className="safety-kicker">Product care</p>
        <h1>Safety guidelines</h1>
        <p>
          How to use and store Maroma incense and candles safely. Please keep these instructions for
          future reference.
        </p>
        <div className="safety-languages" role="group" aria-label="Choose a language">
          {SAFETY_LANGUAGES.map((option) => (
            <button
              key={option.code}
              type="button"
              className={option.code === language ? "is-active" : undefined}
              aria-pressed={option.code === language}
              onClick={() => chooseLanguage(option.code)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {sets.length > 1 ? (
          <nav className="safety-jump" aria-label="Jump to a section">
            {sets.map((set) => (
              <a key={set.id} href={`#${set.id}`}>
                {set.label}
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      {sets.map((set) => {
        const resolved = resolveSafetyTranslation(set, language);
        if (!resolved.translation) return null;
        return (
          <section key={set.id} id={set.id} className="safety-set">
            <div className="safety-set-head">
              <h2>{resolved.translation.title || set.label}</h2>
              {set.summary ? <p>{set.summary}</p> : null}
              {resolved.isFallback ? (
                <p className="safety-fallback-note">
                  {`Shown in ${safetyLanguageLabel(resolved.language)}. ${safetyLanguageLabel(language)} translation coming soon.`}
                </p>
              ) : null}
              <Link
                className="safety-print-link"
                href={`/safety-guidelines/insert?set=${set.id}&lang=${resolved.language}`}
              >
                Printable version
              </Link>
            </div>
            {resolved.translation.sections.map((section, index) => (
              <article key={`${set.id}-${index}`} className="safety-section">
                {section.heading ? <h3>{section.heading}</h3> : null}
                {section.body ? <p>{section.body}</p> : null}
                {section.items.length ? (
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </section>
        );
      })}

      <footer className="safety-footer">
        <p>
          Looking for guidance on a specific product? Every Maroma product guide lists its own steps.
          Scan the QR code on the pack, or <Link href="/">browse the range</Link>.
        </p>
      </footer>
    </main>
  );
}
