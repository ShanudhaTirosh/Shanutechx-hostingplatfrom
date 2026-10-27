import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  adminConfigured,
  createSession,
  sessionCookieOptions,
  verifyAdminPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let password = "";
  try {
    const body = await req.json();
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!(await adminConfigured())) {
    return NextResponse.json(
      { error: "No admin password configured. Set ADMIN_PASSWORD in the environment." },
      { status: 409 }
    );
  }

  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
