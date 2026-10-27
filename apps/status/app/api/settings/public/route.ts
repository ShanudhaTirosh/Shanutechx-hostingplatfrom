import { NextResponse } from "next/server";
import { getBranding } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Public, non-secret branding for the dashboard UI.
export async function GET() {
  const branding = await getBranding();
  return NextResponse.json({ branding });
}
