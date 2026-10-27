import { NextRequest, NextResponse } from "next/server";
import { dbOps } from "@/lib/db";
import { updateIncidentSchema } from "@/features/admin/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const incident = await dbOps.getIncident(id);
  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }
  return NextResponse.json({ incident });
}

export async function PATCH(
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

  const parsed = updateIncidentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updated = await dbOps.updateIncident(id, {
    title: data.title,
    type: data.type,
    status: data.status,
    impact: data.impact,
    monitorsArray: data.monitors,
    scheduled_start: data.scheduled_start,
    scheduled_end: data.scheduled_end,
  });

  if (!updated) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  return NextResponse.json({ incident: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await dbOps.getIncident(id);
  if (!existing) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  await dbOps.deleteIncident(id);
  return NextResponse.json({ ok: true });
}
