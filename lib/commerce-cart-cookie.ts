import { cookies } from "next/headers";
import { CART_COOKIE, CART_COOKIE_MAX_AGE_SEC } from "./commerce-config";

export function readCartIdFromCookies(): string | null {
  const value = cookies().get(CART_COOKIE)?.value;
  return value && value.trim() ? value.trim() : null;
}

export function setCartIdCookie(cartId: string) {
  cookies().set(CART_COOKIE, cartId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE_SEC,
  });
}

export function clearCartIdCookie() {
  cookies().set(CART_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
