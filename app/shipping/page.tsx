import { FREE_SHIPPING_THRESHOLD, FLAT_SHIPPING_INR } from "../../lib/commerce-config";
import { LegalPageShell } from "../components/LegalPageShell";
import { buildPageMetadata } from "../../lib/site-seo";

export const metadata = buildPageMetadata({
  title: "Shipping Policy | Maroma",
  description: "Shipping rates, delivery expectations, and order dispatch for Maroma.",
  path: "/shipping",
});

export default function ShippingPage() {
  return (
    <LegalPageShell title="Shipping Policy" updated="14 August 2026">
      <p>
        This page explains how Maroma ships orders within India and what to expect after you place an
        order.
      </p>

      <h2>Delivery areas</h2>
      <p>
        We currently fulfil online orders for delivery addresses in India. Some products may be marked
        as India-only on the product page; availability can vary by item.
      </p>

      <h2>Shipping charges</h2>
      <ul>
        <li>
          Standard shipping is ₹{FLAT_SHIPPING_INR} for orders below ₹{FREE_SHIPPING_THRESHOLD} (after
          discounts).
        </li>
        <li>
          Orders of ₹{FREE_SHIPPING_THRESHOLD} or more (after discounts) qualify for free shipping
          within India.
        </li>
      </ul>

      <h2>Dispatch and delivery</h2>
      <p>
        Orders are prepared after payment is confirmed. Delivery timing depends on destination,
        courier capacity, and product readiness (including gift packing where selected). You will
        receive updates by email when tracking is available.
      </p>

      <h2>Address accuracy</h2>
      <p>
        Please ensure your shipping name, phone, address, and PIN code are correct at checkout.
        Delays or failed deliveries caused by incomplete or incorrect addresses may require
        re-shipment at additional cost.
      </p>

      <h2>Questions</h2>
      <p>
        For shipping questions about an existing order, reply to your order confirmation email or
        contact Maroma through the channels listed on our site.
      </p>
    </LegalPageShell>
  );
}
