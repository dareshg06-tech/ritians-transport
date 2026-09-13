import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fleetBus } from "@/lib/fleet/eventBus";
import {
  validateGpsFix,
  deriveBusState,
  deriveConfidence,
  DEFAULT_VALIDATOR_CONFIG,
  DEFAULT_BUS_STATE_CONFIG,
  type RawGpsFix,
  type PreviousFix,
} from "@/lib/fleet/physics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/locations — record a new vehicle location with full physics
// validation, anomaly detection, and state derivation. Rejects anomalous
// fixes (teleport, out-of-order, impossible acceleration, etc.) but still
// records them in the BusLocationAnomaly table for admin inspection.
//
// Acceptance tests covered here:
//   TEST 9  — teleport protection (reject)
//   TEST 10 — out-of-order packet rejection
//   TEST 14 — impossible acceleration / heading change detection
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      vehicleId,
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      altitude,
      isSimulated,
      timestamp,
      provider = isSimulated ? "SIMULATED" : "GPS",
    } = body;

    // --- Basic validation ---
    if (!vehicleId || typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json({ error: "vehicleId, latitude, longitude required" }, { status: 400 });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    // --- Look up previous fix for anomaly detection ---
    const prevLocation = await db.vehicleLocation.findFirst({
      where: { vehicleId },
      orderBy: { recordedAt: "desc" },
    });

    const prevForValidation: PreviousFix | null = prevLocation
      ? {
          coords: { lat: prevLocation.latitude, lng: prevLocation.longitude },
          speedKmh: prevLocation.speed ?? 0,
          headingDeg: prevLocation.heading,
          gpsTimestamp: prevLocation.recordedAt.getTime(),
          receivedAt: prevLocation.recordedAt.getTime(),
        }
      : null;

    // --- Build the RawGpsFix and validate ---
    const fix: RawGpsFix = {
      busId: vehicleId,
      latitude,
      longitude,
      speedKmh: speed ?? null,
      headingDeg: heading ?? null,
      accuracyM: accuracy ?? null,
      altitudeM: altitude ?? null,
      timestamp: timestamp ? new Date(timestamp).getTime() : Date.now(),
      provider,
    };

    // Skip anomaly detection if the previous fix is very old (>2 minutes).
    // This happens when a driver starts a new session after a gap —
    // the first fix will naturally be far from the last recorded position,
    // but that's not a teleport, it's just a new trip starting.
    const skipAnomaly = prevLocation && (Date.now() - prevLocation.recordedAt.getTime() > 2 * 60 * 1000);
    const anomaly = skipAnomaly ? null : validateGpsFix(fix, prevForValidation);

    // --- If the anomaly is a hard reject, log it and drop the fix ---
    if (anomaly?.reject) {
      await db.busLocationAnomaly.create({
        data: {
          vehicleId,
          type: anomaly.type,
          message: anomaly.message,
          latitude,
          longitude,
          speedKmh: speed ?? null,
          headingDeg: heading ?? null,
          accuracyM: accuracy ?? null,
          rejected: true,
        },
      }).catch(() => {});

      // Still broadcast the rejection so admins see it live
      fleetBus.publish({
        type: "vehicle_location_updated",
        data: {
          vehicleId,
          latitude: prevLocation?.latitude ?? latitude,
          longitude: prevLocation?.longitude ?? longitude,
          speed: prevLocation?.speed ?? 0,
          heading: prevLocation?.heading ?? undefined,
          accuracy: prevLocation?.accuracy ?? undefined,
          isSimulated: !!isSimulated,
          timestamp: new Date().toISOString(),
          rejected: true,
          anomaly: { type: anomaly.type, message: anomaly.message },
        },
      });

      return NextResponse.json({
        rejected: true,
        anomaly: { type: anomaly.type, message: anomaly.message },
      });
    }

    // --- Save the location ---
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

    // --- Compute bus state + confidence for the new fix ---
    const locationAgeS = (Date.now() - fix.timestamp) / 1000;
    const state = deriveBusState({
      speedKmh: speed ?? 0,
      prevSpeedKmh: prevLocation?.speed ?? 0,
      accelerationKmhPerS: 0, // computed properly on client; server doesn't track this
      hasRecentFix: locationAgeS < DEFAULT_BUS_STATE_CONFIG.staleLocationS,
      providerIsGps: provider === "GPS",
      locationAgeS,
      config: DEFAULT_BUS_STATE_CONFIG,
    });

    const confidence = deriveConfidence(accuracy ?? null, locationAgeS, provider);

    // --- Update vehicle's last position + status ---
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

    // --- Record non-rejecting anomalies (informational) ---
    if (anomaly && !anomaly.reject) {
      await db.busLocationAnomaly.create({
        data: {
          vehicleId,
          type: anomaly.type,
          message: anomaly.message,
          latitude,
          longitude,
          speedKmh: speed ?? null,
          headingDeg: heading ?? null,
          accuracyM: accuracy ?? null,
          rejected: false,
        },
      }).catch(() => {});
    }

    // --- Broadcast to SSE clients with enriched physics fields ---
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
        timestamp: new Date(fix.timestamp).toISOString(),
        // Physics-enriched fields
        state,
        confidence,
        provider,
        locationAgeS,
        lastCrossedStop: body.lastCrossedStop || null,
        nextStop: body.nextStop || null,
        progressPercent: body.progressPercent || 0,
        // Anomaly (informational — not rejected)
        anomaly: anomaly && !anomaly.reject
          ? { type: anomaly.type, message: anomaly.message }
          : null,
      },
    });

    return NextResponse.json({
      location: loc,
      state,
      confidence,
      anomaly: anomaly && !anomaly.reject ? { type: anomaly.type, message: anomaly.message } : null,
    });
  } catch (err) {
    console.error("[api/locations POST]", err);
    return NextResponse.json({ error: "Failed to save location" }, { status: 500 });
  }
}
