import type { Metadata } from "next";
import { headers } from "next/headers";
import { Montserrat } from "next/font/google";
import { Cormorant_Garamond } from "next/font/google";
import { Raleway } from "next/font/google";
import { Josefin_Sans } from "next/font/google";
import { readSiteContentFromDisk } from "../lib/read-site-content";
import { isMaromaMobileUserAgent } from "../lib/mobile-viewport";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import "./globals.css";
import "./home-responsive.css";
import "./components/home-collections.css";

export const dynamic = "force-dynamic";

const sans = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-sans",
  adjustFontFallback: true
});

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  adjustFontFallback: true
});

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["200", "300", "400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-raleway",
  adjustFontFallback: true
});

const josefin = Josefin_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-josefin",
  adjustFontFallback: true
});

export const metadata: Metadata = {
  title: "Maroma",
  description:
    "Botanical skincare, body care, and home rituals handmade in Auroville. Shop by care category, explore morning and evening rituals, and discover vegan, cruelty-free essentials."
};

export const viewport = {
  width: "device-width",
  initialScale: 1
};

import { CartProvider } from "../context/CartContext";
import { AdminBar } from "./components/AdminBar";
import { ViewportRootSync } from "./components/ViewportRootSync";

import Script from "next/script";

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const initialSiteContent = await readSiteContentFromDisk();
  const initialNav = { brand: initialSiteContent.brand, nav: initialSiteContent.nav };
  const ua = (await headers()).get("user-agent") ?? "";
  const initialViewportIsMobile = isMaromaMobileUserAgent(ua);

  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${raleway.variable} ${josefin.variable}`}>
      <body className="antialiased">
        <Script
          id="maroma-viewport-sync"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var q=window.matchMedia("(max-width:900px)");var t=window.matchMedia("(hover:none) and (pointer:coarse)");function s(){var m=q.matches||t.matches;document.documentElement.classList.toggle("maroma-viewport-mobile",m);document.documentElement.toggleAttribute("data-maroma-viewport-mobile",m);}s();q.addEventListener("change",s);t.addEventListener("change",s);}catch(e){}})();`,
          }}
        />
        <ViewportRootSync />
        <Script src="https://elfsightcdn.com/platform.js" strategy="afterInteractive" />
        <AdminBar />
        <CartProvider>
          <SiteHeader initialNav={initialNav} initialViewportIsMobile={initialViewportIsMobile} />
          {children}
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
