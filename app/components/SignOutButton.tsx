"use client";

export function SignOutButton({
  label = "Sign out",
  onSignedOut,
}: {
  label?: string;
  onSignedOut?: () => void;
}) {
  return (
    <button
      type="button"
      className="button secondary"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
        try {
          window.localStorage.setItem("maroma-admin-drag", "false");
          window.dispatchEvent(new Event("maroma-admin-changed"));
        } catch {
          // ignore
        }
        onSignedOut?.();
        window.location.href = "/login";
      }}
    >
      {label}
    </button>
  );
}
