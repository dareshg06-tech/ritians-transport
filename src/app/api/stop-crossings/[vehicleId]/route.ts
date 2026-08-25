import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/stop-crossings/[vehicleId] — today's stop crossings for a vehicle
export async function GET(_req: NextRequest, { params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const crossings = await db.stopCrossing.findMany({
      where: { vehicleId, crossedAt: { gte: startOfDay } },
      orderBy: { sequence: "asc" },
    });
    return NextResponse.json({ crossings });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
