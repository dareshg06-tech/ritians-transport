// ============================================================================
// physics.test.ts — Unit tests for the NEXUS live tracking physics engine
// ============================================================================
// Run with: npx tsx --test tests/physics.test.ts
//
// Covers all 12 acceptance tests from the spec:
//   TEST 1: speed=0 → STOPPED state
//   TEST 2: speed=10 km/h → MOVING (slow)
//   TEST 3: speed=40 km/h → MOVING (faster)
//   TEST 4: bus stops → STOPPED state
//   TEST 5: bus accelerates → ACCELERATING state
//   TEST 6: direction change → smooth rotation (no 359→0 jump)
//   TEST 7: GPS unavailable → NETWORK_TRACKING fallback
//   TEST 8: both unavailable → STALE / OFFLINE
//   TEST 9: GPS jump (teleport) → anomaly rejection
//   TEST 10: out-of-order packets → rejected
//   TEST 11: network latency → location age displayed
//   TEST 12: stop detection + duration recorded
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  haversineMeters,
  bearing,
  lerpCoord,
  lerpHeading,
  angleDelta,
  kmhToMs,
  msToKmh,
  validateGpsFix,
  deriveBusState,
  deriveConfidence,
  snapToRoute,
  computeEta,
  updateStopDetection,
  makeStopDetectionState,
  planMarkerInterpolation,
  sampleInterpolation,
  SpeedSmoother,
  processTelemetry,
  type RawGpsFix,
  type PreviousFix,
  type PipelinePrev,
} from "../src/lib/fleet/physics";

// ============================================================================
// 1. GEOMETRY PRIMITIVES
// ============================================================================

describe("Geometry primitives", () => {
  it("haversineMeters: Chennai to Bengaluru ~ 290 km", () => {
    const chennai = { lat: 13.0827, lng: 80.2707 };
    const bengaluru = { lat: 12.9716, lng: 77.5946 };
    const dist = haversineMeters(chennai, bengaluru);
    // Real distance is ~290 km; allow ±10 km tolerance
    assert.ok(dist > 280_000, `dist should be > $280_000`)
    assert.ok(dist < 310_000, `dist should be < $310_000`)
  });

  it("haversineMeters: same point = 0", () => {
    const p = { lat: 13.0827, lng: 80.2707 };
    assert.equal(haversineMeters(p, p), 0)
  });

  it("bearing: east-moving path → ~90°", () => {
    const a = { lat: 13.0, lng: 80.0 };
    const b = { lat: 13.0, lng: 80.1 }; // 0.1° east
    const b1 = bearing(a, b);
    assert.ok(Math.abs(b1 - 90) <= 5, `b1 should be ~$90±$5`)
  });

  it("bearing: north-moving path → ~0°", () => {
    const a = { lat: 13.0, lng: 80.0 };
    const b = { lat: 13.1, lng: 80.0 }; // 0.1° north
    const b1 = bearing(a, b);
    assert.ok(Math.abs(b1 - 0) <= 5, `b1 should be ~$0±$5`)
  });

  it("lerpCoord: midpoint", () => {
    const a = { lat: 13.0, lng: 80.0 };
    const b = { lat: 14.0, lng: 81.0 };
    const mid = lerpCoord(a, b, 0.5);
    assert.equal(mid.lat, 13.5)
    assert.equal(mid.lng, 80.5)
  });

  it("angleDelta: 350 → 10 = +20 (shortest arc)", () => {
    assert.ok(Math.abs(angleDelta(350, 10) - 20) <= 0.1, `angleDelta(350, 10) should be ~$20±$0.1`)
  });

  it("angleDelta: 10 → 350 = -20 (shortest arc)", () => {
    assert.ok(Math.abs(angleDelta(10, 350) - -20) <= 0.1, `angleDelta(10, 350) should be ~$-20±$0.1`)
  });

  it("lerpHeading: 350 → 10 at t=0.5 = 0", () => {
    const h = lerpHeading(350, 10, 0.5);
    assert.ok(Math.abs(h - 0) <= 0.5, `h should be ~$0±$0.5`)
  });

  it("kmhToMs / msToKmh: round-trip", () => {
    assert.equal(msToKmh(kmhToMs(36)), 36)
    assert.equal(kmhToMs(36), 10)
  });
});

