import { NextRequest, NextResponse } from "next/server";
import { dbOps } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const siteId = (await params).id;
  try {
    const latest = await dbOps.getLatest(siteId);
    return NextResponse.json({ latest });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load latest" }, { status: 500 });
  }
}
