import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "../components/JsonLd";
import { breadcrumbJsonLd, buildPageMetadata } from "../../lib/site-seo";
import { CareersApplyForm } from "./CareersApplyForm";
import "./careers-page.css";

export const metadata: Metadata = buildPageMetadata({
  title: "Careers | Maroma",
  description:
    "Work and intern with Maroma in Auroville. Internship opportunities in production, fragrance, design, and community enterprise, plus how to apply.",
  path: "/careers",
});

export default function CareersPage() {
  return (
    <main className="careers-page">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Careers", path: "/careers" },
          ]),
        ]}
      />
      <div className="careers-wrap">
        <p className="careers-kicker">Join the atelier</p>
        <h1>Careers at Maroma</h1>
        <p className="careers-lead">
          Maroma is a Fair Trade workshop in Auroville making botanical care, perfume, incense, and home rituals.
          We welcome people who want to learn the craft, work with their hands, and help a community enterprise grow.
        </p>

        <section className="careers-section" aria-labelledby="internships-heading">
          <h2 id="internships-heading">Internship Opportunities</h2>
          <p>
            Internships usually run for one to three months. You work alongside the team, learn the process, and
            leave with a clear sense of how a handmade fragrance house operates.
          </p>
          <ul className="careers-list">
            <li>
              <strong>Production and packing.</strong> Learn batching, filling, labelling, and quality checks on the
              workshop floor.
            </li>
            <li>
              <strong>Fragrance and product development.</strong> Support scent trials, ingredient notes, and sample
              preparation.
            </li>
            <li>
              <strong>Design and storytelling.</strong> Help with photography, pack copy, and visual presentation.
            </li>
            <li>
              <strong>Retail and hospitality.</strong> Meet guests, keep the shop welcoming, and learn the product range.
            </li>
            <li>
              <strong>Digital and commerce.</strong> Assist with the online shop, content, and customer care.
            </li>
          </ul>
        </section>

        <section className="careers-section" aria-labelledby="apply-heading">
          <h2 id="apply-heading">How to apply</h2>
          <p>
            Use the form below. We review applications as places open. A reply may take two to three weeks. You can
            also write to <a href="mailto:maroma@maroma.com">maroma@maroma.com</a> or call{" "}
            <a href="tel:+914132622126">+91 413 262 2126</a>.
          </p>
          <CareersApplyForm />
          <p className="careers-address">
            Maroma
            <br />
            Aspiration Road
            <br />
            Auroville, Tamil Nadu 605101, India
          </p>
          <p>
            <Link href="/about">Read the Maroma story</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
