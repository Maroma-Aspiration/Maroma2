"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  resolveSafetyTranslation,
  SAFETY_LANGUAGES,
  type SafetyLanguage,
  type SafetySet,
} from "../../../lib/safety-guidelines-types";

type Props = {
  set: SafetySet;
  language: SafetyLanguage;
};

export default function SafetyInsertClient({ set, language }: Props) {
  /** Site header, footer and admin bar are global, so the insert hides them while it is open. */
  useEffect(() => {
    document.body.classList.add("safety-insert-active");
    return () => document.body.classList.remove("safety-insert-active");
  }, []);

  const resolved = resolveSafetyTranslation(set, language);
  if (!resolved.translation) return null;

  return (
    <main className="safety-insert-page">
      <div className="safety-insert-toolbar">
        <div>
          <strong>{set.label}</strong>
          <span>Insert sized for A5, ready to print or save as PDF.</span>
        </div>
        <div className="safety-insert-toolbar-actions">
          {SAFETY_LANGUAGES.map((option) => (
            <Link
              key={option.code}
              href={`/safety-guidelines/insert?set=${set.id}&lang=${option.code}`}
              className={option.code === language ? "is-active" : undefined}
            >
              {option.label}
            </Link>
          ))}
          <button type="button" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      <article className="safety-insert-sheet">
        <header>
          <p className="safety-insert-brand">Maroma</p>
          <h1>{resolved.translation.title || set.label}</h1>
        </header>
        {resolved.translation.sections.map((section, index) => (
          <section key={`${set.id}-${index}`}>
            {section.heading ? <h2>{section.heading}</h2> : null}
            {section.body ? <p>{section.body}</p> : null}
            {section.items.length ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
        <footer>
          <span>maroma.com/safety-guidelines</span>
          <span>Maroma, Auroville, Tamil Nadu 605101, India</span>
        </footer>
      </article>
    </main>
  );
}
