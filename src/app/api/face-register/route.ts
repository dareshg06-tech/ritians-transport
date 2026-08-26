import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST — save face registration
export async function POST(req: NextRequest) {
  const { studentName, registerNo, routeNo, imageData } = await req.json();
  if (!studentName || !registerNo) return NextResponse.json({ error: "studentName and registerNo required" }, { status: 400 });
  const rec = await db.faceRegistration.create({
    data: { studentName, registerNo, routeNo: routeNo || null, imageData: imageData || "" },
  });
  return NextResponse.json({ face: rec });
}

// GET — list face registrations
export async function GET() {
  const faces = await db.faceRegistration.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ faces });
}
