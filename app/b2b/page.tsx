import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../lib/auth-session";
import { getB2bCompanyByUserEmail } from "../../lib/b2b-store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "B2B | Maroma",
  robots: { index: false, follow: false },
};

export default async function B2bIndexPage() {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!secret || !token) {
    redirect("/login?next=/b2b&reason=sign_in_required");
  }
  const session = await verifySessionPayload(token, secret);
  if (!session) {
    redirect("/login?next=/b2b&reason=sign_in_required");
  }

  if (session.role === "admin") {
    redirect("/admin/b2b");
  }

  const company = await getB2bCompanyByUserEmail(session.email);
  if (company) {
    redirect(`/b2b/${company.slug}`);
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <h1 className="login-title">No wholesale page</h1>
        <p className="login-reason">
          Signed in as <strong>{session.email}</strong>. No B2B company is linked to this account yet.
          Contact Maroma if you expected access.
        </p>
        <Link href="/account" className="button secondary">
          Account
        </Link>
      </section>
    </main>
  );
}
