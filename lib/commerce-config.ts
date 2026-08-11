export const CART_COOKIE = "maroma_cart_id";
export const CART_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

/** Free shipping at/above this INR subtotal (after discount). */
export const FREE_SHIPPING_THRESHOLD = 500;
/** Flat shipping in INR when below the free threshold. */
export const FLAT_SHIPPING_INR = 50;

/**
 * Default available units when no stock override exists.
 * High enough not to block browsing; admin overrides come later.
 */
export const DEFAULT_STOCK = 100;

export const MAX_LINE_QUANTITY = 99;
