import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/tracking/start
// Body: { vehicleId }
export async function POST(req: NextRequest) {
  try {
    const { vehicleId } = await req.json();
    if (!vehicleId) {
      return NextResponse.json({ error: "vehicleId required" }, { status: 400 });
    }
    // Close any existing active sessions for this vehicle
    await db.trackingSession.updateMany({
      where: { vehicleId, status: "active" },
      data: { status: "stopped", stoppedAt: new Date() },
    });
    // Clear any prior stop crossings for this vehicle (today)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    await db.stopCrossing.deleteMany({
      where: { vehicleId, crossedAt: { gte: startOfDay } },
    });
    const session = await db.trackingSession.create({
      data: { vehicleId, status: "active" },
    });
    await db.vehicle.update({
      where: { id: vehicleId },
      data: { status: "tracking" },
    });
    return NextResponse.json({ session });
  } catch (err) {
    console.error("[api/tracking/start]", err);
    return NextResponse.json({ error: "Failed to start tracking" }, { status: 500 });
  }
}
