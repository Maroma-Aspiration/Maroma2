import type { Metadata } from "next";
import { headers } from "next/headers";
import { Montserrat } from "next/font/google";
import { Cormorant_Garamond } from "next/font/google";
import { Raleway } from "next/font/google";
import { Josefin_Sans } from "next/font/google";
import Script from "next/script";
import { readSiteContentFromDisk } from "../lib/read-site-content";
import { isMaromaMobileUserAgent } from "../lib/mobile-viewport";
import {
  buildPageMetadata,
  organizationJsonLd,
  websiteJsonLd,
} from "../lib/site-seo";
import { CartProvider } from "../context/CartContext";
import { CurrencyProvider } from "../context/CurrencyContext";
import { AdminBar } from "./components/AdminBar";
import { JsonLd } from "./components/JsonLd";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { SlowNetworkAlert } from "./components/SlowNetworkAlert";
import { ViewportRootSync } from "./components/ViewportRootSync";
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

export const metadata: Metadata = buildPageMetadata({
  title: "Maroma | Natural fragrance & botanical care from Auroville",
  description:
    "Maroma makes botanical skincare, natural perfume oils, incense, handmade candles, and home rituals in Auroville, India. Shop face care, body care, hair care, and gifting.",
  path: "/",
  image: "/maroma-logo.png",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
} as const;

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
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <Script
          id="maroma-force-device-viewport"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){var m=document.querySelector('meta[name="viewport"]');if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}m.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';})();`,
          }}
        />
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
        <SlowNetworkAlert />
        <CurrencyProvider>
          <CartProvider>
            <SiteHeader initialNav={initialNav} initialViewportIsMobile={initialViewportIsMobile} />
            {children}
            <SiteFooter />
          </CartProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}
