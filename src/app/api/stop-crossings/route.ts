import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/stop-crossings — record that a vehicle crossed a stop
// Body: { vehicleId, routeNo, stopName, stopLat, stopLng, sequence }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vehicleId, routeNo, stopName, stopLat, stopLng, sequence } = body;
    if (!vehicleId || !stopName || !routeNo) {
      return NextResponse.json({ error: "vehicleId, routeNo, stopName required" }, { status: 400 });
    }

    // Avoid duplicate crossing of same stop within 5 minutes
    const recent = await db.stopCrossing.findFirst({
      where: {
        vehicleId,
        stopName,
        crossedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });
    if (recent) {
      return NextResponse.json({ ok: true, duplicate: true, crossing: recent });
    }

    const crossing = await db.stopCrossing.create({
      data: {
        vehicleId,
        routeNo,
        stopName,
        stopLat: stopLat || 0,
        stopLng: stopLng || 0,
        sequence: sequence || 0,
      },
    });
    return NextResponse.json({ ok: true, crossing });
  } catch (err) {
    console.error("[api/stop-crossings POST]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
