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
  const [open, setOpen] = useState<"shop" | "experiences" | "menu" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => setOpen(null), [pathname]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(null); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const closeMenu = () => setOpen(null);
  return <div ref={root} className={`compact-shop-links${open ? " is-menu-open" : ""}`} onKeyDown={(event) => {
    if (event.key === "Escape") { setOpen(null); root.current?.querySelector<HTMLButtonElement>(".compact-shop-hamburger")?.focus(); }
  }}>
    <button
      type="button"
      className="compact-shop-hamburger"
      aria-expanded={open === "menu" || open === "shop" || open === "experiences"}
      aria-controls="compact-shop-drawer"
      onClick={() => setOpen(open === "menu" ? null : "menu")}
    >
      <span className="sr-only">{open === "menu" ? "Close menu" : "Open menu"}</span>
      <span aria-hidden="true">{open === "menu" ? "×" : "☰"}</span>
    </button>
    <div id="compact-shop-drawer" className="compact-shop-drawer">
    <Link href="/" aria-current={pathname === "/" ? "page" : undefined} onClick={closeMenu}>Home</Link>
    <div className="compact-shop-dropdown">
      <button type="button" aria-expanded={open === "shop"} aria-controls="shop-collections" onClick={() => setOpen(open === "shop" ? "menu" : "shop")}>Shop <span className="compact-shop-chevron" aria-hidden="true" /></button>
      {open === "shop" ? <nav id="shop-collections" className="compact-shop-menu" aria-label="Shop collections" onClick={closeMenu}>
        <Link href="/shop">All products</Link>
        {collections.map(([name, href]) => <Link key={href} href={href}>{name}</Link>)}
      </nav> : null}
    </div>
    <Link href="/gifting" onClick={closeMenu}>Gifting</Link>
    <Link href="/promo" onClick={closeMenu}>Offers</Link>
    <div className="compact-shop-dropdown">
      <button type="button" aria-expanded={open === "experiences"} aria-controls="shop-experiences" onClick={() => setOpen(open === "experiences" ? "menu" : "experiences")}>Experiences <span className="compact-shop-chevron" aria-hidden="true" /></button>
      {open === "experiences" ? <nav id="shop-experiences" className="compact-shop-menu" aria-label="Maroma experiences" onClick={closeMenu}>
        <a href={experiencesUrl} target="_blank" rel="noopener noreferrer">Maroma Experiences</a>
        <a href={spaUrl} target="_blank" rel="noopener noreferrer">Maroma Spa / Book Now</a>
      </nav> : null}
    </div>
    <Link href="/about" className="compact-shop-extra" onClick={closeMenu}>About</Link>
    <Link href="/ingredient" className="compact-shop-extra" onClick={closeMenu}>Ingredients</Link>
    <Link href="/blog" className="compact-shop-extra" onClick={closeMenu}>Journal</Link>
    </div>
  </div>;
}
