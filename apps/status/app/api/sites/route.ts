import { NextResponse } from "next/server";
import { dbOps } from "@/lib/db";
import { isIpAddressOrPrivate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const monitors = await dbOps.listMonitors({ enabledOnly: true });
  const sites = monitors.map((m) => {
    // Privacy safeguard: Never leak VPS host IPs, ports, or private addresses to public clients
    const isVpsOrPrivate =
      m.type === "tcp" ||
      m.type === "ping" ||
      isIpAddressOrPrivate(m.host) ||
      isIpAddressOrPrivate(m.url);
    const publicUrl = isVpsOrPrivate ? "" : (m.url ?? "");

    return {
      id: m.id,
      name: m.name,
      url: publicUrl,
      type: m.type,
      isNode: isVpsOrPrivate,
      intervalSeconds: m.interval_seconds,
    };
  });
  return NextResponse.json({ sites });
}
