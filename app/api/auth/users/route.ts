import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listAuthUsersAdmin, setAuthUserRole, createAuthUser, resetAuthUserPassword, editStoredAuthUser, deleteStoredAuthUser } from "../../../../lib/auth-user-store";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { isUserRole } from "../../../../lib/auth-roles";
import type { UserRole } from "../../../../lib/auth-types";

async function requireAdmin() {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  let email = "";
  let password = "";
  let role: UserRole = "admin";
  try {
    const body = (await request.json()) as { email?: string; password?: string; role?: string };
    email = typeof body.email === "string" ? body.email : "";
    password = typeof body.password === "string" ? body.password : "";
    if (typeof body.role === "string" && body.role.trim()) {
      if (!isUserRole(body.role)) {
        return NextResponse.json({ error: "Role must be admin, production, newsletter, or user." }, { status: 400 });
      }
      role = body.role;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (password.trim().length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const user = await createAuthUser(email, password, role);
    return NextResponse.json({ ok: true, email: user.email, role: user.role });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "exists") {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const users = await listAuthUsersAdmin();
  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  let body: { email?: string; newEmail?: string; role?: string; action?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (body.action === "edit_user") {
    const role = body.role;
    if (!isUserRole(role)) {
      return NextResponse.json({ error: "A valid role is required." }, { status: 400 });
    }
    try {
      const user = await editStoredAuthUser(email, {
        email: body.newEmail,
        role,
        password: body.password,
      });
      return NextResponse.json({ ok: true, user });
    } catch (error) {
      const message = (error as Error).message;
      if (message === "exists") return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
      if (message === "not_stored") return NextResponse.json({ error: "Environment-managed users must be edited in Vercel settings." }, { status: 400 });
      return NextResponse.json({ error: "Could not edit user." }, { status: 400 });
    }
  }

  if (body.action === "reset_password") {
    const password = typeof body.password === "string" ? body.password : "";
    if (password.trim().length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    try {
      await resetAuthUserPassword(email, password);
      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = (error as Error).message;
      if (message === "not_found") return NextResponse.json({ error: "User not found." }, { status: 404 });
      if (message === "password_too_short") {
        return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
      }
      if (message === "password_verify_failed" || message === "kv_write_verify_failed") {
        return NextResponse.json(
          { error: "Password could not be saved securely. Try again, or check KV storage." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: "Could not reset password." }, { status: 500 });
    }
  }

  const role = typeof body.role === "string" ? body.role : "";
  if (!isUserRole(role)) {
    return NextResponse.json({ error: "Email and a valid role are required." }, { status: 400 });
  }

  try {
    const user = await setAuthUserRole(email, role);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "not_found") {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (message === "invalid_email") {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not update role." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let email = "";
  try {
    const body = (await request.json()) as { email?: string };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (session.email.toLowerCase() === email) {
    return NextResponse.json(
      { error: "Sign in as a different admin before deleting this account." },
      { status: 400 }
    );
  }

  try {
    await deleteStoredAuthUser(email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as Error).message === "not_stored") {
      return NextResponse.json({ error: "Environment-managed users must be removed in Vercel settings." }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not delete user." }, { status: 400 });
  }
}
