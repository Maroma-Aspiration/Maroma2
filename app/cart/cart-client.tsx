"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "../../context/CartContext";
import { FREE_SHIPPING_THRESHOLD } from "../../lib/commerce-config";
import { decodeBasicHtmlEntities } from "../../lib/decode-html-entities";

export default function CartClient() {
  const {
    cart,
    subtotal,
    updateQuantity,
    removeFromCart,
    formatItemPrice,
    discount,
    discountAmount,
    shipping,
    total,
    couponCode,
    applyCoupon,
    removeCoupon,
    error,
  } = useCart();
  const [promoInput, setPromoInput] = useState("");
  const [promoStatus, setPromoStatus] = useState<string | null>(null);

  const remaining = Math.max(FREE_SHIPPING_THRESHOLD - (subtotal - discountAmount), 0);
  const progress = Math.min(((subtotal - discountAmount) / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const itemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const basketTitle =
    itemCount === 0 ? (
      "Your basket"
    ) : (
      <>
        Your basket has{" "}
        <span className="maroma-commerce-title-num">{itemCount}</span> item{itemCount === 1 ? "" : "s"}
      </>
    );

  return (
    <main className="maroma-commerce-page maroma-basket-page">
      <div className="maroma-commerce-shell">
        <header className="maroma-commerce-hero">
          <span className="maroma-commerce-eyebrow">Ritual Selection</span>
          <h1 className="maroma-commerce-title">{basketTitle}</h1>
        </header>

        {cart.length === 0 ? (
          <section className="maroma-basket-empty">
            <div className="maroma-basket-empty-card">
              <span className="maroma-basket-empty-icon" aria-hidden="true">
                ✧
              </span>
              <h2>Nothing here yet</h2>
              <p>Explore our face, body, and hair rituals. Each one is crafted in Auroville with care for you and the planet.</p>
              <div className="maroma-basket-empty-actions">
                <Link href="/?skipIntro=1#shop" className="maroma-btn maroma-btn-primary">
                  Shop the collection
                </Link>
                <Link href="/rituals" className="maroma-btn maroma-btn-ghost">
                  Discover rituals
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <div className="maroma-commerce-grid">
            <section className="maroma-basket-items" aria-label="Basket items">
              {subtotal > 0 && (
                <div className="maroma-shipping-progress">
                  <p className="maroma-shipping-progress-text">
                    {remaining > 0
                      ? `Add ${formatItemPrice(remaining)} more for complimentary shipping across India`
                      : "You've unlocked complimentary shipping"}
                  </p>
                  <div className="maroma-shipping-progress-track">
                    <div className="maroma-shipping-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              <ul className="maroma-basket-list">
                {cart.map((item) => (
                  <li key={item.id} className="maroma-basket-item">
                    <Link href={`/product/${item.productId}`} className="maroma-basket-item-media">
                      {item.image ? (
                        <img src={item.image} alt="" />
                      ) : (
                        <span className="maroma-basket-item-placeholder">✧</span>
                      )}
                    </Link>
                    <div className="maroma-basket-item-body">
                      <div className="maroma-basket-item-head">
                        <Link href={`/product/${item.productId}`} className="maroma-basket-item-name">
                          {decodeBasicHtmlEntities(item.name)}
                        </Link>
                        <span className="maroma-basket-item-line-total">
                          {formatItemPrice(item.price * item.quantity)}
                        </span>
                      </div>
                      {item.variant ? <span className="maroma-basket-item-variant">{item.variant}</span> : null}
                      <span className="maroma-basket-item-unit">{formatItemPrice(item.price)} each</span>
                      <div className="maroma-basket-item-actions">
                        <div className="maroma-qty-stepper" aria-label={`Quantity for ${item.name}`}>
                          <button type="button" onClick={() => updateQuantity(item.id, -1)} aria-label="Decrease quantity">
                            −
                          </button>
                          <span>{item.quantity}</span>
                          <button type="button" onClick={() => updateQuantity(item.id, 1)} aria-label="Increase quantity">
                            +
                          </button>
                        </div>
                        <button type="button" className="maroma-basket-remove" onClick={() => removeFromCart(item.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <Link href="/?skipIntro=1#shop" className="maroma-basket-continue">
                ← Continue shopping
              </Link>
            </section>

            <aside className="maroma-order-summary" aria-label="Order summary">
              <h2 className="maroma-order-summary-title">Order summary</h2>
              <div className="maroma-coupon-field">
                {couponCode ? (
                  <div className="maroma-coupon-applied">
                    <span>Promo: {couponCode}</span>
                    <button type="button" onClick={() => void removeCoupon()}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <form
                    className="maroma-coupon-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void (async () => {
                        const ok = await applyCoupon(promoInput);
                        setPromoStatus(ok ? "Promo applied." : null);
                      })();
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Promo code"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                      aria-label="Promo code"
                    />
                    <button type="submit" className="maroma-btn maroma-btn-secondary">
                      Apply
                    </button>
                  </form>
                )}
                {promoStatus || error ? <p className="maroma-coupon-note">{promoStatus || error}</p> : null}
              </div>
              <div className="maroma-order-summary-rows">
                <div className="maroma-order-row">
                  <span>Subtotal</span>
                  <span>{formatItemPrice(subtotal)}</span>
                </div>
                {discount > 0 || discountAmount > 0 ? (
                  <div className="maroma-order-row maroma-order-row-discount">
                    <span>Discount</span>
                    <span>−{formatItemPrice(Math.round(discountAmount))}</span>
                  </div>
                ) : null}
                <div className="maroma-order-row">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? <em className="maroma-order-free">Complimentary</em> : formatItemPrice(shipping)}</span>
                </div>
                <div className="maroma-order-row maroma-order-row-total">
                  <span>Estimated total</span>
                  <span>{formatItemPrice(total)}</span>
                </div>
              </div>
              <p className="maroma-order-note">Taxes included where applicable. Final total confirmed at checkout.</p>
              <Link href="/checkout" className="maroma-btn maroma-btn-primary maroma-btn-block">
                Proceed to checkout
              </Link>
              <div className="maroma-trust-strip">
                <span>Secure checkout</span>
                <span>100% vegan</span>
                <span>Fair trade</span>
                <span>Made in Auroville</span>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
