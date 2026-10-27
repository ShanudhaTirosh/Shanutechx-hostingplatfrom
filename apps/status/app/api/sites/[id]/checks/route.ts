import { NextRequest, NextResponse } from "next/server";
import { dbOps } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days")) || 30;
  const siteId = (await params).id;
  try {
    const checks = await dbOps.listChecks(siteId, days);
    return NextResponse.json({ checks });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load checks" }, { status: 500 });
  }
}
