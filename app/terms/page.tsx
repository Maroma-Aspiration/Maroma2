import { LegalPageShell } from "../components/LegalPageShell";

export const metadata = {
  title: "Terms of Service | Maroma",
  description: "Terms that apply when you use the Maroma website and place orders.",
};

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service" updated="14 August 2026">
      <p>
        By using this website or placing an order with Maroma, you agree to these Terms of Service.
        If you do not agree, please do not use the site.
      </p>

      <h2>The shop</h2>
      <p>
        Product descriptions, pricing (in INR unless stated otherwise), and availability may change
        without notice. We reserve the right to refuse or cancel orders that appear fraudulent,
        erroneous, or unfulfillable.
      </p>

      <h2>Orders and payment</h2>
      <p>
        An order is an offer to buy. A contract is formed when we accept the order and payment is
        successfully completed through our payment provider. Until payment succeeds, orders may remain
        pending and stock is not guaranteed.
      </p>

      <h2>Accounts</h2>
      <p>
        You are responsible for keeping your login credentials confidential and for activity under
        your account. Public self-registration creates a customer account only; staff access is
        granted separately by Maroma administrators.
      </p>

      <h2>Use of the site</h2>
      <p>
        You may not misuse the site, attempt unauthorised access, scrape content at scale, or
        interfere with our systems. Content on this site is owned by Maroma or its licensors and may
        not be reused for commercial purposes without permission.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by applicable law, Maroma is not liable for indirect or
        consequential losses arising from use of the site or purchase of products, except where
        liability cannot be excluded (including for death or personal injury caused by negligence, or
        fraud).
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India. Courts in India have exclusive jurisdiction,
        subject to any mandatory consumer protections that apply where you live.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms from time to time. Continued use of the site after changes means
        you accept the updated terms.
      </p>
    </LegalPageShell>
  );
}
