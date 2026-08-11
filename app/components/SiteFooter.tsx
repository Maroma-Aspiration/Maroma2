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
        if (!cancelled) {
          setUser(data.user ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
        }
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
      ? { href: "/admin", label: "Site editor" }
      : user
        ? { href: "/account", label: "Account" }
        : { href: loginHref, label: "Login" };

  return (
    <footer className="site-footer" aria-label="Site">
      <div className="site-footer-actions" aria-label="Account">
        <Link href={accountLink.href} className="site-footer-login-link">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 12.2c2.1 0 3.8-1.8 3.8-4s-1.7-4-3.8-4-3.8 1.8-3.8 4 1.7 4 3.8 4Zm0 2.2c-3 0-5.7 1.6-7 4.1-.3.6.1 1.3.8 1.3h12.3c.7 0 1.2-.7.8-1.3-1.3-2.5-4-4.1-7-4.1Z"
              fill="currentColor"
            />
          </svg>
          {accountLink.label}
        </Link>
      </div>
    </footer>
  );
}
