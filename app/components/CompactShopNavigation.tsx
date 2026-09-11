"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import "./compact-shop-navigation.css";

const collections = [
  ["Face", "/face-care"], ["Body", "/body-care"], ["Hair", "/hair-care"],
  ["Baby", "/baby"], ["Men", "/man"], ["Perfumes", "/perfumes"],
  ["Home Care", "/home-essentials"], ["Colibri", "/colibri"],
];

export function CompactShopNavigation({ experiencesUrl, spaUrl }: { experiencesUrl: string; spaUrl: string }) {
  const [open, setOpen] = useState<"shop" | "experiences" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => setOpen(null), [pathname]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(null); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return <div ref={root} className="compact-shop-links" onKeyDown={(event) => {
    if (event.key === "Escape") { setOpen(null); root.current?.querySelector<HTMLButtonElement>(`button[aria-expanded="true"]`)?.focus(); }
  }}>
    <Link href="/" aria-current={pathname === "/" ? "page" : undefined} onClick={() => setOpen(null)}>Home</Link>
    <div className="compact-shop-dropdown">
      <button type="button" aria-expanded={open === "shop"} aria-controls="shop-collections" onClick={() => setOpen(open === "shop" ? null : "shop")}>Shop <span aria-hidden="true">⌄</span></button>
      {open === "shop" ? <nav id="shop-collections" className="compact-shop-menu" aria-label="Shop collections" onClick={() => setOpen(null)}>
        <Link href="/shop">All products</Link>
        {collections.map(([name, href]) => <Link key={href} href={href}>{name}</Link>)}
      </nav> : null}
    </div>
    <Link href="/gifting">Gifting</Link>
    <Link href="/special">Offers</Link>
    <div className="compact-shop-dropdown">
      <button type="button" aria-expanded={open === "experiences"} aria-controls="shop-experiences" onClick={() => setOpen(open === "experiences" ? null : "experiences")}>Experiences <span aria-hidden="true">⌄</span></button>
      {open === "experiences" ? <nav id="shop-experiences" className="compact-shop-menu" aria-label="Maroma experiences" onClick={() => setOpen(null)}>
        <a href={experiencesUrl} target="_blank" rel="noopener noreferrer">Maroma Experiences</a>
        <a href={spaUrl} target="_blank" rel="noopener noreferrer">Maroma Spa / Book Now</a>
      </nav> : null}
    </div>
  </div>;
}
