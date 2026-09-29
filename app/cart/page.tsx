import CartClient from "./cart-client";
import { buildPageMetadata } from "../../lib/site-seo";

export const metadata = buildPageMetadata({
  title: "Your Basket · Maroma",
  description: "Review your Maroma ritual products before checkout.",
  path: "/cart",
  noIndex: true,
});

export default function CartPage() {
  return <CartClient />;
}
