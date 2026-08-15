import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "../components/SignOutButton";
import { ChangePasswordForm } from "../components/ChangePasswordForm";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../lib/auth-session";
import { getB2bCompanyByUserEmail } from "../../lib/b2b-store";
import { listOrdersForEmail } from "../../lib/commerce-orders";
import { formatInrPrice } from "../../lib/format-price";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your account | Maroma",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!secret || !token) {
    redirect("/login?next=/account&reason=sign_in_required");
  }
  const session = await verifySessionPayload(token, secret);
  if (!session) {
    redirect("/login?next=/account&reason=sign_in_required");
  }

  const orders = await listOrdersForEmail(session.email, 20);
  const b2bCompany = await getB2bCompanyByUserEmail(session.email);

  const notice =
    searchParams.reason === "admin_only"
      ? "Admin tools live under /admin. Your account uses the standard user role."
      : null;

  return (
    <main className="login-page">
      <section className="login-card" style={{ maxWidth: 720, width: "100%" }}>
        <p className="login-eyebrow">Signed in</p>
        <h1 className="login-title">Account</h1>
        <p className="login-reason">
          <strong>{session.email}</strong>
          <br />
          Role: <strong>{session.role}</strong>
        </p>
        {notice ? <p className="login-reason">{notice}</p> : null}

        <ChangePasswordForm />

        {b2bCompany ? (
          <p className="login-reason" style={{ marginTop: 16 }}>
            Wholesale page:{" "}
            <Link href={`/b2b/${b2bCompany.slug}`}>
              {b2bCompany.name} (/b2b/{b2bCompany.slug})
            </Link>
          </p>
        ) : null}

        <h2 style={{ fontSize: "1.1rem", marginTop: 24, marginBottom: 12 }}>Your orders</h2>
        {orders.length === 0 ? (
          <p className="login-reason">No orders yet for this email.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {orders.map((order) => (
              <li key={order.id} style={{ borderTop: "1px solid #ddd", padding: "12px 0" }}>
                <strong>{order.orderNumber}</strong> · {order.status.replace("_", " ")}
                <br />
                <small>
                  {new Date(order.createdAt).toLocaleDateString("en-IN")} ·{" "}
                  {formatInrPrice(String(order.total)) ?? `₹${order.total}`} · {order.lines.length} items
                </small>
              </li>
            ))}
          </ul>
        )}

        <div className="login-actions-row" style={{ marginTop: 24 }}>
          {session.role === "admin" ? (
            <>
              <Link href="/admin" className="button primary button-sage">
                Site admin
              </Link>
              <Link href="/admin/orders" className="button secondary">
                Orders
              </Link>
              <Link href="/admin/b2b" className="button secondary">
                B2B
              </Link>
            </>
          ) : null}
          <Link href="/" className="button secondary">
            Home
          </Link>
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
