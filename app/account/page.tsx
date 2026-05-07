import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "../components/SignOutButton";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../lib/auth-session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your account — Maroma"
};

export default async function AccountPage({
  searchParams
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

  const notice =
    searchParams.reason === "admin_only"
      ? "Admin tools live under /admin — your account uses the standard user role."
      : null;

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="login-eyebrow">Signed in</p>
        <h1 className="login-title">Account</h1>
        <p className="login-reason">
          <strong>{session.email}</strong>
          <br />
          Role: <strong>{session.role}</strong>
        </p>
        {notice ? <p className="login-reason">{notice}</p> : null}
        <div className="login-actions-row">
          {session.role === "admin" ? (
            <Link href="/admin" className="button primary button-sage">
              Open admin
            </Link>
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
