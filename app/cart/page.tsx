import CartClient from "./cart-client";

export const metadata = {
  title: "Your Basket · Maroma",
  description: "Review your Maroma ritual products before checkout."
};

export default function CartPage() {
  return <CartClient />;
}
