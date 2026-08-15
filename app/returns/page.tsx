import { LegalPageShell } from "../components/LegalPageShell";

export const metadata = {
  title: "Returns & Refunds | Maroma",
  description: "How returns, exchanges, and refunds work for Maroma orders.",
};

export default function ReturnsPage() {
  return (
    <LegalPageShell title="Returns & Refunds" updated="14 August 2026">
      <p>
        We want you to be happy with your Maroma order. This policy outlines when returns and refunds
        are available.
      </p>

      <h2>Damaged or incorrect items</h2>
      <p>
        If an item arrives damaged, defective, or different from what you ordered, contact us within
        7 days of delivery with your order number and clear photos. We will arrange a replacement or
        refund as appropriate.
      </p>

      <h2>Change of mind</h2>
      <p>
        Unopened products in original packaging may be eligible for return within 7 days of delivery,
        subject to inspection. Personal-care and hygiene items that have been opened generally cannot
        be returned for hygiene reasons. Gift sets or custom packing may have additional restrictions.
      </p>

      <h2>How to start a return</h2>
      <ol>
        <li>Email us with your order number and reason for return.</li>
        <li>Wait for confirmation and return instructions before shipping anything back.</li>
        <li>Pack items securely in original packaging where possible.</li>
      </ol>

      <h2>Refunds</h2>
      <p>
        Approved refunds are issued to the original payment method after we receive and inspect the
        returned goods. Shipping charges are refunded only when the return is due to our error or a
        defective product.
      </p>

      <h2>Cancellations</h2>
      <p>
        You may request cancellation before the order is dispatched. Once shipped, please follow the
        returns process above.
      </p>
    </LegalPageShell>
  );
}
