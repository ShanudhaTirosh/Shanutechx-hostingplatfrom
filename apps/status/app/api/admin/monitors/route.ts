import { NextRequest, NextResponse } from "next/server";
import { dbOps, NewMonitor } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { createMonitorSchema } from "@/features/admin/schemas";
import { monitorManager } from "@/features/status/server/manager";

export const dynamic = "force-dynamic";

export async function GET() {
  const monitors = await dbOps.listMonitors();
  return NextResponse.json({ monitors });
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "monitor";
  let candidate = base;
  let n = 2;
  while (await dbOps.getMonitor(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = createMonitorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const newMonitor: NewMonitor = {
    id: await uniqueSlug(data.name),
    name: data.name,
    type: data.type,
    url: data.url,
    host: data.host,
    port: data.port,
    method: data.method,
    expected_status: data.expected_status,
    keyword: data.keyword,
    interval_seconds: data.interval_seconds,
    timeout_ms: data.timeout_ms,
    enabled: data.enabled ? 1 : 0,
    sort_order: data.sort_order,
  };

  const row = await dbOps.insertMonitor(newMonitor);
  monitorManager.addOrUpdate(row); // go live immediately
  return NextResponse.json({ monitor: row }, { status: 201 });
}
