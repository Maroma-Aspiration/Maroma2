import { createAuthUser, readAllAuthUsers, resetAuthUserPassword } from "./auth-user-store";
import { normalizeAuthEmail } from "./auth-users-config";
import type { B2bCompany } from "./b2b-types";
import { resolveFromEmail, sendEmail } from "./newsletter-send";

export type B2bWelcomeEmailResult = {
  sent: boolean;
  accountCreated: boolean;
  passwordReset: boolean;
  /** Temporary password issued for the welcome email (admin may also show once). */
  temporaryPassword?: string;
  error?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Readable temporary password for B2B onboarding emails. */
export function generateB2bTemporaryPassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

export async function provisionB2bLoginAccount(
  email: string,
  temporaryPassword: string
): Promise<{ accountCreated: boolean; passwordReset: boolean }> {
  const normalized = normalizeAuthEmail(email);
  const users = await readAllAuthUsers();
  const existing = users.find((u) => u.email === normalized);
  if (!existing) {
    await createAuthUser(normalized, temporaryPassword, "user");
    return { accountCreated: true, passwordReset: false };
  }
  await resetAuthUserPassword(normalized, temporaryPassword);
  return { accountCreated: false, passwordReset: true };
}

export async function sendB2bCompanyWelcomeEmail(opts: {
  company: B2bCompany;
  siteOrigin: string;
  temporaryPassword: string;
  accountCreated: boolean;
}): Promise<{ sent: boolean; error?: string }> {
  const from = resolveFromEmail();
  if (!from) {
    return {
      sent: false,
      error: "NEWSLETTER_FROM_EMAIL is not configured; welcome email was not sent.",
    };
  }

  const origin = opts.siteOrigin.replace(/\/$/, "");
  const portalUrl = `${origin}/b2b/${opts.company.slug}`;
  const loginUrl = `${origin}/login?next=${encodeURIComponent(`/b2b/${opts.company.slug}`)}`;
  const modeLabel =
    opts.company.commerceMode === "checkout"
      ? "negotiated rates with checkout"
      : "request quote";

  const html = `
  <div style="font-family:Georgia,'Times New Roman',serif;color:#12372a;line-height:1.5;max-width:560px">
    <p style="margin:0 0 16px">Dear ${escapeHtml(opts.company.name)} team,</p>
    <p style="margin:0 0 16px">
      Your private Maroma wholesale page is ready. You can bookmark this link and share it with colleagues who use this login:
    </p>
    <p style="margin:0 0 16px">
      <a href="${escapeHtml(portalUrl)}" style="color:#2a7060">${escapeHtml(portalUrl)}</a>
    </p>
    <p style="margin:0 0 8px"><strong>Sign in</strong></p>
    <ul style="margin:0 0 16px;padding-left:18px">
      <li>Login page: <a href="${escapeHtml(loginUrl)}" style="color:#2a7060">${escapeHtml(loginUrl)}</a></li>
      <li>Email: <strong>${escapeHtml(opts.company.userEmail)}</strong></li>
      <li>Temporary password: <strong>${escapeHtml(opts.temporaryPassword)}</strong></li>
    </ul>
    <p style="margin:0 0 16px">
      ${
        opts.accountCreated
          ? "We created a new account for this email."
          : "We reset the password for this email so you can access the wholesale page with the credentials above."
      }
      Please change your password after signing in from Account.
    </p>
    <p style="margin:0 0 16px">
      Your page is set to <strong>${escapeHtml(modeLabel)}</strong>.
      Only the products assigned to your company appear there, at your negotiated rates.
    </p>
    <p style="margin:0">Warm regards,<br/>Maroma</p>
  </div>`;

  const result = await sendEmail({
    from,
    to: opts.company.userEmail,
    subject: `Your Maroma wholesale page — ${opts.company.name}`,
    html,
  });

  if (!result.ok) {
    return { sent: false, error: result.message };
  }
  return { sent: true };
}

/** Create/reset login + email portal link and temporary password. */
export async function provisionAndEmailB2bCompanyWelcome(
  company: B2bCompany,
  siteOrigin: string
): Promise<B2bWelcomeEmailResult> {
  const temporaryPassword = generateB2bTemporaryPassword();
  try {
    const provisioned = await provisionB2bLoginAccount(company.userEmail, temporaryPassword);
    const emailed = await sendB2bCompanyWelcomeEmail({
      company,
      siteOrigin,
      temporaryPassword,
      accountCreated: provisioned.accountCreated,
    });
    return {
      sent: emailed.sent,
      accountCreated: provisioned.accountCreated,
      passwordReset: provisioned.passwordReset,
      temporaryPassword,
      error: emailed.error,
    };
  } catch (err) {
    return {
      sent: false,
      accountCreated: false,
      passwordReset: false,
      temporaryPassword,
      error: err instanceof Error ? err.message : "Could not provision B2B login.",
    };
  }
}
