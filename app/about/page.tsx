import type { Metadata } from "next";
import { AboutMaroma } from "../components/AboutMaroma";
import { JsonLd } from "../components/JsonLd";
import { breadcrumbJsonLd, buildPageMetadata } from "../../lib/site-seo";
import "./about-page.css";

export const metadata: Metadata = buildPageMetadata({
  title: "About Maroma | Crafted in Auroville since 1976",
  description:
    "The story of Maroma: botanical fragrance and care from Auroville, Fair Trade practice, and a community rooted in South India since 1976.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <main className="about-page" id="about">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
        ]}
      />
      <div
        className="about-page-wrap"
        data-review="About Maroma"
        data-review-id="about-page"
        data-review-files="app/about/page.tsx,app/components/AboutMaroma.tsx"
      >
        <AboutMaroma />
      </div>
    </main>
  );
}
