/** Server-priced cart line (client never supplies price). */
export type CartLine = {
  id: string;
  productId: string;
  variant?: string;
  quantity: number;
};

export type CartRecord = {
  id: string;
  lines: CartLine[];
  /** 0–1 fraction, set only by server (e.g. ritual-set promo). */
  discountRate: number;
  /** Applied promo code (server-validated). */
  couponCode?: string;
  /** Extra INR off from coupon, after ritual % discount. */
  couponDiscountAmount?: number;
  updatedAt: string;
};

export type CartItemView = {
  id: string;
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  variant?: string;
  maxQuantity: number;
};

export type CartTotals = {
  subtotal: number;
  discountRate: number;
  discountAmount: number;
  shipping: number;
  total: number;
  totalItems: number;
};

export type CartView = CartTotals & {
  id: string;
  items: CartItemView[];
  couponCode?: string;
};

export type CommerceProduct = {
  id: string;
  sku: string;
  name: string;
  price: number;
  image: string;
  active: boolean;
  stock: number;
  /** True for curated ritual bundles not in the main catalogue JSON. */
  virtual?: boolean;
};

export type StockStore = {
  /** productId → available units. Missing key uses DEFAULT_STOCK. */
  stock: Record<string, number>;
  updatedAt: string;
};

export type OrderStatus = "pending_payment" | "paid" | "fulfilled" | "cancelled";

export type OrderLineSnapshot = {
  productId: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  variant?: string;
};

export type ShippingAddress = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  pincode: string;
  state: string;
  country: string;
};

export type OrderRecord = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  cartId: string;
  customerEmail: string;
  shipping: ShippingAddress;
  lines: OrderLineSnapshot[];
  subtotal: number;
  discountRate: number;
  discountAmount: number;
  couponCode?: string;
  shippingInr: number;
  total: number;
  notifications: { email: boolean; whatsapp: boolean };
  payment?: {
    provider: "razorpay";
    orderId?: string;
    paymentId?: string;
    paidAt?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type CouponType = "percent" | "fixed";

export type CouponRecord = {
  code: string;
  type: CouponType;
  /** Percent (0–100) or fixed INR amount. */
  value: number;
  minSubtotal?: number;
  active: boolean;
  expiresAt?: string;
  createdAt: string;
};
