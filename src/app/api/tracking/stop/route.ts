import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fleetBus } from "@/lib/fleet/eventBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/tracking/stop
// Body: { vehicleId }
export async function POST(req: NextRequest) {
  try {
    const { vehicleId } = await req.json();
    if (!vehicleId) {
      return NextResponse.json({ error: "vehicleId required" }, { status: 400 });
    }
    await db.trackingSession.updateMany({
      where: { vehicleId, status: "active" },
      data: { status: "stopped", stoppedAt: new Date() },
    });
    await db.vehicle.update({
      where: { id: vehicleId },
      data: { status: "offline" },
    });
    // Broadcast offline notification
    fleetBus.publish({ type: "vehicle_offline", data: { vehicleId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to stop tracking" }, { status: 500 });
  }
}
