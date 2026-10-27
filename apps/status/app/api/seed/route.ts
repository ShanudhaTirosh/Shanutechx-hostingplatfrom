import { NextResponse } from "next/server";
import { dbOps, initDb } from "@/lib/db";

export async function POST() {
  await initDb();

  const now = Date.now();
  const h = 3600000;

  const fakeChecks = [
    // nooblk-web: up → down 2h ago → recovered 1.5h ago
    { siteId: "nooblk-web", ts: now - 2.5 * h, ok: true, latency: 120, statusCode: 200, error: null },
    { siteId: "nooblk-web", ts: now - 2 * h, ok: false, latency: null, statusCode: 503, error: "Service Unavailable" },
    { siteId: "nooblk-web", ts: now - 1.5 * h, ok: true, latency: 142, statusCode: 200, error: null },

    // openwrt-git: up → down 5h ago → recovered 4h ago
    { siteId: "openwrt-git", ts: now - 5.5 * h, ok: true, latency: 180, statusCode: 200, error: null },
    { siteId: "openwrt-git", ts: now - 5 * h, ok: false, latency: null, statusCode: null, error: "Connection timed out" },
    { siteId: "openwrt-git", ts: now - 4 * h, ok: true, latency: 210, statusCode: 200, error: null },

    // jenkins: up → down 45min ago → still down
    { siteId: "jenkins", ts: now - 0.75 * h, ok: true, latency: 95, statusCode: 200, error: null },
    { siteId: "jenkins", ts: now - 0.5 * h, ok: false, latency: null, statusCode: null, error: "Connection refused" },
    { siteId: "jenkins", ts: now - 0.3 * h, ok: false, latency: null, statusCode: null, error: "Connection refused" },

    // portainer: up → down 24h ago → recovered 23h ago
    { siteId: "portainer", ts: now - 25 * h, ok: true, latency: 88, statusCode: 200, error: null },
    { siteId: "portainer", ts: now - 24 * h, ok: false, latency: null, statusCode: 502, error: "Bad Gateway" },
    { siteId: "portainer", ts: now - 23 * h, ok: true, latency: 98, statusCode: 200, error: null },
  ];

  for (const check of fakeChecks) {
    await dbOps.insertCheck(check);
  }

  return NextResponse.json({ ok: true, inserted: fakeChecks.length });

}
