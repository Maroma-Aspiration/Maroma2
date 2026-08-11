import { NextResponse } from "next/server";
import { listAuthUsersAdmin, setAuthUserRole, createAuthUser, resetAuthUserPassword } from "../../../../lib/auth-user-store";

export async function POST(request: Request) {
  let email = "";
  let password = "";
  let role = "admin";
  try {
    const body = (await request.json()) as { email?: string; password?: string; role?: string };
    email = typeof body.email === "string" ? body.email : "";
    password = typeof body.password === "string" ? body.password : "";
    role = typeof body.role === "string" ? body.role : "admin";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (role !== "admin" && role !== "user") {
    return NextResponse.json({ error: "Role must be admin or user." }, { status: 400 });
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
  const users = await listAuthUsersAdmin();
  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  let body: { email?: string; role?: string; action?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  // Reset password action
  if (body.action === "reset_password") {
    const password = typeof body.password === "string" ? body.password : "";
    if (!password) {
      return NextResponse.json({ error: "New password is required." }, { status: 400 });
    }
    try {
      await resetAuthUserPassword(email, password);
      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = (error as Error).message;
      if (message === "not_found") return NextResponse.json({ error: "User not found." }, { status: 404 });
      return NextResponse.json({ error: "Could not reset password." }, { status: 500 });
    }
  }

  // Update role action
  const role = typeof body.role === "string" ? body.role : "";
  if (role !== "admin" && role !== "user") {
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

