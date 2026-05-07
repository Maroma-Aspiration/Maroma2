"use client";

export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  return (
    <button
      type="button"
      className="button secondary"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >
      {label}
    </button>
  );
}
