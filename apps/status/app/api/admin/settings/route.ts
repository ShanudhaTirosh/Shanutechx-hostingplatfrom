import { NextRequest, NextResponse } from "next/server";
import { dbOps } from "@/lib/db";
import {
  getBranding,
  getRetention,
  getNotificationConfig,
} from "@/lib/settings";
import { hashPassword } from "@/lib/auth";
import { settingsUpdateSchema } from "@/features/admin/schemas";
import { monitorManager } from "@/features/status/server/manager";

export const dynamic = "force-dynamic";

const SECRET_MASK = "********";

export async function GET() {
  const [branding, retention, notifications] = await Promise.all([
    getBranding(),
    getRetention(),
    getNotificationConfig(),
  ]);

  // Never return stored secrets; send a sentinel instead.
  const masked = {
    ...notifications,
    email: {
      ...notifications.email,
      pass: notifications.email.pass ? SECRET_MASK : "",
    },
    telegram: {
      ...notifications.telegram,
      botToken: notifications.telegram.botToken ? SECRET_MASK : "",
    },
  };

  return NextResponse.json({
    branding,
    retention,
    notifications: masked,
  });
}

export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = settingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (data.branding) await dbOps.setSetting("branding", data.branding);

  if (data.retention) {
    await dbOps.setSetting("retention", data.retention);
    monitorManager.rescheduleRetention();
  }

  if (data.notifications) {
    const next = data.notifications;
    // If a secret came back as the mask sentinel, keep the existing stored value.
    if (next.email.pass === SECRET_MASK || next.telegram.botToken === SECRET_MASK) {
      const current = await getNotificationConfig();
      if (next.email.pass === SECRET_MASK) next.email.pass = current.email.pass ?? null;
      if (next.telegram.botToken === SECRET_MASK) {
        next.telegram.botToken = current.telegram.botToken ?? null;
      }
    }
    await dbOps.setSetting("notifications", next);
  }

  if (data.password) {
    const passwordHash = await hashPassword(data.password);
    await dbOps.setSetting("admin", { passwordHash });
  }

  return NextResponse.json({ ok: true });
}
