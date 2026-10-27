import { NextRequest, NextResponse } from "next/server";
import { sendTestNotification } from "@/features/notifications/server/notifications";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const channel = body.channel || "discord";
    const result = await sendTestNotification(channel);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Test notification failed:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to send test notification" },
      { status: 400 }
    );
  }
}
