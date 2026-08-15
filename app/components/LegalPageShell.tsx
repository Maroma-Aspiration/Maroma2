import Link from "next/link";
import type { ReactNode } from "react";

const LEGAL_NAV = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/shipping", label: "Shipping" },
  { href: "/returns", label: "Returns" },
] as const;

export function LegalPageShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-page">
      <article className="legal-article">
        <p className="legal-eyebrow">Maroma</p>
        <h1 className="legal-title">{title}</h1>
        <p className="legal-updated">Last updated {updated}</p>
        <div className="legal-body">{children}</div>
        <nav className="legal-nav" aria-label="Legal pages">
          {LEGAL_NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </article>
    </main>
  );
}
