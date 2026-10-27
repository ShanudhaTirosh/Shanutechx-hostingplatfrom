import { NextRequest, NextResponse } from "next/server";
import { dbOps, IncidentType, IncidentStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") as IncidentType) || undefined;
    const status = (searchParams.get("status") as IncidentStatus) || undefined;
    const activeOnly = searchParams.get("active") === "true";

    const allIncidents = await dbOps.listIncidents({
      type,
      status,
      activeOnly,
    });

    // Also load monitors to resolve monitor names
    const monitors = await dbOps.listMonitors();
    const monitorMap = new Map<string, string>();
    for (const m of monitors) {
      monitorMap.set(m.id, m.name);
    }

    const enhanced = allIncidents.map((inc) => {
      const monitorNames = inc.parsed_monitors.map((id) => {
        if (id === "all") return "All Systems";
        return monitorMap.get(id) ?? id;
      });
      return {
        ...inc,
        monitor_names: monitorNames,
      };
    });

    const activeIncidents = enhanced.filter(
      (i) => i.type === "incident" && i.status !== "resolved"
    );
    const pastIncidents = enhanced.filter(
      (i) => i.type === "incident" && i.status === "resolved"
    );

    const activeMaintenance = enhanced.filter(
      (i) => i.type === "maintenance" && i.status === "in_progress"
    );
    const upcomingMaintenance = enhanced.filter(
      (i) => i.type === "maintenance" && i.status === "scheduled"
    );
    const pastMaintenance = enhanced.filter(
      (i) => i.type === "maintenance" && i.status === "completed"
    );

    return NextResponse.json({
      all: enhanced,
      incidents: {
        active: activeIncidents,
        past: pastIncidents,
      },
      maintenance: {
        active: activeMaintenance,
        upcoming: upcomingMaintenance,
        past: pastMaintenance,
      },
      hasActiveIssues: activeIncidents.length > 0 || activeMaintenance.length > 0,
    });
  } catch (error) {
    console.error("Failed to list incidents:", error);
    return NextResponse.json({ error: "Failed to load incidents" }, { status: 500 });
  }
}
