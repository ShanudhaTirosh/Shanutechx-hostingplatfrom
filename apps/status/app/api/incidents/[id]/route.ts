import { NextRequest, NextResponse } from "next/server";
import { dbOps } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const incident = await dbOps.getIncident(id);

    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    const monitors = await dbOps.listMonitors();
    const monitorMap = new Map<string, string>();
    for (const m of monitors) {
      monitorMap.set(m.id, m.name);
    }

    const monitorNames = incident.parsed_monitors.map((mid) => {
      if (mid === "all") return "All Systems";
      return monitorMap.get(mid) ?? mid;
    });

    return NextResponse.json({
      incident: {
        ...incident,
        monitor_names: monitorNames,
      },
    });
  } catch (error) {
    console.error("Failed to get incident:", error);
    return NextResponse.json({ error: "Failed to load incident" }, { status: 500 });
  }
}