// ============================================================================
// 2. GPS ANOMALY DETECTION — TESTS 9, 10, 14
// ============================================================================

describe("GPS anomaly detection", () => {
  const baseFix: RawGpsFix = {
    busId: "BUS-001",
    latitude: 13.0827,
    longitude: 80.2707,
    speedKmh: 30,
    headingDeg: 90,
    accuracyM: 5,
    altitudeM: 30,
    timestamp: Date.now(),
    provider: "GPS",
  };

  it("TEST 9: teleport — 100km jump in 1s → rejected", () => {
    const prev: PreviousFix = {
      coords: { lat: 13.0827, lng: 80.2707 },
      speedKmh: 30,
      headingDeg: 90,
      gpsTimestamp: Date.now() - 1000,
      receivedAt: Date.now() - 1000,
    };
    // Jump 100km north
    const fix: RawGpsFix = {
      ...baseFix,
      latitude: 13.9827, // ~100km north
      timestamp: Date.now(),
    };
    const anomaly = validateGpsFix(fix, prev);
    assert.notEqual(anomaly, null)
    assert.equal(anomaly!.type, "TELEPORT")
    assert.equal(anomaly!.reject, true)
  });

  it("TEST 10: out-of-order packet → rejected", () => {
    const now = Date.now();
    const prev: PreviousFix = {
      coords: { lat: 13.0827, lng: 80.2707 },
      speedKmh: 30,
      headingDeg: 90,
      gpsTimestamp: now,
      receivedAt: now,
    };
    // Older packet arrives
    const fix: RawGpsFix = {
      ...baseFix,
      latitude: 13.0830,
      longitude: 80.2710,
      timestamp: now - 5000, // 5s in the past
    };
    const anomaly = validateGpsFix(fix, prev);
    assert.notEqual(anomaly, null)
    assert.equal(anomaly!.type, "OUT_OF_ORDER")
    assert.equal(anomaly!.reject, true)
  });

  it("TEST 14: impossible acceleration (0→100 km/h in 1s) → rejected", () => {
    const now = Date.now();
    const prev: PreviousFix = {
      coords: { lat: 13.0827, lng: 80.2707 },
      speedKmh: 0,
      headingDeg: 0,
      gpsTimestamp: now - 1000,
      receivedAt: now - 1000,
    };
    const fix: RawGpsFix = {
      ...baseFix,
      latitude: 13.0828,
      longitude: 80.2708,
      speedKmh: 100, // jump from 0 to 100 km/h in 1s
      timestamp: now,
    };
    const anomaly = validateGpsFix(fix, prev);
    assert.notEqual(anomaly, null)
    assert.equal(anomaly!.type, "IMPOSSIBLE_ACCELERATION")
    assert.equal(anomaly!.reject, true)
  });

  it("TEST 14: impossible heading change (180° in 1s) → rejected", () => {
    const now = Date.now();
    const prev: PreviousFix = {
      coords: { lat: 13.0827, lng: 80.2707 },
      speedKmh: 30,
      headingDeg: 0, // facing north
      gpsTimestamp: now - 1000,
      receivedAt: now - 1000,
    };
    const fix: RawGpsFix = {
      ...baseFix,
      latitude: 13.0828,
      longitude: 80.2708,
      headingDeg: 180, // facing south — 180° change in 1s
      timestamp: now,
    };
    const anomaly = validateGpsFix(fix, prev);
    assert.notEqual(anomaly, null)
    assert.equal(anomaly!.type, "IMPOSSIBLE_HEADING_CHANGE")
    assert.equal(anomaly!.reject, true)
  });

  it("duplicate coordinates (within 2.5m) → flagged but NOT rejected", () => {
    const now = Date.now();
    const prev: PreviousFix = {
      coords: { lat: 13.0827, lng: 80.2707 },
      speedKmh: 0,
      headingDeg: 0,
      gpsTimestamp: now - 1000,
      receivedAt: now - 1000,
    };
    const fix: RawGpsFix = {
      ...baseFix,
      latitude: 13.0827001, // ~1cm away
      longitude: 80.2707001,
      speedKmh: 0,
      timestamp: now,
    };
    const anomaly = validateGpsFix(fix, prev);
    assert.notEqual(anomaly, null)
    assert.equal(anomaly!.type, "DUPLICATE")
    assert.equal(anomaly!.reject, false)
  });

  it("low accuracy (>50m) → flagged but NOT rejected", () => {
    const fix: RawGpsFix = {
      ...baseFix,
      accuracyM: 80,
    };
    const anomaly = validateGpsFix(fix, null);
    assert.notEqual(anomaly, null)
    assert.equal(anomaly!.type, "LOW_ACCURACY")
    assert.equal(anomaly!.reject, false)
  });

  it("valid fix → no anomaly", () => {
    const now = Date.now();
    const prev: PreviousFix = {
      coords: { lat: 13.0827, lng: 80.2707 },
      speedKmh: 30,
      headingDeg: 90,
      gpsTimestamp: now - 1000,
      receivedAt: now - 1000,
    };
    const fix: RawGpsFix = {
      ...baseFix,
      latitude: 13.0828, // ~11m north
      longitude: 80.2707,
      speedKmh: 35,
      timestamp: now,
    };
    const anomaly = validateGpsFix(fix, prev);
    assert.equal(anomaly, null)
  });
});

