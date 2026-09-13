"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useCurrency } from "./CurrencyContext";
import type { CartItemView, CartView } from "../lib/commerce-types";
import type { ProductRecord } from "../lib/product-types";

export type CartItem = CartItemView;

type CartContextType = {
  cart: CartItem[];
  cartId: string | null;
  couponCode: string | null;
  promoAvailable: boolean;
  loading: boolean;
  error: string | null;
  addToCart: (product: ProductRecord | { id: string }, variant?: string, quantity?: number) => Promise<boolean>;
  removeFromCart: (id: string) => Promise<void>;
  updateQuantity: (id: string, delta: number) => Promise<void>;
  clearCart: () => Promise<void>;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => Promise<void>;
  refreshCart: () => Promise<void>;
  totalItems: number;
  subtotal: number;
  discount: number;
  discountAmount: number;
  shipping: number;
  total: number;
  /** @deprecated Discount is server-controlled (e.g. ritual sets). Kept as no-op for callers. */
  setDiscount: (amount: number) => void;
  formatItemPrice: (price: number) => string;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

function applyCartView(
  view: CartView,
  setState: {
    setCart: (items: CartItemView[]) => void;
    setCartId: (id: string | null) => void;
    setCouponCode: (code: string | null) => void;
    setPromoAvailable: (value: boolean) => void;
    setSubtotal: (n: number) => void;
    setDiscount: (n: number) => void;
    setDiscountAmount: (n: number) => void;
    setShipping: (n: number) => void;
    setTotal: (n: number) => void;
    setTotalItems: (n: number) => void;
  }
) {
  setState.setCart(view.items);
  setState.setCartId(view.id);
  setState.setCouponCode(view.couponCode ?? null);
  setState.setPromoAvailable(view.promoAvailable === true);
  setState.setSubtotal(view.subtotal);
  setState.setDiscount(view.discountRate);
  setState.setDiscountAmount(view.discountAmount);
  setState.setShipping(view.shipping);
  setState.setTotal(view.total);
  setState.setTotalItems(view.totalItems);
}

async function postCart(body: Record<string, unknown>): Promise<CartView> {
  const res = await fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { cart?: CartView; error?: string };
  if (!res.ok || !data.cart) {
    throw new Error(data.error || "Cart request failed.");
  }
  return data.cart;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { formatMoney } = useCurrency();
  const [cart, setCart] = useState<CartItemView[]>([]);
  const [cartId, setCartId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [promoAvailable, setPromoAvailable] = useState(false);
  const [subtotal, setSubtotal] = useState(0);
  const [discount, setDiscountState] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setters = {
    setCart,
    setCartId,
    setCouponCode,
    setPromoAvailable,
    setSubtotal,
    setDiscount: setDiscountState,
    setDiscountAmount,
    setShipping,
    setTotal,
    setTotalItems,
  };

  const refreshCart = useCallback(async () => {
    try {
      const res = await fetch("/api/cart", { credentials: "same-origin", cache: "no-store" });
      const data = (await res.json()) as { cart?: CartView; error?: string };
      if (!res.ok || !data.cart) {
        throw new Error(data.error || "Failed to load cart.");
      }
      applyCartView(data.cart, setters);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load cart.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setters are stable state dispatchers
  }, []);

  useEffect(() => {
    void refreshCart();
    // Clear legacy client-only cart so old manipulated prices cannot linger.
    try {
      localStorage.removeItem("maroma-cart");
      localStorage.removeItem("maroma-discount");
    } catch {
      // ignore
    }
  }, [refreshCart]);

  const addToCart = async (
    product: ProductRecord | { id: string },
    variant?: string,
    quantity = 1
  ): Promise<boolean> => {
    try {
      const view = await postCart({
        action: "add",
        productId: product.id,
        quantity,
        variant,
      });
      applyCartView(view, setters);
      setError(null);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add to basket.";
      setError(message);
      console.error(err);
      return false;
    }
  };

  const removeFromCart = async (id: string) => {
    try {
      const view = await postCart({ action: "remove", lineId: id });
      applyCartView(view, setters);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove item.");
    }
  };

  const updateQuantity = async (id: string, delta: number) => {
    try {
      const view = await postCart({ action: "update", lineId: id, delta });
      applyCartView(view, setters);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update quantity.");
    }
  };

  const clearCart = async () => {
    try {
      const view = await postCart({ action: "clear" });
      applyCartView(view, setters);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear cart.");
    }
  };

  const applyCoupon = async (code: string): Promise<boolean> => {
    try {
      const view = await postCart({ action: "apply-coupon", code });
      applyCartView(view, setters);
      setError(null);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not apply promo code.";
      setError(message);
      return false;
    }
  };

  const removeCoupon = async () => {
    try {
      const view = await postCart({ action: "remove-coupon" });
      applyCartView(view, setters);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove promo code.");
    }
  };

  const setDiscount = (_amount: number) => {
    // Discount rates are applied server-side (e.g. when adding a ritual set).
  };

  const formatItemPrice = (price: number) => formatMoney(price);

  return (
    <CartContext.Provider
      value={{
        cart,
        cartId,
        couponCode,
        promoAvailable,
        loading,
        error,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        applyCoupon,
        removeCoupon,
        refreshCart,
        totalItems,
        subtotal,
        discount,
        discountAmount,
        shipping,
        total,
        setDiscount,
        formatItemPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
