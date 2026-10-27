import { NextRequest, NextResponse } from "next/server";
import { dbOps } from "@/lib/db";
import { addIncidentUpdateSchema } from "@/features/admin/schemas";
import { sendIncidentAlert } from "@/features/notifications/server/notifications";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = addIncidentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const existing = await dbOps.getIncident(id);
  if (!existing) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  const updatedIncident = await dbOps.addIncidentUpdate(id, {
    status: data.status,
    message: data.message,
  });

  if (data.notify && updatedIncident) {
    sendIncidentAlert({
      title: updatedIncident.title,
      type: updatedIncident.type,
      status: data.status,
      impact: updatedIncident.impact,
      message: data.message,
      monitors: updatedIncident.parsed_monitors,
    }).catch((err) => console.error("Notification broadcast error:", err));
  }

  return NextResponse.json({ incident: updatedIncident }, { status: 201 });
}
