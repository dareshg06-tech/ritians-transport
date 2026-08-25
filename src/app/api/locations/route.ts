import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fleetBus } from "@/lib/fleet/eventBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/locations — record a new vehicle location AND broadcast to admin clients
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vehicleId, latitude, longitude, accuracy, speed, heading, altitude, isSimulated } = body;
    if (!vehicleId || typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json({ error: "vehicleId, latitude, longitude required" }, { status: 400 });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    // Save location
    const loc = await db.vehicleLocation.create({
      data: {
        vehicleId,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        heading: heading ?? null,
        altitude: altitude ?? null,
        isSimulated: !!isSimulated,
      },
    });

    // Update vehicle's last position + status
    const newStatus = (speed ?? 0) > 1 ? "live" : "idle";
    const vehicle = await db.vehicle.update({
      where: { id: vehicleId },
      data: {
        lastLat: latitude,
        lastLng: longitude,
        lastAccuracy: accuracy ?? null,
        lastSpeed: speed ?? null,
        lastHeading: heading ?? null,
        lastAltitude: altitude ?? null,
        lastSeenAt: new Date(),
        status: newStatus,
      },
    });

    // Broadcast to admin SSE clients via the event bus
    fleetBus.publish({
      type: "vehicle_location_updated",
      data: {
        vehicleId,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleName: vehicle.vehicleName,
        routeNo: vehicle.routeNo || undefined,
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        altitude,
        isSimulated: !!isSimulated,
        timestamp: new Date().toISOString(),
        lastCrossedStop: body.lastCrossedStop || null,
        nextStop: body.nextStop || null,
        progressPercent: body.progressPercent || 0,
      },
    });

    return NextResponse.json({ location: loc });
  } catch (err) {
    console.error("[api/locations POST]", err);
    return NextResponse.json({ error: "Failed to save location" }, { status: 500 });
  }
}
