import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "./lib/auth-session";
import type { SessionPayload } from "./lib/auth-session";

function authFullyConfigured(): boolean {
  return Boolean(getSessionSecret());
}

function requiresAdmin(pathname: string, method: string): boolean {
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
  if (pathname.startsWith("/api/products/upload")) {
    return true;
  }
  if (pathname.startsWith("/api/auth/users")) {
    return true;
  }
  if (pathname.startsWith("/api/category-banners/upload")) {
    return true;
  }
  if (pathname === "/api/category-banners" && method !== "GET") {
    return true;
  }
  if (pathname === "/api/site-content" && method !== "GET") {
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
        // Homepage Login links use next=/ — send admins to the editor instead of bouncing home.
        url.pathname = safeNext && safeNext !== "/" ? safeNext : "/admin";
        url.search = "";
        return NextResponse.redirect(url);
      }
      const url = request.nextUrl.clone();
      url.pathname = safeNext && safeNext !== "/" ? safeNext : "/account";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/account")) {
    if (!session) {
      return redirectToLogin(request, pathname, "sign_in_required");
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

  if (session.role !== "admin") {
    if (api) {
      return NextResponse.json({ error: "Forbidden", reason: "admin_role_required" }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/account";
    url.searchParams.set("reason", "admin_only");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/account",
    "/login",
    "/signup",
    "/forgot-password",
    "/api/stories",
    "/api/stories/:path*",
    "/api/newsletter/:path*",
    "/api/site-content",
    "/api/hero-media-layout",
    "/api/category-banners",
    "/api/category-banners/upload",
    "/api/products/upload",
    "/api/auth/:path*",
    "/api/admin/:path*"
  ]
};
