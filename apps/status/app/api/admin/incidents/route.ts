import { NextRequest, NextResponse } from "next/server";
import { dbOps } from "@/lib/db";
import { createIncidentSchema } from "@/features/admin/schemas";
import { sendIncidentAlert } from "@/features/notifications/server/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const incidents = await dbOps.listIncidents();
    const monitors = await dbOps.listMonitors();
    return NextResponse.json({ incidents, monitors });
  } catch (error) {
    console.error("Failed to load admin incidents:", error);
    return NextResponse.json({ error: "Failed to load incidents" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = createIncidentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const prefix = data.type === "maintenance" ? "maint" : "inc";
  const id = `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    const incident = await dbOps.insertIncident({
      id,
      title: data.title,
      type: data.type,
      status: data.status,
      impact: data.impact,
      monitors: data.monitors,
      scheduled_start: data.scheduled_start,
      scheduled_end: data.scheduled_end,
      message: data.message,
    });

    if (data.notify) {
      sendIncidentAlert({
        title: data.title,
        type: data.type,
        status: data.status,
        impact: data.impact,
        message: data.message,
        monitors: data.monitors,
      }).catch((err) => console.error("Notification broadcast error:", err));
    }

    return NextResponse.json({ incident }, { status: 201 });
  } catch (error) {
    console.error("Failed to create incident:", error);
    return NextResponse.json({ error: "Failed to create incident" }, { status: 500 });
  }
}