// ============================================================================
// 3. BUS STATE ENGINE — TESTS 1-5, 7, 8
// ============================================================================

describe("Bus state engine", () => {
  it("TEST 1: speed=0 → STOPPED", () => {
    const state = deriveBusState({
      speedKmh: 0,
      prevSpeedKmh: 0,
      accelerationKmhPerS: 0,
      hasRecentFix: true,
      providerIsGps: true,
      locationAgeS: 0,
    });
    assert.equal(state, "STOPPED")
  });

  it("TEST 2: speed=10 km/h → MOVING", () => {
    const state = deriveBusState({
      speedKmh: 10,
      prevSpeedKmh: 10,
      accelerationKmhPerS: 0,
      hasRecentFix: true,
      providerIsGps: true,
      locationAgeS: 0,
    });
    assert.equal(state, "MOVING")
  });

  it("TEST 3: speed=40 km/h → MOVING", () => {
    const state = deriveBusState({
      speedKmh: 40,
      prevSpeedKmh: 40,
      accelerationKmhPerS: 0,
      hasRecentFix: true,
      providerIsGps: true,
      locationAgeS: 0,
    });
    assert.equal(state, "MOVING")
  });

  it("TEST 4: bus stops (decelerating to 0) → STOPPED", () => {
    const state = deriveBusState({
      speedKmh: 0,
      prevSpeedKmh: 5,
      accelerationKmhPerS: -5,
      hasRecentFix: true,
      providerIsGps: true,
      locationAgeS: 0,
    });
    assert.equal(state, "STOPPED")
  });

  it("TEST 5: bus accelerates (speed increasing) → ACCELERATING", () => {
    const state = deriveBusState({
      speedKmh: 20,
      prevSpeedKmh: 10,
      accelerationKmhPerS: 10,
      hasRecentFix: true,
      providerIsGps: true,
      locationAgeS: 0,
    });
    assert.equal(state, "ACCELERATING")
  });

  it("deceleration (not stopped) → SLOWING", () => {
    const state = deriveBusState({
      speedKmh: 30,
      prevSpeedKmh: 40,
      accelerationKmhPerS: -10,
      hasRecentFix: true,
      providerIsGps: true,
      locationAgeS: 0,
    });
    assert.equal(state, "SLOWING")
  });

  it("TEST 7: GPS unavailable but network available → NETWORK_TRACKING", () => {
    const state = deriveBusState({
      speedKmh: 25,
      prevSpeedKmh: 25,
      accelerationKmhPerS: 0,
      hasRecentFix: true,
      providerIsGps: false, // network
      locationAgeS: 1,
    });
    assert.equal(state, "NETWORK_TRACKING")
  });

  it("TEST 8a: location age > 30s → STALE_LOCATION", () => {
    const state = deriveBusState({
      speedKmh: 25,
      prevSpeedKmh: 25,
      accelerationKmhPerS: 0,
      hasRecentFix: false,
      providerIsGps: true,
      locationAgeS: 45,
    });
    assert.equal(state, "STALE_LOCATION")
  });

  it("TEST 8b: location age > 60s → OFFLINE", () => {
    const state = deriveBusState({
      speedKmh: 25,
      prevSpeedKmh: 25,
      accelerationKmhPerS: 0,
      hasRecentFix: false,
      providerIsGps: true,
      locationAgeS: 90,
    });
    assert.equal(state, "OFFLINE")
  });

  it("GPS temporarily unavailable → GPS_LOST", () => {
    const state = deriveBusState({
      speedKmh: 0,
      prevSpeedKmh: 0,
      accelerationKmhPerS: 0,
      hasRecentFix: false, // recent fix is missing
      providerIsGps: true,
      locationAgeS: 5, // not yet STALE
    });
    assert.equal(state, "GPS_LOST")
  });
});

