import { NextResponse } from "next/server";
import { listAuthUsersPublic, setAuthUserRole } from "../../../../lib/auth-user-store";

export async function GET() {
  const users = await listAuthUsersPublic();
  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  let email = "";
  let role = "";
  try {
    const body = (await request.json()) as { email?: string; role?: string };
    email = typeof body.email === "string" ? body.email : "";
    role = typeof body.role === "string" ? body.role : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!email || (role !== "admin" && role !== "user")) {
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

