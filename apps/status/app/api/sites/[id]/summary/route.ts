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
    const summary = await dbOps.getSummary(siteId, days);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load summary" }, { status: 500 });
  }
}