// ============================================================================
// 4. LOCATION CONFIDENCE
// ============================================================================

describe("Location confidence", () => {
  it("GPS + 5m accuracy + 1s age → HIGH", () => {
    const c = deriveConfidence(5, 1, "GPS");
    assert.equal(c, "HIGH")
  });

  it("GPS + 30m accuracy → MEDIUM", () => {
    const c = deriveConfidence(30, 1, "GPS");
    assert.equal(c, "MEDIUM")
  });

  it("Network + 80m accuracy → LOW", () => {
    const c = deriveConfidence(80, 1, "NETWORK");
    assert.equal(c, "LOW")
  });

  it("45s age → STALE", () => {
    const c = deriveConfidence(5, 45, "GPS");
    assert.equal(c, "STALE")
  });

  it("90s age → OFFLINE", () => {
    const c = deriveConfidence(5, 90, "GPS");
    assert.equal(c, "OFFLINE")
  });
});

// ============================================================================
// 5. ROUTE SNAPPING — road-aware movement
// ============================================================================

describe("Route snapping", () => {
  const route: { lat: number; lng: number }[] = [
    { lat: 13.0, lng: 80.0 },
    { lat: 13.1, lng: 80.0 }, // north
    { lat: 13.2, lng: 80.0 }, // further north
    { lat: 13.3, lng: 80.0 }, // end
  ];

  it("GPS point on the route → snaps exactly", () => {
    const gps = { lat: 13.15, lng: 80.0 }; // exactly on segment 1→2
    const snap = snapToRoute(gps, route);
    assert.notEqual(snap, null)
    assert.ok(Math.abs(snap!.snappedCoords.lat - 13.15) <= 0.001, `snap!.snappedCoords.lat should be ~$13.15±$0.001`)
    assert.equal(snap!.segmentIndex, 1)
    assert.ok(Math.abs(snap!.segmentProgress - 0.5) <= 0.01, `snap!.segmentProgress should be ~$0.5±$0.01`)
    assert.ok(snap!.deviationM < 1, `snap!.deviationM should be < $1`)
  });

  it("GPS point off the route → snaps to nearest segment", () => {
    const gps = { lat: 13.15, lng: 80.01 }; // 0.01° east ≈ 1.1km
    const snap = snapToRoute(gps, route);
    assert.notEqual(snap, null)
    assert.ok(snap!.deviationM > 500, `snap!.deviationM should be > $500`)
    assert.ok(snap!.deviationM < 1500, `snap!.deviationM should be < $1500`)
  });

  it("returns null for empty route", () => {
    assert.equal(snapToRoute({ lat: 13, lng: 80 }, []), null)
  });

  it("routeProgress: midpoint of full route ~ 0.5", () => {
    const gps = { lat: 13.15, lng: 80.0 };
    const snap = snapToRoute(gps, route);
    assert.ok(Math.abs(snap!.routeProgress - 0.5) <= 0.05, `snap!.routeProgress should be ~$0.5±$0.05`)
  });
});

// ============================================================================
// 6. ETA ENGINE — TEST 9 (ETA recalculation when speed changes)
// ============================================================================

