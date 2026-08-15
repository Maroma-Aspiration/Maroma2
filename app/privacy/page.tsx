import { LegalPageShell } from "../components/LegalPageShell";

export const metadata = {
  title: "Privacy Policy | Maroma",
  description: "How Maroma collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" updated="14 August 2026">
      <p>
        This Privacy Policy explains how Maroma (“we”, “us”) collects and uses information when you
        browse or shop on our website.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Account details such as email address and password (stored as a secure hash).</li>
        <li>Order and shipping details you provide at checkout (name, address, phone, email).</li>
        <li>Technical data such as browser type, device information, and approximate location derived from IP.</li>
        <li>Optional communications preferences (for example order updates or newsletter signup).</li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To process and fulfil orders, and to communicate about delivery or returns.</li>
        <li>To operate accounts, authentication, and site administration.</li>
        <li>To improve the storefront, prevent fraud, and keep the service secure.</li>
        <li>To send transactional messages; marketing emails only where you have opted in.</li>
      </ul>

      <h2>Sharing</h2>
      <p>
        We share personal data only as needed with payment, logistics, email, and hosting providers
        who help us run the shop. We do not sell your personal information.
      </p>

      <h2>Retention</h2>
      <p>
        We keep order and account records for as long as needed for fulfilment, legal, tax, and
        dispute-resolution purposes, then delete or anonymise them where practicable.
      </p>

      <h2>Your choices</h2>
      <p>
        You may request access, correction, or deletion of your account data by contacting us through
        the details on this website. You can unsubscribe from marketing emails using the link in those
        messages.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy questions, contact Maroma via the channels listed on our site or your order
        confirmation email.
      </p>
    </LegalPageShell>
  );
}
