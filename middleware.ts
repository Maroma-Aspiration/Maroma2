import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "./lib/auth-session";
import type { SessionPayload } from "./lib/auth-session";
import { isNewsletterEditorPath } from "./lib/auth-roles";

function authFullyConfigured(): boolean {
  return Boolean(getSessionSecret());
}

function isMobileRequest(request: NextRequest): boolean {
  const userAgent = request.headers.get("user-agent") ?? "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
}

function requiresAdmin(pathname: string, method: string): boolean {
  if (pathname === "/admin/install") {
    return false;
  }
  if (pathname.startsWith("/admin")) {
    return true;
  }
  if (pathname.startsWith("/api/stories")) {
    return true;
  }
  if (pathname.startsWith("/api/newsletter/audience")) {
    return true;
  }
  if (pathname.startsWith("/api/newsletter/send")) {
    return true;
  }
  if (pathname.startsWith("/api/newsletter/email-html")) {
    return true;
  }
  if (pathname.startsWith("/api/newsletter/previous-issue")) {
    return true;
  }
  if (pathname.startsWith("/api/newsletter/restore-archive")) {
    return true;
  }
  if (pathname === "/api/upload-canvas-image") {
    return true;
  }
  if (pathname === "/api/blob-store-status") {
    return true;
  }
  if (pathname === "/newsletter/email-preview") {
    return true;
  }
  if (pathname.startsWith("/api/products/upload")) {
    return true;
  }
  if (pathname.startsWith("/api/auth/users")) {
    return true;
  }
  if (pathname.startsWith("/api/category-banners/upload")) {
    return true;
  }
  if (pathname.startsWith("/api/promo-strip-background/upload")) {
    return true;
  }
  if (pathname.startsWith("/api/site-media-gallery/upload")) {
    return true;
  }
  if (pathname.startsWith("/api/public-media/")) {
    return true;
  }
  if (pathname === "/api/site-media-gallery" && method !== "GET") {
    return true;
  }
  if (pathname === "/api/category-banners" && method !== "GET") {
    return true;
  }
  if (pathname === "/api/site-content" && method !== "GET") {
    return true;
  }
  if (pathname === "/api/promos" && method !== "GET") {
    return true;
  }
  if (pathname === "/api/homepage-content" && method !== "GET") {
    return true;
  }
  if (pathname === "/api/stores" && method !== "GET") {
    return true;
  }
  if (pathname === "/api/hero-media-layout" && method !== "GET") {
    return true;
  }
  if (pathname.startsWith("/api/admin/")) {
    return true;
  }
  return false;
}

function isProductionPath(pathname: string): boolean {
  return pathname === "/admin/orders" ||
    pathname.startsWith("/admin/orders/") ||
    pathname === "/api/admin/fulfillment" ||
    pathname.startsWith("/api/admin/fulfillment/") ||
    pathname.startsWith("/api/admin/shiprocket/") ||
    pathname === "/api/auth/pwa-install";
}

function canAccessStaffPath(session: SessionPayload, pathname: string): boolean {
  if (session.role === "admin") return true;
  if (session.role === "production" && isProductionPath(pathname)) return true;
  if (session.role === "newsletter" && isNewsletterEditorPath(pathname)) return true;
  return false;
}

function isNewsletterPublicTrack(pathname: string): boolean {
  return pathname.startsWith("/api/newsletter/track/");
}

function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/session" ||
    pathname === "/api/auth/signup"
  );
}

function redirectToLogin(request: NextRequest, nextPath: string, reason?: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", nextPath);
  if (reason) {
    url.searchParams.set("reason", reason);
  }
  return NextResponse.redirect(url);
}

async function readSession(request: NextRequest): Promise<SessionPayload | null> {
  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return verifySessionPayload(token, secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  const api = pathname.startsWith("/api/");

  // Installation must always be reachable before either preview access or staff sign-in.
  if (pathname === "/admin/install") {
    return NextResponse.next();
  }

  if (pathname === "/admin" && isMobileRequest(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/orders";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isPublicAuthPath(pathname)) {
    return NextResponse.next();
  }

  if (isNewsletterPublicTrack(pathname)) {
    return NextResponse.next();
  }

  const ready = authFullyConfigured();
  const session = await readSession(request);

  if (!ready) {
    if (pathname.startsWith("/account")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("reason", "auth_not_configured");
      return NextResponse.redirect(url);
    }
    if (requiresAdmin(pathname, method)) {
      if (api) {
        return NextResponse.json(
          { error: "Authentication is not configured.", reason: "missing_session_secret_or_users" },
          { status: 503 }
        );
      }
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("reason", "auth_not_configured");
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password") {
    if (session) {
      const nextParam = request.nextUrl.searchParams.get("next");
      const safeNext =
        nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
      if (session.role === "admin") {
        const url = request.nextUrl.clone();
        // Homepage Login links use next=/ — send admins to the live homepage editor.
        if (!safeNext || safeNext === "/" || safeNext === "/admin") {
          url.pathname = "/";
          url.search = "skipIntro=1";
        } else {
          url.pathname = safeNext;
          url.search = "";
        }
        return NextResponse.redirect(url);
      }
      if (session.role === "production") {
        const url = request.nextUrl.clone();
        url.pathname = safeNext && isProductionPath(safeNext) ? safeNext : "/admin/orders";
        url.search = "";
        return NextResponse.redirect(url);
      }
      if (session.role === "newsletter") {
        const url = request.nextUrl.clone();
        url.pathname = "/newsletter";
        url.search = "edit=1";
        if (safeNext?.startsWith("/newsletter")) {
          try {
            const dest = new URL(safeNext, request.nextUrl.origin);
            url.pathname = dest.pathname;
            url.search = dest.search || "edit=1";
            if (url.pathname === "/newsletter" && !url.searchParams.get("edit")) {
              url.searchParams.set("edit", "1");
            }
          } catch {
            /* keep defaults */
          }
        }
        return NextResponse.redirect(url);
      }
      const url = request.nextUrl.clone();
      if (safeNext && safeNext !== "/") {
        const destination = new URL(safeNext, request.nextUrl.origin);
        url.pathname = destination.pathname;
        url.search = destination.search;
      } else {
        url.pathname = "/account";
        url.search = "";
      }
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/account")) {
    if (!session) {
      return redirectToLogin(request, `${pathname}${request.nextUrl.search}`, "sign_in_required");
    }
    return NextResponse.next();
  }

  if (!requiresAdmin(pathname, method)) {
    return NextResponse.next();
  }

  if (!session) {
    if (api) {
      return NextResponse.json({ error: "Unauthorized", reason: "sign_in_required" }, { status: 401 });
    }
    return redirectToLogin(request, `${pathname}${request.nextUrl.search}`, "sign_in_required");
  }

  if (!canAccessStaffPath(session, pathname)) {
    if (api) {
      return NextResponse.json({ error: "Forbidden", reason: "admin_role_required" }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = session.role === "newsletter" ? "/newsletter" : "/account";
    url.search = session.role === "newsletter" ? "edit=1" : "reason=admin_only";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Skip static files and media uploads. Large multipart bodies that pass through
  // middleware often never reach the Node upload route on Vercel.
  matcher: [
    "/((?!.*\\..*|api/category-banners/upload|api/promo-strip-background/upload|api/site-media-gallery/upload|api/products/upload|api/upload-canvas-image).*)",
  ],
};
