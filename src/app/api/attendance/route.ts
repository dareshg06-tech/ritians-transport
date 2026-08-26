import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST — mark attendance
export async function POST(req: NextRequest) {
  const { studentName, registerNo, routeNo, boardingPoint, status, markedBy } = await req.json();
  if (!studentName || !registerNo) return NextResponse.json({ error: "studentName and registerNo required" }, { status: 400 });
  const rec = await db.attendanceRecord.create({
    data: {
      studentName, registerNo, routeNo: routeNo || "",
      boardingPoint: boardingPoint || null,
      status: status || "present",
      markedBy: markedBy || "manual",
    },
  });
  return NextResponse.json({ record: rec });
}

// GET — list attendance (optional routeNo filter)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const routeNo = url.searchParams.get("routeNo");
  const records = await db.attendanceRecord.findMany({
    where: routeNo ? { routeNo } : undefined,
    orderBy: { markedAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ records });
}
