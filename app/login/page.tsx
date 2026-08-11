import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in | Maroma"
};

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="login-page"><p className="login-card">Loading…</p></main>}>
      <LoginForm />
    </Suspense>
  );
}
