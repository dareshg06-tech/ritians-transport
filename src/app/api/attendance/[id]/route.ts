import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUT /api/attendance/[id] — update a record
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const rec = await db.attendanceRecord.update({
      where: { id },
      data: {
        studentName: body.studentName,
        registerNo: body.registerNo,
        routeNo: body.routeNo,
        boardingPoint: body.boardingPoint || null,
        status: body.status,
      },
    });
    return NextResponse.json({ record: rec });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// DELETE /api/attendance/[id] — delete a record
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await db.attendanceRecord.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
