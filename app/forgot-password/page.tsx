import Link from "next/link";

export const metadata = {
  title: "Forgot password | Maroma",
};

export default function ForgotPasswordPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <p className="login-eyebrow">Maroma</p>
        <h1 className="login-title">Forgot password?</h1>
        <p className="login-reason">
          If you are already signed in, go to your account page to change your password.
        </p>
        <p className="login-reason">
          If you cannot sign in, an admin can reset your password from{" "}
          <Link href="/admin/users">Manage Users</Link> (admin sign-in required).
        </p>
        <p className="login-footer" style={{ marginTop: 24 }}>
          <Link href="/login">Back to sign in</Link> · <Link href="/">Back to site</Link>
        </p>
      </section>
    </main>
  );
}