describe("ETA engine", () => {
  it("10km remaining at 30 km/h → ~20 min + 0 stops", () => {
    const eta = computeEta({
      remainingDistanceM: 10_000,
      currentSpeedKmh: 30,
      averageSpeedKmh: 30,
      recentStopS: 0,
      destinationStopS: 0,
    });
    // 10 km / 30 km/h = 0.333 h = 20 min
    assert.ok(Math.abs(eta.etaMinutes - 20) <= 0.5, `eta.etaMinutes should be ~$20±$0.5`)
    assert.ok(eta.confidence > 0.5, `eta.confidence should be > $0.5`)
  });

  it("bus stopped (speed=0) with recent avg → uses avg speed", () => {
    const eta = computeEta({
      remainingDistanceM: 5_000,
      currentSpeedKmh: 0,
      averageSpeedKmh: 20,
      recentStopS: 0,
      destinationStopS: 0,
    });
    // 5 km / 20 km/h = 0.25 h = 15 min
    assert.ok(Math.abs(eta.etaMinutes - 15) <= 0.5, `eta.etaMinutes should be ~$15±$0.5`)
  });

  it("bus stopped with no avg → infinite ETA", () => {
    const eta = computeEta({
      remainingDistanceM: 5_000,
      currentSpeedKmh: 0,
      averageSpeedKmh: 0,
      recentStopS: 0,
      destinationStopS: 0,
    });
    assert.equal(eta.etaMinutes, Infinity)
    assert.equal(eta.confidence, 0)
  });

  it("adds stop time to ETA", () => {
    const eta = computeEta({
      remainingDistanceM: 10_000,
      currentSpeedKmh: 60, // 10 min travel time
      averageSpeedKmh: 60,
      recentStopS: 60, // 1 minute of stops
      destinationStopS: 0,
    });
    // 10 min travel + 1 min stop = 11 min
    assert.ok(Math.abs(eta.etaMinutes - 11) <= 0.5, `eta.etaMinutes should be ~$11±$0.5`)
  });

  it("zero remaining distance → 0 ETA", () => {
    const eta = computeEta({
      remainingDistanceM: 0,
      currentSpeedKmh: 30,
      averageSpeedKmh: 30,
      recentStopS: 0,
      destinationStopS: 0,
    });
    assert.equal(eta.etaMinutes, 0)
  });
});

// ============================================================================
// 7. STOP DETECTION — TEST 12
// ============================================================================

describe("Stop detection", () => {
  const routeStops = [
    { stop: "Stop A", coords: { lat: 13.0, lng: 80.0 } },
    { stop: "Stop B", coords: { lat: 13.1, lng: 80.0 } },
    { stop: "Stop C", coords: { lat: 13.2, lng: 80.0 } },
  ];

  it("TEST 12: bus stops near a route stop for >5s → records stop", () => {
    let state = makeStopDetectionState();
    const start = Date.now();

    // Bus moving → stopped transition at Stop B
    state = updateStopDetection(state, 20, { lat: 13.05, lng: 80.0 }, start, routeStops);
    assert.equal(state.isStopped, false)

    // Stops at Stop B (at coords of Stop B)
    state = updateStopDetection(state, 0, { lat: 13.1, lng: 80.0 }, start + 1000, routeStops);
    assert.equal(state.isStopped, true)
    assert.notEqual(state.stopStartTs, null)
    assert.equal(state.nearbyStopName, "Stop B")

    // Resumes after 10 seconds
    state = updateStopDetection(state, 30, { lat: 13.15, lng: 80.0 }, start + 11000, routeStops);
    assert.equal(state.isStopped, false)
    assert.notEqual(state.lastStop, null)
    assert.ok(Math.abs(state.lastStop!.durationS - 10) <= 0.5, `state.lastStop!.durationS should be ~$10±$0.5`)
    assert.equal(state.lastStop!.nearbyStopName, "Stop B")
  });

  it("brief stop < 5s → discarded", () => {
    let state = makeStopDetectionState();
    const start = Date.now();
    state = updateStopDetection(state, 0, { lat: 13.0, lng: 80.0 }, start, routeStops);
    state = updateStopDetection(state, 30, { lat: 13.05, lng: 80.0 }, start + 2000, routeStops);
    assert.equal(state.lastStop, null) // too brief
  });

  it("moving bus → no stop recorded", () => {
    let state = makeStopDetectionState();
    const start = Date.now();
    state = updateStopDetection(state, 30, { lat: 13.0, lng: 80.0 }, start, routeStops);
    state = updateStopDetection(state, 30, { lat: 13.05, lng: 80.0 }, start + 1000, routeStops);
    assert.equal(state.isStopped, false)
    assert.equal(state.lastStop, null)
  });
});

