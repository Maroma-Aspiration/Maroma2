import CheckoutClient from "./checkout-client";
import { buildPageMetadata } from "../../lib/site-seo";

export const metadata = buildPageMetadata({
  title: "Checkout · Maroma",
  description: "Secure checkout for your Maroma ritual products.",
  path: "/checkout",
  noIndex: true,
});

export default function CheckoutPage() {
  return <CheckoutClient />;
}
