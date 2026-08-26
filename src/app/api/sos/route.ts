import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST — create SOS alert
export async function POST(req: NextRequest) {
  const { studentName, registerNo, routeNo, message, location } = await req.json();
  if (!studentName || !registerNo) return NextResponse.json({ error: "studentName and registerNo required" }, { status: 400 });
  const alert = await db.sOSAlert.create({
    data: { studentName, registerNo, routeNo: routeNo || null, message: message || "Emergency alert", location: location || null },
  });
  return NextResponse.json({ alert });
}

// GET — list all SOS alerts
export async function GET() {
  const alerts = await db.sOSAlert.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ alerts });
}
