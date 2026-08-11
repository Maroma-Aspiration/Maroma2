export type CheckoutShippingDraft = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  pincode: string;
  state: string;
  country: string;
  notifications: { email: boolean; whatsapp: boolean };
};

const STORAGE_KEY = "maroma:checkout-shipping";

export function loadCheckoutShippingDraft(): Partial<CheckoutShippingDraft> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CheckoutShippingDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCheckoutShippingDraft(draft: CheckoutShippingDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore quota / private-mode errors.
  }
}
