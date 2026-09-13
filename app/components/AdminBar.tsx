import { cookies } from "next/headers";
import { isAdminUiHidden } from "../../lib/admin-ui-visible";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../lib/auth-session";
import { isReviewModeEnabled } from "../../lib/review-feedback";

export async function AdminBar() {
  if (isAdminUiHidden()) {
    return null;
  }
  const secret = getSessionSecret();
  if (!secret) return null;

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifySessionPayload(token, secret);
  if (!session || session.role !== "admin") return null;

  const links = [
    { href: "/?skipIntro=1", label: "Home" },
    { href: "/newsletter", label: "Newsletter" },
    { href: "/admin/products", label: "Products" },
    { href: "/admin/restricted-areas", label: "Regional limits" },
    { href: "/admin/gift-3d", label: "3D products" },
    { href: "/admin/site", label: "Promo" },
    { href: "/admin/mobile-promo", label: "Phone layout" },
    { href: "/admin/qr-pages", label: "QR / guides" },
    { href: "/admin/media", label: "Media" },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/users", label: "Manage users" },
    ...(isReviewModeEnabled() ? [{ href: "/review", label: "Review export" }] : []),
  ];

  return (
    <>
      <style>{`
        .admin-bar { position:fixed;top:0;left:0;right:0;z-index:9999;background:rgba(15,30,25,0.97);backdrop-filter:blur(8px);border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;height:36px;padding:0 16px;font-family:var(--font-sans,system-ui,sans-serif);font-size:12px;font-weight:500;letter-spacing:.04em; }
        .admin-bar-label { color:rgba(255,255,255,0.3);margin-right:12px;text-transform:uppercase;letter-spacing:.1em;font-size:10px; }
        .admin-bar a { color:rgba(255,255,255,0.65);text-decoration:none;padding:0 12px;height:100%;display:flex;align-items:center;border-right:1px solid rgba(255,255,255,0.06);transition:color .15s,background .15s; }
        .admin-bar a:hover { color:#fff;background:rgba(255,255,255,0.07); }
        .admin-bar-b2b { position:relative;height:100%;display:flex;align-items:center;border-right:1px solid rgba(255,255,255,0.06); }
        .admin-bar-b2b summary { color:rgba(255,255,255,.65);padding:0 12px;height:100%;display:flex;align-items:center;cursor:pointer;list-style:none; }
        .admin-bar-b2b summary::-webkit-details-marker { display:none; }
        .admin-bar-b2b[open] summary { color:#fff;background:rgba(255,255,255,.07); }
        .admin-bar-b2b-menu { position:absolute;top:36px;left:0;min-width:180px;background:#10251f;border:1px solid rgba(255,255,255,.12);box-shadow:0 12px 24px rgba(0,0,0,.22); }
        .admin-bar .admin-bar-b2b-menu a { height:auto;padding:10px 12px;border-right:0;border-bottom:1px solid rgba(255,255,255,.06); }
        .admin-bar-spacer { flex:1; }
        .admin-bar-email { color:rgba(255,255,255,0.3);font-size:11px; }
        .admin-bar-signout { color:rgba(255,255,255,0.35)!important;font-size:11px;margin-left:16px;border-right:none!important; }
        .admin-bar-signout:hover { color:rgba(255,255,255,0.75)!important;background:transparent!important; }
      `}</style>
      <div className="admin-bar">
        <span className="admin-bar-label">Admin</span>
        {links.map(({ href, label }) => (
          <a key={href} href={href}>{label}</a>
        ))}
        <details className="admin-bar-b2b">
          <summary>B2B</summary>
          <div className="admin-bar-b2b-menu">
            <a href="/b2b">B2B partnerships</a>
            <a href="/admin/b2b">B2B applications</a>
          </div>
        </details>
        <span className="admin-bar-spacer" />
        <span className="admin-bar-email">{session.email}</span>
        <a href="/api/auth/logout" className="admin-bar-signout">Sign out</a>
      </div>
    </>
  );
}
