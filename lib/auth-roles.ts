import type { UserRole } from "./auth-types";

export const USER_ROLES: UserRole[] = ["admin", "production", "newsletter", "user"];

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "production" || value === "newsletter" || value === "user";
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

/** Full site admin or newsletter-only editor. */
export function canEditNewsletter(role: string | null | undefined): boolean {
  return role === "admin" || role === "newsletter";
}

export function roleDisplayLabel(role: UserRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "production":
      return "Production";
    case "newsletter":
      return "Newsletter";
    default:
      return "Read-only";
  }
}

/**
 * APIs and pages a newsletter editor may use (in addition to public routes).
 * Full /admin hub stays admin-only.
 */
export function isNewsletterEditorPath(pathname: string): boolean {
  if (pathname.startsWith("/api/stories")) return true;
  if (pathname.startsWith("/api/newsletter/audience")) return true;
  if (pathname.startsWith("/api/newsletter/send")) return true;
  if (pathname.startsWith("/api/newsletter/email-html")) return true;
  if (pathname.startsWith("/api/newsletter/previous-issue")) return true;
  if (pathname.startsWith("/api/newsletter/restore-archive")) return true;
  if (pathname === "/api/upload-canvas-image") return true;
  if (pathname === "/api/blob-store-status") return true;
  if (pathname === "/api/admin/migrate-canvas-to-firebase") return true;
  if (pathname === "/api/admin/rehydrate-canvas-images") return true;
  if (pathname === "/newsletter/email-preview") return true;
  return false;
}
