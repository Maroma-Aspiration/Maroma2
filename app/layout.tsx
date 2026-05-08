import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { Cormorant_Garamond } from "next/font/google";
import { Raleway } from "next/font/google";
import { Josefin_Sans } from "next/font/google";
import { readSiteContentFromDisk } from "../lib/read-site-content";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import "./globals.css";

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
  title: "Maroma - Hero Preview",
  description: "Maroma-inspired hero with carousel and cycling phrases."
};

import { CartProvider } from "../context/CartContext";
import { CartDrawer } from "./components/cart/CartDrawer";

import Script from "next/script";

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const initialSiteContent = await readSiteContentFromDisk();
  const initialNav = { brand: initialSiteContent.brand, nav: initialSiteContent.nav };

  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${raleway.variable} ${josefin.variable}`}>
      <body className="antialiased">
        <Script src="https://elfsightcdn.com/platform.js" strategy="afterInteractive" />
        <CartProvider>
          <SiteHeader initialNav={initialNav} />
          {children}
          <CartDrawer />
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
