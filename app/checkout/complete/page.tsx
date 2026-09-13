import Link from "next/link";
import { CheckoutPayAgain } from "./pay-again";

export const metadata = {
  title: "Payment · Maroma",
  description: "CCAvenue payment result for your Maroma order.",
};

type Props = {
  searchParams?: { order?: string; status?: string };
};

export default function CheckoutCompletePage({ searchParams }: Props) {
  const orderNumber = searchParams?.order?.trim() || "";
  const status = (searchParams?.status || "").toLowerCase();
  const success = status === "success";
  const aborted = status === "aborted";

  return (
    <main className="maroma-commerce-page">
      <div className="maroma-commerce-shell maroma-checkout-confirm">
        <section className="maroma-checkout-panel maroma-checkout-success">
          <div className="maroma-checkout-success-icon" aria-hidden="true">
            {success ? "✓" : "!"}
          </div>
          <h1 className="maroma-checkout-success-title">
            {success ? "Payment received" : aborted ? "Payment cancelled" : "Payment not completed"}
          </h1>
          <p className="maroma-checkout-success-copy">
            {success
              ? "Thank you. Your order is confirmed and a receipt will follow by email."
              : aborted
                ? "You left CCAvenue before paying. Your basket is still available if you want to try again."
                : "We could not confirm payment. No charge was completed for this attempt."}
          </p>
          {orderNumber ? (
            <div className="maroma-checkout-success-details">
              <div className="maroma-checkout-success-row">
                <span>Order number</span>
                <span>{orderNumber}</span>
              </div>
              <div className="maroma-checkout-success-row">
                <span>Status</span>
                <span>{success ? "Paid" : "Pending payment"}</span>
              </div>
            </div>
          ) : null}
          <div className="maroma-checkout-actions">
            {success ? (
              <Link href="/?skipIntro=1#shop" className="maroma-btn maroma-btn-primary">
                Continue shopping
              </Link>
            ) : (
              <>
                {orderNumber ? <CheckoutPayAgain orderNumber={orderNumber} /> : null}
                <Link href="/checkout" className="maroma-btn maroma-btn-secondary">
                  Back to checkout
                </Link>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
