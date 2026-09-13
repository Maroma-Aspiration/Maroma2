"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type SessionUser = { email: string; role: string };

export function SiteFooter() {
  const pathname = usePathname();
  const loginHref = `/login?next=${encodeURIComponent(pathname || "/")}`;
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" })
      .then((res) => res.json())
      .then((data: { user?: SessionUser | null }) => {
        if (!cancelled) setUser(data.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (
    pathname?.startsWith("/admin") ||
    (pathname?.startsWith("/newsletter") && !pathname.startsWith("/newsletter/archive"))
  ) {
    return null;
  }

  const accountLink =
    user?.role === "admin"
      ? { href: "/?skipIntro=1", label: "Site editor" }
      : user?.role === "newsletter"
        ? { href: "/newsletter", label: "Newsletter editor" }
        : user
          ? { href: "/account", label: "Account" }
          : { href: loginHref, label: "Sign in" };

  return (
    <footer
      className="site-footer"
      aria-label="Site"
      data-review="Site footer"
      data-review-id="site-footer"
      data-review-files="app/components/SiteFooter.tsx"
    >
      <div className="site-footer-grid">
        <div>
          <strong>Maroma</strong>
          <p>
            Kuilapalayam, Auroville
            <br />
            Tamil Nadu 605101, India
          </p>
          <p>
            <a href="mailto:info@maroma.com">info@maroma.com</a>
          </p>
        </div>
        <nav aria-label="Shop">
          <h2>Shop</h2>
          <Link href="/#shop">All products</Link>
          <Link href="/gifting/build-your-set">Gifting</Link>
          <Link href="/stores">Store locator</Link>
          <Link href="/b2b/apply">Wholesale</Link>
        </nav>
        <nav aria-label="Company">
          <h2>Company</h2>
          <Link href="/about">About</Link>
          <Link href="/ingredient">Ingredients</Link>
          <Link href="/blog">Journal</Link>
          <Link href={user?.role === "admin" || user?.role === "newsletter" ? "/newsletter" : "/newsletter/archive"}>
            Newsletter
          </Link>
          <Link href={accountLink.href}>{accountLink.label}</Link>
        </nav>
        <nav aria-label="Social">
          <h2>Follow</h2>
          <a href="https://www.instagram.com/maromaindia/" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          <a href="https://www.facebook.com/maromaindia" target="_blank" rel="noopener noreferrer">
            Facebook
          </a>
          <a href="https://www.youtube.com/@maroma" target="_blank" rel="noopener noreferrer">
            YouTube
          </a>
        </nav>
        <nav className="site-footer-legal" aria-label="Legal">
          <h2>Legal</h2>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/shipping">Shipping</Link>
          <Link href="/returns">Returns</Link>
          <Link href="/safety-guidelines">Safety guidelines</Link>
        </nav>
      </div>
    </footer>
  );
}
