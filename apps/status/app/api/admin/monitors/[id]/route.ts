import { NextRequest, NextResponse } from "next/server";
import { dbOps, MonitorRow } from "@/lib/db";
import { updateMonitorSchema } from "@/features/admin/schemas";
import { monitorManager } from "@/features/status/server/manager";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const existing = await dbOps.getMonitor(id);
  if (!existing) {
    return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = updateMonitorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Build the column patch, converting the boolean `enabled` to 0/1.
  const { enabled, ...rest } = parsed.data;
  const patch: Partial<Omit<MonitorRow, "id" | "created_at" | "updated_at">> = { ...rest };
  if (enabled !== undefined) patch.enabled = enabled ? 1 : 0;

  const row = await dbOps.updateMonitor(id, patch);
  if (row) monitorManager.addOrUpdate(row); // reschedule live (handles enable/disable too)
  return NextResponse.json({ monitor: row });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbOps.deleteMonitor(id);
  monitorManager.remove(id); // stop pinging immediately (checks history retained)
  return NextResponse.json({ ok: true });
}
