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
import { ReviewFeedbackShell } from "./components/review-feedback/review-feedback-shell";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { SlowNetworkAlert } from "./components/SlowNetworkAlert";
import { ViewportRootSync } from "./components/ViewportRootSync";
import { ShopHashScroll } from "./components/ShopHashScroll";
import "./nav-critical.css";
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
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${raleway.variable} ${josefin.variable}${initialViewportIsMobile ? " maroma-viewport-mobile" : ""}`}
      {...(initialViewportIsMobile ? { "data-maroma-viewport-mobile": "" } : {})}
    >
      <head>
        <link rel="preload" as="image" href="/nav-maroma-logo.png" />
        <link rel="preload" as="image" href="/nav-maroma-experiences.png" />
        <link rel="preload" as="image" href="/nav-spa-logo.png" />
      </head>
      <body className="antialiased">
        <style
          dangerouslySetInnerHTML={{
            __html: `.site-header .nav.nav-overlay,.site-header .nav.nav-overlay::before,.site-header .nav-end{background:transparent!important}.hero{--hero-nav-lift:calc(88px + var(--admin-bar-height,0px) + var(--nav-bottom-gap,2mm))}.hero-artboard{margin-top:calc(-1 * var(--hero-nav-lift));padding-top:var(--hero-nav-lift)}.site-header .brand-logo{width:160px!important;height:22px!important;max-height:22px!important;object-fit:contain}@media(max-width:800px){.site-header .brand-logo{width:75px!important;height:auto!important;max-height:none!important}}.site-header .nav-experiences-link img,.site-header .nav-experiences-logo{width:132px!important;height:25px!important;max-width:132px!important;object-fit:contain}.site-header .spa-cta-wrap .spa-book-logo{width:86px!important;height:36px!important;max-height:36px!important;object-fit:contain}.site-header .maroma-nav-shell--desktop .brand{margin-right:10px;flex-shrink:0}.site-header .maroma-nav-shell--desktop .nav-end{flex-shrink:0}`,
          }}
        />
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
        <Script
          id="maroma-homepage-intro-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=location.pathname;if(p!=="/"&&p!=="")return;if(location.hash==="#shop")return;var q=location.search;if(q.indexOf("skipIntro=1")>=0||q.indexOf("promoPreview=1")>=0||/[?&]q=/.test(q))return;var seen=false;try{seen=localStorage.getItem("maroma-hero-intro-seen")==="1";}catch(e){}if(seen){document.documentElement.classList.add("homepage-intro-experience","homepage-intro-seen");return;}document.documentElement.classList.add("homepage-intro-experience","homepage-intro-active");}catch(e){}})();`,
          }}
        />
        <ViewportRootSync />
        <ShopHashScroll />
        <Script src="https://elfsightcdn.com/platform.js" strategy="afterInteractive" />
        <ReviewFeedbackShell>
        <AdminBar />
        <SlowNetworkAlert />
        <CurrencyProvider>
          <CartProvider>
            <SiteHeader initialNav={initialNav} initialViewportIsMobile={initialViewportIsMobile} />
            {children}
            <SiteFooter />
          </CartProvider>
        </CurrencyProvider>
        </ReviewFeedbackShell>
      </body>
    </html>
  );
}
