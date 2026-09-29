import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./marketing-lookbook.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-marketing-sans",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Marketing lookbook | Maroma admin",
  description:
    "Internal lookbook for Maroma’s archetypal customer: a thoughtful urban woman who wants beauty, pleasure and responsible choices to belong together.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/admin/marketing" },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`marketing-lookbook ${outfit.variable}`}>{children}</div>;
}
