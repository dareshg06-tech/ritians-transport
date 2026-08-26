import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/tracking/status/[vehicleId]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  try {
    const session = await db.trackingSession.findFirst({
      where: { vehicleId, status: "active" },
      orderBy: { startedAt: "desc" },
    });
    const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } });
    return NextResponse.json({
      tracking: !!session,
      session,
      vehicle,
    });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
