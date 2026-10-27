import { NextRequest, NextResponse } from "next/server";
import { dbOps } from "@/lib/db";
import { isIpAddressOrPrivate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days")) || 1;

  try {
    const monitors = await dbOps.listMonitors({ enabledOnly: true });
    const siteIds = monitors.map((m) => m.id);

    if (siteIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const { summaries, latests, checks } = await dbOps.getDashboardData(siteIds, days);

    const dashboardData = monitors.map((m) => {
      // Privacy safeguard: Never leak VPS host IPs, ports, or private addresses to public viewers
      const isVpsOrPrivate =
        m.type === "tcp" ||
        m.type === "ping" ||
        isIpAddressOrPrivate(m.host) ||
        isIpAddressOrPrivate(m.url);
      const publicUrl = isVpsOrPrivate ? "" : (m.url ?? "");

      const site = {
        id: m.id,
        name: m.name,
        url: publicUrl,
        type: m.type,
        isNode: isVpsOrPrivate,
        intervalSeconds: m.interval_seconds,
      };
      const summary = summaries.find((s) => s.site_id === m.id);
      const latest = latests.find((l) => l.site_id === m.id);
      const siteChecks = checks.filter((c) => c.site_id === m.id);

      return {
        site,
        summary: summary
          ? {
              total: summary.total,
              okCount: summary.okCount,
              percent: summary.total
                ? Number(((summary.okCount / summary.total) * 100).toFixed(2))
                : 0,
            }
          : null,
        latest: latest || null,
        checks: siteChecks,
      };
    });

    return NextResponse.json({ data: dashboardData });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}