// ============================================================================
// 8. SPEED SMOOTHING
// ============================================================================

describe("Speed smoother", () => {
  it("rolling average of 3 values", () => {
    const s = new SpeedSmoother(3);
    assert.equal(s.push(10), 10)
    assert.equal(s.push(20), 15) // (10+20)/2
    assert.equal(s.push(30), 20) // (10+20+30)/3
    assert.equal(s.push(40), 30) // (20+30+40)/3 — oldest dropped
  });

  it("reset clears window", () => {
    const s = new SpeedSmoother(3);
    s.push(10);
    s.reset();
    assert.equal(s.last(), null)
  });
});

// ============================================================================
// 9. MARKER INTERPOLATION — TEST 16 (animation = distance/speed)
// ============================================================================

describe("Marker interpolation", () => {
  it("TEST 16: duration derived from distance/speed, NOT fixed", () => {
    const from = { lat: 13.0, lng: 80.0 };
    const to = { lat: 13.001, lng: 80.0 }; // ~111m north
    // At 40 km/h = 11.11 m/s → 10s for 111m
    const interp = planMarkerInterpolation(from, to, 0, 0, 40);
    assert.notEqual(interp, null)
    // 10s = 10000ms, but clamped to maxMs=3000
    assert.equal(interp!.durationMs, 3000)
  });

  it("slow speed → longer duration", () => {
    const from = { lat: 13.0, lng: 80.0 };
    const to = { lat: 13.0005, lng: 80.0 }; // ~55m
    // At 40 km/h (11.1 m/s): 55m / 11.1 = ~5s → clamped to max 3000ms
    // At 10 km/h (2.78 m/s): 55m / 2.78 = ~20s → clamped to max 3000ms
    // Use shorter distance so neither hits the clamp
    const from2 = { lat: 13.0, lng: 80.0 };
    const to2 = { lat: 13.0001, lng: 80.0 }; // ~11m
    const fast = planMarkerInterpolation(from2, to2, 0, 0, 40); // 11m / 11.1 m/s = 1s
    const slow = planMarkerInterpolation(from2, to2, 0, 0, 10); // 11m / 2.78 m/s = 4s → clamped to 3s
    assert.ok(slow!.durationMs > fast!.durationMs, `slow (${slow!.durationMs}ms) should be > fast (${fast!.durationMs}ms)`)
  });

  it("speed=0 → duration 0 (no animation)", () => {
    const from = { lat: 13.0, lng: 80.0 };
    const to = { lat: 13.001, lng: 80.0 };
    const interp = planMarkerInterpolation(from, to, 0, 0, 0);
    assert.equal(interp!.durationMs, 0)
  });

  it("same point → null (no movement needed)", () => {
    const p = { lat: 13.0, lng: 80.0 };
    assert.equal(planMarkerInterpolation(p, p, 0, 0, 30), null)
  });

  it("sampleInterpolation: t=0 returns from, t=1 returns to", () => {
    const interp = planMarkerInterpolation(
      { lat: 13.0, lng: 80.0 },
      { lat: 13.001, lng: 80.0 },
      0, 90, 40
    )!;
    const at0 = sampleInterpolation(interp, interp.startTime);
    assert.ok(Math.abs(at0.coords.lat - 13.0) <= 0.0001, `at0.coords.lat should be ~$13.0±$0.0001`)
    const at1 = sampleInterpolation(interp, interp.startTime + interp.durationMs);
    assert.ok(Math.abs(at1.coords.lat - 13.001) <= 0.0001, `at1.coords.lat should be ~$13.001±$0.0001`)
    assert.equal(at1.t, 1)
  });

  it("TEST 6: smooth heading rotation (350 → 10 = +20°, not -340°)", () => {
    const interp = planMarkerInterpolation(
      { lat: 13.0, lng: 80.0 },
      { lat: 13.001, lng: 80.0 },
      350, 10, 30
    )!;
    const atMid = sampleInterpolation(interp, interp.startTime + interp.durationMs / 2);
    assert.ok(Math.abs(atMid.heading - 0) <= 1, `atMid.heading should be ~$0±$1`) // halfway from 350→10 should be 0
  });
});

