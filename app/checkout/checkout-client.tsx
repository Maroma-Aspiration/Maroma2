"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "../../context/CartContext";
import { useCurrency } from "../../context/CurrencyContext";
import { decodeBasicHtmlEntities } from "../../lib/decode-html-entities";
import {
  loadCheckoutShippingDraft,
  saveCheckoutShippingDraft,
  type CheckoutShippingDraft,
} from "../../lib/checkout-shipping-storage";
import {
  isValidIndianPincode,
  normalizeIndianPincode,
  pincodeValidationMessage,
} from "../../lib/indian-pincode";

type PlacedOrder = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
};

const DEFAULT_FORM: CheckoutShippingDraft = {
  email: "",
  phone: "",
  firstName: "",
  lastName: "",
  address: "",
  city: "",
  pincode: "",
  state: "",
  country: "India",
  notifications: { email: true, whatsapp: true },
};

const COUNTRY_OPTIONS = [
  "India",
  "United Kingdom",
  "United States",
  "United Arab Emirates",
  "Singapore",
  "Australia",
  "Canada",
  "Germany",
  "France",
  "Other",
] as const;

export default function CheckoutClient() {
  const { cart, subtotal, discount, discountAmount, shipping, total, formatItemPrice } = useCart();
  const { currency, isEstimated } = useCurrency();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<CheckoutShippingDraft>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [pincodeLookupStatus, setPincodeLookupStatus] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const saved = loadCheckoutShippingDraft();
    if (saved) {
      setFormData((prev) => ({
        ...prev,
        ...saved,
        country: saved.country?.trim() || "India",
        notifications: saved.notifications ?? prev.notifications,
      }));
    }
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveCheckoutShippingDraft(formData);
  }, [formData]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (formData.country.trim().toLowerCase() !== "india") {
      setPincodeLookupStatus(null);
      return;
    }

    const pincode = normalizeIndianPincode(formData.pincode);
    if (!isValidIndianPincode(pincode)) {
      setPincodeLookupStatus(null);
      return;
    }

    let cancelled = false;
    setPincodeLookupStatus("Looking up state…");

    void (async () => {
      try {
        const res = await fetch(`/api/pincode?pincode=${encodeURIComponent(pincode)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          state?: string;
          city?: string;
          error?: string;
        };
        if (cancelled) return;

        if (!res.ok || !data.state) {
          setPincodeLookupStatus(data.error || "Could not detect state for this pincode.");
          return;
        }

        setFormData((prev) => ({
          ...prev,
          state: data.state ?? prev.state,
          city: prev.city.trim() ? prev.city : data.city?.trim() || prev.city,
        }));
        setPincodeLookupStatus(null);
      } catch {
        if (!cancelled) {
          setPincodeLookupStatus("Could not detect state for this pincode.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formData.pincode, formData.country]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "pincode" ? normalizeIndianPincode(value) : value,
    }));
  };

  const toggleNotification = (type: "email" | "whatsapp") => {
    setFormData((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [type]: !prev.notifications[type] },
    }));
  };

  const validateStep1 = (): string | null => {
    if (!formData.email.trim()) return "Email is required.";
    if (!formData.phone.trim()) return "Phone number is required.";
    if (!formData.firstName.trim()) return "First name is required.";
    if (!formData.lastName.trim()) return "Last name is required.";
    if (!formData.address.trim()) return "Shipping address is required.";
    if (!formData.city.trim()) return "City is required.";
    if (!formData.country.trim()) return "Country is required.";
    if (formData.country.trim().toLowerCase() === "india") {
      const pincodeError = pincodeValidationMessage(formData.pincode);
      if (pincodeError) return pincodeError;
    } else if (!formData.pincode.trim()) {
      return "Postal code is required.";
    }
    return null;
  };

  const handleContinue = () => {
    const validationError = validateStep1();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep(2);
  };

  const handlePlaceOrder = async () => {
    if (submitting) return;
    const validationError = validateStep1();
    if (validationError) {
      setError(validationError);
      setStep(1);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          shipping: {
            ...formData,
            pincode: normalizeIndianPincode(formData.pincode),
          },
          notifications: formData.notifications,
          displayCurrency: currency,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        order?: PlacedOrder;
        error?: string;
      };
      if (!res.ok || !data.order) {
        throw new Error(data.error || "Could not place your order.");
      }
      setPlacedOrder(data.order);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place your order.");
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.length === 0 && step !== 3) {
    return (
      <main
        className="maroma-commerce-page maroma-basket-page"
        data-review="Checkout empty basket"
        data-review-id="checkout-empty"
        data-review-files="app/checkout/checkout-client.tsx"
      >
        <div className="maroma-commerce-shell">
          <section className="maroma-basket-empty">
            <div className="maroma-basket-empty-card">
              <span className="maroma-basket-empty-icon" aria-hidden="true">
                ✧
              </span>
              <h2>Your basket is empty</h2>
              <p>Add a few ritual favourites before checkout. We will keep them here for you.</p>
              <div className="maroma-basket-empty-actions">
                <Link href="/?skipIntro=1#shop" className="maroma-btn maroma-btn-primary">
                  Shop the collection
                </Link>
                <Link href="/cart" className="maroma-btn maroma-btn-ghost">
                  View basket
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main
      className="maroma-commerce-page"
      data-review="Checkout"
      data-review-id="checkout-page"
      data-review-files="app/checkout/checkout-client.tsx"
    >
      <div className={`maroma-commerce-shell${step === 3 ? " maroma-checkout-confirm" : ""}`}>
        {step !== 3 ? (
          <Link href="/cart" className="maroma-checkout-back-link">
            ← Back to basket
          </Link>
        ) : null}

        {step !== 3 ? (
          <header className="maroma-commerce-hero">
            <span className="maroma-commerce-eyebrow">Secure checkout</span>
            <h1 className="maroma-commerce-title">Complete your order</h1>
            <p className="maroma-commerce-lede">A calm, one-page checkout, crafted for guests and returning ritual lovers alike.</p>
          </header>
        ) : null}

        {error ? <p className="maroma-commerce-error" role="alert">{error}</p> : null}

        <div className="maroma-checkout-steps" aria-label="Checkout progress">
          <div className={`maroma-checkout-step-pill${step === 1 ? " is-active" : step > 1 ? " is-done" : ""}`}>
            <span className="maroma-checkout-step-num">1</span>
            Details
          </div>
          <div className={`maroma-checkout-step-pill${step === 2 ? " is-active" : step > 2 ? " is-done" : ""}`}>
            <span className="maroma-checkout-step-num">2</span>
            Review
          </div>
          <div className={`maroma-checkout-step-pill${step === 3 ? " is-active" : ""}`}>
            <span className="maroma-checkout-step-num">3</span>
            Confirmation
          </div>
        </div>

        <div className="maroma-commerce-grid">
          <div className="maroma-checkout-main">
            {step === 1 && (
              <section className="maroma-checkout-panel">
                <div className="maroma-checkout-panel-head">
                  <h2 className="maroma-checkout-panel-title">Contact &amp; shipping</h2>
                  <span className="maroma-checkout-badge">Guest checkout</span>
                </div>

                <div className="maroma-form-grid">
                  <div className="maroma-form-field full">
                    <label htmlFor="checkout-email">Email address</label>
                    <input
                      id="checkout-email"
                      type="email"
                      name="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div className="maroma-form-checks">
                    <label className="maroma-form-check">
                      <input type="checkbox" checked={formData.notifications.email} onChange={() => toggleNotification("email")} />
                      Order updates by email
                    </label>
                    <label className="maroma-form-check">
                      <input type="checkbox" checked={formData.notifications.whatsapp} onChange={() => toggleNotification("whatsapp")} />
                      Order updates on WhatsApp
                    </label>
                  </div>

                  <div className="maroma-form-field">
                    <label htmlFor="checkout-first">First name</label>
                    <input id="checkout-first" type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} autoComplete="given-name" required />
                  </div>
                  <div className="maroma-form-field">
                    <label htmlFor="checkout-last">Last name</label>
                    <input id="checkout-last" type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} autoComplete="family-name" required />
                  </div>
                  <div className="maroma-form-field full">
                    <label htmlFor="checkout-phone">Phone number</label>
                    <input id="checkout-phone" type="tel" name="phone" placeholder="+91" value={formData.phone} onChange={handleInputChange} autoComplete="tel" required />
                  </div>
                  <div className="maroma-form-field full">
                    <label htmlFor="checkout-address">Shipping address</label>
                    <input id="checkout-address" type="text" name="address" placeholder="Flat, floor, street" value={formData.address} onChange={handleInputChange} autoComplete="street-address" required />
                  </div>
                  <div className="maroma-form-field full">
                    <label htmlFor="checkout-country">Country</label>
                    <select
                      id="checkout-country"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      autoComplete="country-name"
                      required
                    >
                      {COUNTRY_OPTIONS.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="maroma-form-field">
                    <label htmlFor="checkout-pincode">
                      {formData.country.trim().toLowerCase() === "india" ? "Pincode" : "Postal code"}
                    </label>
                    <input
                      id="checkout-pincode"
                      type="text"
                      name="pincode"
                      placeholder={formData.country.trim().toLowerCase() === "india" ? "6 digits" : "Postal code"}
                      value={formData.pincode}
                      onChange={handleInputChange}
                      autoComplete="postal-code"
                      inputMode={formData.country.trim().toLowerCase() === "india" ? "numeric" : "text"}
                      pattern={formData.country.trim().toLowerCase() === "india" ? "[0-9]{6}" : undefined}
                      maxLength={formData.country.trim().toLowerCase() === "india" ? 6 : undefined}
                      required
                    />
                  </div>
                  <div className="maroma-form-field">
                    <label htmlFor="checkout-city">City</label>
                    <input id="checkout-city" type="text" name="city" value={formData.city} onChange={handleInputChange} autoComplete="address-level2" required />
                  </div>
                  <div className="maroma-form-field full">
                    <label htmlFor="checkout-state">State / region</label>
                    <input id="checkout-state" type="text" name="state" value={formData.state} onChange={handleInputChange} autoComplete="address-level1" />
                    {pincodeLookupStatus ? (
                      <p className="maroma-form-hint" role="status">
                        {pincodeLookupStatus}
                      </p>
                    ) : null}
                  </div>
                </div>

                <button type="button" className="maroma-btn maroma-btn-primary maroma-btn-block" onClick={handleContinue}>
                  Continue to review
                </button>
              </section>
            )}

            {step === 2 && (
              <section className="maroma-checkout-panel">
                <div className="maroma-checkout-panel-head">
                  <h2 className="maroma-checkout-panel-title">Review &amp; place order</h2>
                </div>

                <div className="maroma-checkout-review">
                  <p>
                    <strong>Shipping to</strong>
                    <br />
                    {formData.firstName} {formData.lastName}
                    <br />
                    {formData.address}, {formData.city}
                    {formData.state ? `, ${formData.state}` : ""} {formData.pincode}
                    <br />
                    {formData.country}
                    <br />
                    {formData.email} · {formData.phone}
                  </p>
                </div>

                <div className="maroma-payment-options">
                  <div className="maroma-payment-option is-active">
                    <div className="maroma-payment-option-head">
                      <input type="radio" checked readOnly aria-label="UPI" />
                      <span>Secure online payment</span>
                      <span className="maroma-payment-badge">Next step</span>
                    </div>
                    <p className="maroma-payment-copy">
                      CCAvenue payment will be enabled when the merchant credentials and approved currencies are connected. You will not be charged until then.
                    </p>
                  </div>
                </div>

                <div className="maroma-checkout-trust">
                  <div className="maroma-checkout-trust-item">
                    <span aria-hidden="true">🔒</span>
                    <span>256-bit SSL encrypted checkout</span>
                  </div>
                  <div className="maroma-checkout-trust-item">
                    <span aria-hidden="true">🚚</span>
                    <span>Delivery in 3–5 business days across India</span>
                  </div>
                </div>

                <div className="maroma-checkout-actions">
                  <button type="button" className="maroma-btn maroma-btn-secondary" onClick={() => setStep(1)}>
                    Back
                  </button>
                  <button
                    type="button"
                    className="maroma-btn maroma-btn-primary"
                    disabled={submitting}
                    onClick={() => {
                      void handlePlaceOrder();
                    }}
                  >
                    {submitting ? "Placing order…" : `Place order · ${formatItemPrice(total)}`}
                  </button>
                </div>
              </section>
            )}

            {step === 3 && placedOrder && (
              <section className="maroma-checkout-panel maroma-checkout-success">
                <div className="maroma-checkout-success-icon" aria-hidden="true">
                  ✓
                </div>
                <h2 className="maroma-checkout-success-title">Order received</h2>
                <p className="maroma-checkout-success-copy">
                  We have saved your order. A confirmation email will be sent once payment is completed.
                  {formData.notifications.email ? ` Updates will go to ${formData.email}.` : ""}
                </p>
                <div className="maroma-checkout-success-details">
                  <div className="maroma-checkout-success-row">
                    <span>Order number</span>
                    <span>{placedOrder.orderNumber}</span>
                  </div>
                  <div className="maroma-checkout-success-row">
                    <span>Status</span>
                    <span>Pending payment</span>
                  </div>
                  <div className="maroma-checkout-success-row">
                    <span>Total</span>
                    <span>{formatItemPrice(placedOrder.total)}</span>
                  </div>
                  <div className="maroma-checkout-success-row">
                    <span>Shipping to</span>
                    <span>
                      {formData.firstName} {formData.lastName}
                      {formData.city ? `, ${formData.city}` : ""}
                    </span>
                  </div>
                </div>
                <Link href="/" className="maroma-btn maroma-btn-primary">
                  Return to home
                </Link>
              </section>
            )}
          </div>

          {step !== 3 && (
            <aside className="maroma-order-summary" aria-label="Order summary">
              <h2 className="maroma-order-summary-title">Order summary</h2>
              <div className="maroma-checkout-summary-items">
                {cart.map((item) => (
                  <div key={item.id} className="maroma-checkout-summary-item">
                    <div className="maroma-checkout-summary-thumb" style={{ backgroundImage: item.image ? `url(${item.image})` : undefined }} />
                    <div>
                      <div className="maroma-checkout-summary-name">{decodeBasicHtmlEntities(item.name)}</div>
                      <div className="maroma-checkout-summary-qty">Qty {item.quantity}</div>
                    </div>
                    <span>{formatItemPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="maroma-order-summary-rows">
                {isEstimated ? (
                  <p className="maroma-currency-estimate-note">
                    Prices shown in {currency} are estimates. Your final payment currency and exchange rate will be confirmed securely by CCAvenue before payment.
                  </p>
                ) : null}
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
                  <span>Total</span>
                  <span>{formatItemPrice(total)}</span>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}
