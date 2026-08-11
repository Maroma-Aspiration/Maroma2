import { cookies } from "next/headers";
import { isAdminUiHidden } from "../../lib/admin-ui-visible";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../lib/auth-session";

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
    { href: "/", label: "Home" },
    { href: "/admin", label: "Site editor" },
    { href: "/newsletter?edit=1", label: "Newsletter" },
    { href: "/admin/products", label: "Products" },
    { href: "/admin/users", label: "Manage users" },
  ];

  return (
    <>
      <style>{`
        .admin-bar { position:fixed;top:0;left:0;right:0;z-index:9999;background:rgba(15,30,25,0.97);backdrop-filter:blur(8px);border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;height:36px;padding:0 16px;font-family:var(--font-sans,system-ui,sans-serif);font-size:12px;font-weight:500;letter-spacing:.04em; }
        .admin-bar-label { color:rgba(255,255,255,0.3);margin-right:12px;text-transform:uppercase;letter-spacing:.1em;font-size:10px; }
        .admin-bar a { color:rgba(255,255,255,0.65);text-decoration:none;padding:0 12px;height:100%;display:flex;align-items:center;border-right:1px solid rgba(255,255,255,0.06);transition:color .15s,background .15s; }
        .admin-bar a:hover { color:#fff;background:rgba(255,255,255,0.07); }
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
        <span className="admin-bar-spacer" />
        <span className="admin-bar-email">{session.email}</span>
        <a href="/api/auth/logout" className="admin-bar-signout">Sign out</a>
      </div>
    </>
  );
}