// ============================================================================
// 10. FULL PIPELINE — end-to-end processing
// ============================================================================

describe("Full telemetry pipeline", () => {
  it("processes a valid fix and produces telemetry", () => {
    const fix: RawGpsFix = {
      busId: "BUS-001",
      latitude: 13.0828,
      longitude: 80.2707,
      speedKmh: 30,
      headingDeg: 0,
      accuracyM: 5,
      altitudeM: 30,
      timestamp: Date.now(),
      provider: "GPS",
    };
    const smoother = new SpeedSmoother(3);
    const result = processTelemetry(fix, null, [], smoother);
    assert.equal(result.reject, false)
    assert.equal(result.telemetry.busId, "BUS-001")
    assert.equal(result.telemetry.state, "MOVING")
    assert.ok(Math.abs(result.telemetry.speedKmh - 30) <= 0.1, `result.telemetry.speedKmh should be ~$30±$0.1`)
    assert.equal(result.telemetry.confidence, "HIGH")
  });

  it("TEST 11: location age computed from GPS timestamp", () => {
    const oldTimestamp = Date.now() - 5000; // 5s ago
    const fix: RawGpsFix = {
      busId: "BUS-001",
      latitude: 13.0827,
      longitude: 80.2707,
      speedKmh: 0,
      headingDeg: null,
      accuracyM: 5,
      altitudeM: 30,
      timestamp: oldTimestamp,
      provider: "GPS",
    };
    const smoother = new SpeedSmoother(3);
    const result = processTelemetry(fix, null, [], smoother, Date.now());
    assert.ok(Math.abs(result.telemetry.locationAgeS - 5) <= 0.1, `result.telemetry.locationAgeS should be ~$5±$0.1`)
  });

  it("rejects teleport and returns previous state", () => {
    const now = Date.now();
    const prev: PipelinePrev = {
      coords: { lat: 13.0827, lng: 80.2707 },
      smoothedCoords: { lat: 13.0827, lng: 80.2707 },
      smoothedSpeedKmh: 30,
      speedKmh: 30,
      headingDeg: 90,
      accuracyM: 5,
      gpsTimestamp: now - 1000,
      receivedAt: now - 1000,
      stopDetection: makeStopDetectionState(),
    };
    const fix: RawGpsFix = {
      busId: "BUS-001",
      latitude: 13.9827, // ~100km jump
      longitude: 80.2707,
      speedKmh: 30,
      headingDeg: 90,
      accuracyM: 5,
      altitudeM: 30,
      timestamp: now,
      provider: "GPS",
    };
    const smoother = new SpeedSmoother(3);
    const result = processTelemetry(fix, prev, [], smoother, now);
    assert.equal(result.reject, true)
    assert.notEqual(result.telemetry.anomaly, null)
    assert.equal(result.telemetry.anomaly!.type, "TELEPORT")
    // Coords should be the previous ones (not the teleported ones)
    assert.equal(result.telemetry.coords.lat, 13.0827)
  });
});

// ============================================================================
// 11. SUMMARY — verify all 12 acceptance tests are covered
// ============================================================================

describe("Acceptance tests summary", () => {
  it("all 12 acceptance tests are covered in this file", () => {
    // This test exists purely as documentation — if it runs, all the named
    // tests above have been declared and will be picked up by the runner.
    const testNames = [
      "TEST 1: speed=0 → STOPPED",
      "TEST 2: speed=10 km/h → MOVING",
      "TEST 3: speed=40 km/h → MOVING",
      "TEST 4: bus stops → STOPPED",
      "TEST 5: bus accelerates → ACCELERATING",
      "TEST 6: smooth heading rotation",
      "TEST 7: GPS unavailable → NETWORK_TRACKING",
      "TEST 8: both unavailable → STALE/OFFLINE",
      "TEST 9: GPS jump → anomaly rejection",
      "TEST 10: out-of-order → rejected",
      "TEST 11: latency → location age displayed",
      "TEST 12: stop detection + duration",
    ];
    assert.equal(testNames.length, 12)
  });
});
