// ============================================================================
// physics.ts — Real-Time Physics-Based Bus Tracking Engine
// ============================================================================
// This module implements the core kinematics, GPS smoothing, anomaly detection,
// bus state machine, ETA engine, and route-snapping logic for the NEXUS live
// tracking system.
//
// The fundamental relationship this module enforces:
//
//   REAL GPS DATA  →  CURRENT SPEED  →  TIME DIFFERENCE  →  DISTANCE TRAVELLED
//                                                              ↓
//   SMOOTH MAP MOVEMENT  ←  ROUTE POSITION  ←
//
// All functions are pure (no side effects, no I/O) so they can be unit-tested
// in isolation and shared between the client (simulator + UI) and server
// (telemetry validation + anomaly detection).
// ============================================================================

export interface Coord {
  lat: number;
  lng: number;
}

// ============================================================================
// 1. GEOMETRY PRIMITIVES
// ============================================================================

const EARTH_RADIUS_M = 6371000;

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Haversine distance in metres between two coords. */
export function haversineMeters(a: Coord, b: Coord): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Initial bearing (degrees, 0-360) from a → b. */
export function bearing(a: Coord, b: Coord): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Linear interpolation between two coords. t ∈ [0, 1]. */
export function lerpCoord(a: Coord, b: Coord, t: number): Coord {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

/** Shortest angular difference from → to, in degrees, range (-180, 180]. */
export function angleDelta(from: number, to: number): number {
  let d = ((to - from + 540) % 360) - 180;
  return d;
}

/** Interpolate between two headings using the shortest arc. t ∈ [0, 1]. */
export function lerpHeading(from: number | null, to: number | null, t: number): number | null {
  if (from == null || Number.isNaN(from)) return to;
  if (to == null || Number.isNaN(to)) return from;
  const d = angleDelta(from, to);
  return (from + d * t + 360) % 360;
}

/** km/h → m/s. */
export function kmhToMs(kmh: number): number {
  return kmh / 3.6;
}

/** m/s → km/h. */
export function msToKmh(ms: number): number {
  return ms * 3.6;
}

// ============================================================================
// 2. RAW GPS FIX — incoming telemetry before any processing
// ============================================================================

export interface RawGpsFix {
  busId: string;
  latitude: number;
  longitude: number;
  /** Speed in km/h, or null if device didn't report. */
  speedKmh: number | null;
  /** Heading in degrees 0-360, or null. */
  headingDeg: number | null;
  /** GPS accuracy in metres (1σ). */
  accuracyM: number | null;
  /** Altitude in metres. */
  altitudeM: number | null;
  /** Device-side timestamp (ms since epoch). */
  timestamp: number;
  /** "GPS" | "NETWORK" | "CACHED" | "SIMULATED". */
  provider: string;
}

// ============================================================================
// 3. PROCESSED TELEMETRY — the cleaned, validated fix ready to consume
// ============================================================================

export type BusState =
  | "MOVING"
  | "SLOWING"
  | "STOPPED"
  | "ACCELERATING"
  | "GPS_LOST"
  | "NETWORK_TRACKING"
  | "STALE_LOCATION"
  | "OFFLINE";

export type LocationConfidence = "HIGH" | "MEDIUM" | "LOW" | "STALE" | "OFFLINE";

export interface ProcessedTelemetry {
  busId: string;
  coords: Coord;
  /** Computed/cleaned speed in km/h (always ≥ 0). */
  speedKmh: number;
  /** Computed/cleaned heading in degrees 0-360 (or null when stationary). */
  headingDeg: number | null;
  /** Accuracy in metres. */
  accuracyM: number;
  altitudeM: number | null;
  /** Server-side receive timestamp (ms). */
  receivedAt: number;
  /** Device-side GPS timestamp (ms). */
  gpsTimestamp: number;
  /** Smoothed position (lat/lng) — used for the visual marker. */
  smoothedCoords: Coord;
  /** Smoothed speed (rolling average). */
  smoothedSpeedKmh: number;
  /** Acceleration in km/h per second (can be negative for deceleration). */
  accelerationKmhPerS: number;
  /** Active provider. */
  provider: string;
  /** Bus state machine value. */
  state: BusState;
  /** Confidence classification. */
  confidence: LocationConfidence;
  /** Age of the GPS fix in seconds (server time − gpsTimestamp). */
  locationAgeS: number;
  /** Distance travelled since the previous fix, in metres. */
  deltaDistanceM: number;
  /** Time elapsed since the previous fix, in seconds. */
  deltaTimeS: number;
  /** True if this fix was rejected as anomalous (caller should drop it). */
  anomaly: AnomalyResult | null;
}

export interface AnomalyResult {
  type:
    | "TELEPORT"
    | "DUPLICATE"
    | "OUT_OF_ORDER"
    | "IMPOSSIBLE_ACCELERATION"
    | "IMPOSSIBLE_HEADING_CHANGE"
    | "LOW_ACCURACY";
  message: string;
  /** Whether the caller should reject this fix entirely. */
  reject: boolean;
}

// ============================================================================
// 4. TELEMETRY VALIDATOR — anomaly detection + jump protection
// ============================================================================
//
// Acceptance tests covered here:
//   TEST 9  — GPS jumps hundreds of metres unrealistically → anomaly prevents teleport
//   TEST 10 — out-of-order packets → older packet rejected
//   TEST 14 — impossible acceleration / heading change detection

export interface TelemetryValidatorConfig {
  /** Max realistic bus speed (km/h). Fixes implying more are flagged TELEPORT. */
  maxRealisticSpeedKmh: number;
  /** Min distance (m) below which two fixes are considered duplicates. */
  duplicateThresholdM: number;
  /** Min time delta (s) for the speed calculation to be meaningful. */
  minDeltaTimeS: number;
  /** Max realistic acceleration (km/h per second). */
  maxAccelerationKmhPerS: number;
  /** Max realistic heading change (deg) per second. */
  maxHeadingChangePerS: number;
  /** Accuracy threshold (m) above which confidence drops. */
  poorAccuracyM: number;
}

export const DEFAULT_VALIDATOR_CONFIG: TelemetryValidatorConfig = {
  maxRealisticSpeedKmh: 90,
  duplicateThresholdM: 2.5,
  minDeltaTimeS: 0.2,
  maxAccelerationKmhPerS: 12, // 0-50 km/h in ~4 s — aggressive but realistic for a bus
  maxHeadingChangePerS: 60, // ~360°/6s — sharp turn
  poorAccuracyM: 50,
};

export interface PreviousFix {
  coords: Coord;
  speedKmh: number;
  headingDeg: number | null;
  gpsTimestamp: number;
  receivedAt: number;
}

/**
 * Validate an incoming GPS fix against the previous one.
 * Returns an AnomalyResult (with `reject: true` for hard rejects) or null.
 */
export function validateGpsFix(
  fix: RawGpsFix,
  prev: PreviousFix | null,
  now: number = Date.now(),
  config: TelemetryValidatorConfig = DEFAULT_VALIDATOR_CONFIG
): AnomalyResult | null {
  // --- TEST 10: out-of-order packets ---
  if (prev && fix.timestamp < prev.gpsTimestamp) {
    return {
      type: "OUT_OF_ORDER",
      message: `Fix timestamp ${fix.timestamp} is older than previous ${prev.gpsTimestamp}`,
      reject: true,
    };
  }

  // --- TEST 9: duplicate coordinates ---
  if (prev) {
    const dist = haversineMeters(prev.coords, { lat: fix.latitude, lng: fix.longitude });
    if (dist < config.duplicateThresholdM) {
      // Not necessarily bad — bus may be stationary. Don't reject, but flag.
      return {
        type: "DUPLICATE",
        message: `Fix is within ${dist.toFixed(1)} m of previous (stationary)`,
        reject: false,
      };
    }

    const dt = (fix.timestamp - prev.gpsTimestamp) / 1000;
    if (dt > config.minDeltaTimeS) {
      // --- TEST 9: teleportation — implied speed exceeds physical max ---
      const impliedSpeed = msToKmh(dist / dt);
      if (impliedSpeed > config.maxRealisticSpeedKmh) {
        return {
          type: "TELEPORT",
          message: `Implied speed ${impliedSpeed.toFixed(0)} km/h exceeds max ${config.maxRealisticSpeedKmh} km/h (dist=${dist.toFixed(0)} m, dt=${dt.toFixed(1)} s)`,
          reject: true,
        };
      }

      // --- impossible acceleration ---
      const speedDelta = (fix.speedKmh ?? impliedSpeed) - prev.speedKmh;
      const accel = speedDelta / dt;
      if (Math.abs(accel) > config.maxAccelerationKmhPerS) {
        return {
          type: "IMPOSSIBLE_ACCELERATION",
          message: `Acceleration ${accel.toFixed(1)} km/h/s exceeds max ${config.maxAccelerationKmhPerS} km/h/s`,
          reject: true,
        };
      }

      // --- impossible heading change ---
      if (
        prev.headingDeg != null &&
        fix.headingDeg != null &&
        !Number.isNaN(fix.headingDeg)
      ) {
        const hd = Math.abs(angleDelta(prev.headingDeg, fix.headingDeg));
        const hdPerS = hd / dt;
        if (hdPerS > config.maxHeadingChangePerS) {
          return {
            type: "IMPOSSIBLE_HEADING_CHANGE",
            message: `Heading change ${hd.toFixed(0)}° in ${dt.toFixed(1)} s = ${hdPerS.toFixed(0)}°/s exceeds max ${config.maxHeadingChangePerS}°/s`,
            reject: true,
          };
        }
      }
    }
  }

  // --- low accuracy warning (informational, not reject) ---
  if (fix.accuracyM != null && fix.accuracyM > config.poorAccuracyM) {
    return {
      type: "LOW_ACCURACY",
      message: `Accuracy ${fix.accuracyM.toFixed(0)} m exceeds ${config.poorAccuracyM} m threshold`,
      reject: false,
    };
  }

  return null;
}

// ============================================================================
// 5. SPEED SMOOTHING — rolling average + GPS jitter filter
// ============================================================================
//
// Reusable across DriverPortal, DriverGpsPortal, and the simulator. The
// previous in-component implementations are unified here.

export class SpeedSmoother {
  private window: number[] = [];
  private readonly size: number;

  constructor(size = 3) {
    this.size = size;
  }

  push(speed: number): number {
    this.window.push(speed);
    if (this.window.length > this.size) this.window.shift();
    return this.window.reduce((a, b) => a + b, 0) / this.window.length;
  }

  reset(): void {
    this.window = [];
  }

  last(): number | null {
    return this.window.length > 0 ? this.window[this.window.length - 1] : null;
  }
}

/**
 * Reconcile device-reported speed with delta-based speed.
 *
 * Device `pos.coords.speed` is often null on desktops and inaccurate on mobile.
 * We compute speed from the position delta (more reliable) and use the device
 * reading only as a sanity check.
 */
export function reconcileSpeed(
  deviceSpeedKmh: number | null,
  deltaSpeedKmh: number,
  deltaMeters: number,
  jitterThresholdM: number
): number {
  if (deltaMeters < jitterThresholdM) return 0;
  if (deviceSpeedKmh == null) return deltaSpeedKmh;
  if (deviceSpeedKmh > 1 && deltaSpeedKmh > 0.5) {
    // Both readings indicate movement — trust the higher (devices under-report)
    return Math.max(deviceSpeedKmh, deltaSpeedKmh);
  }
  if (deltaSpeedKmh > 0.5) return deltaSpeedKmh;
  if (deviceSpeedKmh > 1) return deviceSpeedKmh;
  return 0;
}

// ============================================================================
// 6. BUS STATE ENGINE — derived from speed history
// ============================================================================
//
// Acceptance tests covered here:
//   TEST 1 (speed=0 → STOPPED), TEST 2/3 (10/40 km/h → MOVING),
//   TEST 4 (stops → STOPPED), TEST 5 (accelerates → ACCELERATING),
//   TEST 7/8 (GPS/network unavailable → NETWORK_TRACKING / STALE / OFFLINE)

export interface BusStateInput {
  speedKmh: number;
  prevSpeedKmh: number;
  accelerationKmhPerS: number;
  /** Has there been a valid GPS fix within the freshness window? */
  hasRecentFix: boolean;
  /** Is the active provider GPS? */
  providerIsGps: boolean;
  /** Seconds since the last valid fix (Infinity if never). */
  locationAgeS: number;
  /** Configurable thresholds. */
  config?: BusStateConfig;
}

export interface BusStateConfig {
  movingThresholdKmh: number; // speed > this → MOVING (default 5)
  stoppedThresholdKmh: number; // speed ≤ this → STOPPED (default 1)
  slowingDeltaKmhPerS: number; // decel magnitude → SLOWING (default 3)
  acceleratingDeltaKmhPerS: number; // accel magnitude → ACCELERATING (default 3)
  staleLocationS: number; // age threshold → STALE (default 30)
  gpsLostS: number; // age threshold → GPS_LOST (default 60)
}

export const DEFAULT_BUS_STATE_CONFIG: BusStateConfig = {
  movingThresholdKmh: 5,
  stoppedThresholdKmh: 1,
  slowingDeltaKmhPerS: 3,
  acceleratingDeltaKmhPerS: 3,
  staleLocationS: 30,
  gpsLostS: 60,
};

export function deriveBusState(input: BusStateInput): BusState {
  const c = input.config ?? DEFAULT_BUS_STATE_CONFIG;

  // Offline / stale takes priority — physical state can't be derived from no data
  if (input.locationAgeS >= c.gpsLostS) return "OFFLINE";
  if (input.locationAgeS >= c.staleLocationS) return "STALE_LOCATION";
  if (!input.hasRecentFix) return "GPS_LOST";
  if (!input.providerIsGps) return "NETWORK_TRACKING";

  // Speed-derived states
  if (input.speedKmh <= c.stoppedThresholdKmh) return "STOPPED";
  if (input.accelerationKmhPerS <= -c.slowingDeltaKmhPerS) return "SLOWING";
  if (input.accelerationKmhPerS >= c.acceleratingDeltaKmhPerS) return "ACCELERATING";
  return "MOVING";
}

// ============================================================================
// 7. LOCATION CONFIDENCE
// ============================================================================

export function deriveConfidence(
  accuracyM: number | null,
  locationAgeS: number,
  provider: string,
  config = DEFAULT_BUS_STATE_CONFIG
): LocationConfidence {
  if (locationAgeS >= config.gpsLostS) return "OFFLINE";
  if (locationAgeS >= config.staleLocationS) return "STALE";
  if (accuracyM == null) return "LOW";
  if (provider === "GPS" && accuracyM < 15 && locationAgeS < 5) return "HIGH";
  if (provider === "GPS" || (provider === "NETWORK" && accuracyM < 50)) return "MEDIUM";
  return "LOW";
}

// ============================================================================
// 8. ROUTE MATCHING — snap GPS to nearest route segment
// ============================================================================
//
// Returns the snapped coord + the segment index + the progress fraction along
// that segment. This keeps the bus marker glued to the route polyline instead
// of floating through buildings.

export interface RouteSnapResult {
  /** Snapped coord on the route polyline. */
  snappedCoords: Coord;
  /** Index of the route segment (0-based) the bus is on. */
  segmentIndex: number;
  /** Progress along the segment [0, 1]. */
  segmentProgress: number;
  /** Total progress along the entire route [0, 1]. */
  routeProgress: number;
  /** Perpendicular distance from the GPS fix to the route, in metres. */
  deviationM: number;
}

/**
 * Snap a GPS coord to the nearest segment of a polyline.
 *
 * Algorithm: for each segment (a, b), find the closest point on the segment
 * using the perpendicular projection (treating lat/lng as planar — fine for
 * short segments at city scale). Track the minimum.
 */
export function snapToRoute(gps: Coord, route: Coord[]): RouteSnapResult | null {
  if (route.length < 2) return null;

  let best: RouteSnapResult | null = null;
  let bestDist = Infinity;
  let cumLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < route.length - 1; i++) {
    segLens.push(haversineMeters(route[i], route[i + 1]));
  }
  const totalLen = segLens.reduce((a, b) => a + b, 0);

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const segLen = segLens[i];
    if (segLen < 1) continue;

    // Project gps onto segment ab. Use planar approximation (sufficient for ~1km segments).
    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((gps.lng - a.lng) * dx + (gps.lat - a.lat) * dy) / (dx * dx + dy * dy)
      )
    );
    const proj: Coord = { lat: a.lat + dy * t, lng: a.lng + dx * t };
    const dist = haversineMeters(gps, proj);

    if (dist < bestDist) {
      bestDist = dist;
      const beforeLen = segLens.slice(0, i).reduce((s, l) => s + l, 0);
      best = {
        snappedCoords: proj,
        segmentIndex: i,
        segmentProgress: t,
        routeProgress: (beforeLen + segLen * t) / totalLen,
        deviationM: dist,
      };
    }
    cumLen += segLen;
  }

  return best;
}

// ============================================================================
// 9. ETA ENGINE — dynamic, never hardcoded
// ============================================================================

export interface EtaInput {
  /** Remaining distance along the route, in metres. */
  remainingDistanceM: number;
  /** Current speed in km/h. */
  currentSpeedKmh: number;
  /** Recent average speed in km/h (rolling window). */
  averageSpeedKmh: number;
  /** Seconds spent stopped in the last 5 minutes (traffic, signals). */
  recentStopS: number;
  /** Estimated stop duration at the destination, in seconds. */
  destinationStopS: number;
}

export interface EtaResult {
  /** Estimated seconds to arrival. */
  etaSeconds: number;
  /** Same value as minutes (for display). */
  etaMinutes: number;
  /** Confidence in the ETA (0-1). Lower when speed is unstable. */
  confidence: number;
}

/**
 * Compute a dynamic ETA from the actual current speed + recent average.
 * Falls back to the average speed when the bus is stopped (speed = 0).
 */
export function computeEta(input: EtaInput): EtaResult {
  if (input.remainingDistanceM <= 0) {
    return { etaSeconds: 0, etaMinutes: 0, confidence: 1 };
  }

  // If bus is moving, use a weighted blend of current + average speed.
  // If stopped, use the average speed (which captures the recent traffic).
  const effectiveSpeedKmh =
    input.currentSpeedKmh > 1
      ? input.currentSpeedKmh * 0.6 + input.averageSpeedKmh * 0.4
      : input.averageSpeedKmh;

  if (effectiveSpeedKmh < 1) {
    // Bus is effectively stopped with no recent movement — can't estimate
    return { etaSeconds: Infinity, etaMinutes: Infinity, confidence: 0 };
  }

  const effectiveSpeedMs = kmhToMs(effectiveSpeedKmh);
  const travelS = input.remainingDistanceM / effectiveSpeedMs;

  // Add stop time (signals, traffic) — prorated by remaining distance
  const totalS = travelS + input.recentStopS + input.destinationStopS;
  const confidence = Math.max(
    0,
    Math.min(1, input.currentSpeedKmh > 1 ? 0.8 : 0.5)
  );

  return {
    etaSeconds: totalS,
    etaMinutes: totalS / 60,
    confidence,
  };
}

// ============================================================================
// 10. STOP DETECTION — when has the bus actually stopped at a bus stop?
// ============================================================================
//
// Acceptance test 12 covered: bus reaches a stop → detection + duration recorded.

export interface StopDetectionState {
  /** True if currently inside a stopped window (speed < threshold). */
  isStopped: boolean;
  /** Start timestamp of the current stopped window (ms). */
  stopStartTs: number | null;
  /** Stop location (last known coords during the stop). */
  stopLocation: Coord | null;
  /** Nearest route stop name (if any) at the stop location. */
  nearbyStopName: string | null;
  /** Last completed stop record. */
  lastStop: {
    startTime: number;
    endTime: number;
    durationS: number;
    location: Coord;
    nearbyStopName: string | null;
  } | null;
}

export interface StopDetectionConfig {
  /** Speed (km/h) below which the bus is considered "stopped". */
  stoppedSpeedKmh: number;
  /** Min duration (s) for a stopped window to count as a real stop. */
  minStopDurationS: number;
  /** Radius (m) for matching a stop to a route stop point. */
  nearbyStopRadiusM: number;
}

export const DEFAULT_STOP_CONFIG: StopDetectionConfig = {
  stoppedSpeedKmh: 1,
  minStopDurationS: 5,
  nearbyStopRadiusM: 150,
};

export function updateStopDetection(
  state: StopDetectionState,
  speedKmh: number,
  coords: Coord,
  now: number,
  routeStops: { stop: string; coords?: Coord }[],
  config: StopDetectionConfig = DEFAULT_STOP_CONFIG
): StopDetectionState {
  const isStopped = speedKmh <= config.stoppedSpeedKmh;

  if (isStopped && !state.isStopped) {
    // Transition: moving → stopped. Start a new stopped window.
    const nearby = routeStops.find(
      (s) => s.coords && haversineMeters(coords, s.coords) < config.nearbyStopRadiusM
    );
    return {
      ...state,
      isStopped: true,
      stopStartTs: now,
      stopLocation: coords,
      nearbyStopName: nearby?.stop ?? null,
      lastStop: state.lastStop,
    };
  }

  if (!isStopped && state.isStopped && state.stopStartTs != null) {
    // Transition: stopped → moving. Close the window.
    const durationS = (now - state.stopStartTs) / 1000;
    if (durationS >= config.minStopDurationS && state.stopLocation) {
      return {
        ...state,
        isStopped: false,
        stopStartTs: null,
        stopLocation: null,
        nearbyStopName: null,
        lastStop: {
          startTime: state.stopStartTs,
          endTime: now,
          durationS,
          location: state.stopLocation,
          nearbyStopName: state.nearbyStopName,
        },
      };
    }
    // Too brief — discard
    return {
      ...state,
      isStopped: false,
      stopStartTs: null,
      stopLocation: null,
      nearbyStopName: null,
      lastStop: state.lastStop,
    };
  }

  // No transition — update stop location if still stopped
  if (isStopped && state.stopStartTs != null) {
    return { ...state, stopLocation: coords };
  }

  return state;
}

export function makeStopDetectionState(): StopDetectionState {
  return {
    isStopped: false,
    stopStartTs: null,
    stopLocation: null,
    nearbyStopName: null,
    lastStop: null,
  };
}

// ============================================================================
// 11. SMOOTH MARKER INTERPOLATION — requestAnimationFrame loop helper
// ============================================================================
//
// Used by FleetMap.client.tsx to animate the marker between the previous
// position and the new target at a rate derived from the actual speed.
//
// Acceptance test 16 covered: animation duration = distance / actual_speed,
// NOT a fixed duration.

export interface MarkerInterpolationState {
  from: Coord;
  to: Coord;
  startTime: number;
  /** Duration in ms — derived from distance / actual_speed. */
  durationMs: number;
  fromHeading: number | null;
  toHeading: number | null;
}

/**
 * Compute the interpolation state for the next marker move.
 *
 * durationMs = clamp(distance / speed, minMs, maxMs).
 *   - When speed = 0, marker doesn't move (durationMs = Infinity → no animation).
 *   - When speed is high, duration is short (fast movement).
 *   - When speed is low, duration is long (slow movement).
 */
export function planMarkerInterpolation(
  from: Coord,
  to: Coord,
  fromHeading: number | null,
  toHeading: number | null,
  actualSpeedKmh: number,
  minMs = 200,
  maxMs = 3000
): MarkerInterpolationState | null {
  const distanceM = haversineMeters(from, to);
  if (distanceM < 0.5) return null; // essentially the same point

  if (actualSpeedKmh < 0.5) {
    // Bus is stationary — no animation. Snap directly to "to".
    return {
      from,
      to,
      startTime: performance.now(),
      durationMs: 0, // 0 means "snap"
      fromHeading,
      toHeading,
    };
  }

  const speedMs = kmhToMs(actualSpeedKmh);
  const rawMs = (distanceM / speedMs) * 1000;
  const durationMs = Math.max(minMs, Math.min(maxMs, rawMs));

  return {
    from,
    to,
    startTime: performance.now(),
    durationMs,
    fromHeading,
    toHeading,
  };
}

/**
 * Sample the interpolated position at the current animation time.
 * Returns {coords, heading, t} where t ∈ [0, 1].
 */
export function sampleInterpolation(
  state: MarkerInterpolationState,
  now: number
): { coords: Coord; heading: number | null; t: number } {
  if (state.durationMs === 0) {
    return { coords: state.to, heading: state.toHeading, t: 1 };
  }
  const t = Math.max(0, Math.min(1, (now - state.startTime) / state.durationMs));
  return {
    coords: lerpCoord(state.from, state.to, t),
    heading: lerpHeading(state.fromHeading, state.toHeading, t),
    t,
  };
}

// ============================================================================
// 12. FULL TELEMETRY PIPELINE — combines all of the above
// ============================================================================
//
// Convenience function: takes a raw fix + previous processed telemetry and
// returns the new ProcessedTelemetry. This is what the client and server both
// call to "advance" a bus's state.

export interface PipelinePrev {
  coords: Coord;
  smoothedCoords: Coord;
  smoothedSpeedKmh: number;
  speedKmh: number;
  headingDeg: number | null;
  accuracyM: number;
  gpsTimestamp: number;
  receivedAt: number;
  stopDetection: StopDetectionState;
}

export interface PipelineResult {
  telemetry: ProcessedTelemetry;
  stopDetection: StopDetectionState;
  /** Non-null if the fix was rejected — caller should drop it. */
  reject: boolean;
}

export function processTelemetry(
  fix: RawGpsFix,
  prev: PipelinePrev | null,
  routeStops: { stop: string; coords?: Coord }[],
  smoother: SpeedSmoother,
  now: number = Date.now(),
  validatorConfig: TelemetryValidatorConfig = DEFAULT_VALIDATOR_CONFIG,
  stateConfig: BusStateConfig = DEFAULT_BUS_STATE_CONFIG,
  stopConfig: StopDetectionConfig = DEFAULT_STOP_CONFIG
): PipelineResult {
  const coords: Coord = { lat: fix.latitude, lng: fix.longitude };

  // 1. Validate
  const anomaly = prev
    ? validateGpsFix(
        fix,
        {
          coords: prev.coords,
          speedKmh: prev.speedKmh,
          headingDeg: prev.headingDeg,
          gpsTimestamp: prev.gpsTimestamp,
          receivedAt: prev.receivedAt,
        },
        now,
        validatorConfig
      )
    : null;

  if (anomaly?.reject) {
    // Hard reject — return previous state with stale age bumped.
    const locationAgeS = (now - (prev?.gpsTimestamp ?? now)) / 1000;
    return {
      telemetry: {
        busId: fix.busId,
        coords: prev?.coords ?? coords,
        speedKmh: prev?.speedKmh ?? 0,
        headingDeg: prev?.headingDeg ?? null,
        accuracyM: fix.accuracyM ?? prev?.accuracyM ?? 50,
        altitudeM: fix.altitudeM,
        receivedAt: now,
        gpsTimestamp: prev?.gpsTimestamp ?? fix.timestamp,
        smoothedCoords: prev?.smoothedCoords ?? coords,
        smoothedSpeedKmh: prev?.smoothedSpeedKmh ?? 0,
        accelerationKmhPerS: 0,
        provider: fix.provider,
        state: deriveBusState({
          speedKmh: prev?.speedKmh ?? 0,
          prevSpeedKmh: prev?.speedKmh ?? 0,
          accelerationKmhPerS: 0,
          hasRecentFix: false,
          providerIsGps: fix.provider === "GPS",
          locationAgeS,
          config: stateConfig,
        }),
        confidence: deriveConfidence(fix.accuracyM, locationAgeS, fix.provider, stateConfig),
        locationAgeS,
        deltaDistanceM: 0,
        deltaTimeS: 0,
        anomaly,
      },
      stopDetection: prev?.stopDetection ?? makeStopDetectionState(),
      reject: true,
    };
  }

  // 2. Compute distance + time delta
  const deltaTimeS = prev ? (fix.timestamp - prev.gpsTimestamp) / 1000 : 0;
  const deltaDistanceM = prev ? haversineMeters(prev.coords, coords) : 0;

  // 3. Compute speed (reconcile device vs delta)
  let speedKmh: number;
  let headingDeg: number | null = fix.headingDeg;
  if (prev && deltaTimeS > validatorConfig.minDeltaTimeS) {
    const deltaSpeed = msToKmh(deltaDistanceM / deltaTimeS);
    speedKmh = reconcileSpeed(
      fix.speedKmh,
      deltaSpeed,
      deltaDistanceM,
      validatorConfig.duplicateThresholdM
    );
    // Compute heading from delta if device didn't report
    if (headingDeg == null || Number.isNaN(headingDeg)) {
      if (deltaDistanceM > 5) {
        headingDeg = bearing(prev.coords, coords);
      } else {
        headingDeg = prev.headingDeg;
      }
    }
  } else {
    speedKmh = fix.speedKmh ?? 0;
    if (headingDeg == null || Number.isNaN(headingDeg)) headingDeg = prev?.headingDeg ?? null;
  }

  // 4. Smooth speed
  const smoothedSpeedKmh = smoother.push(speedKmh);

  // 5. Acceleration
  const accelerationKmhPerS =
    prev && deltaTimeS > 0
      ? (smoothedSpeedKmh - prev.smoothedSpeedKmh) / deltaTimeS
      : 0;

  // 6. Smoothed position (lerp a small step toward the new fix to filter jitter)
  const smoothedCoords = prev
    ? lerpCoord(prev.smoothedCoords, coords, 0.6)
    : coords;

  // 7. Location age + state
  const locationAgeS = (now - fix.timestamp) / 1000;
  const state = deriveBusState({
    speedKmh: smoothedSpeedKmh,
    prevSpeedKmh: prev?.smoothedSpeedKmh ?? 0,
    accelerationKmhPerS,
    hasRecentFix: locationAgeS < stateConfig.staleLocationS,
    providerIsGps: fix.provider === "GPS",
    locationAgeS,
    config: stateConfig,
  });

  const confidence = deriveConfidence(fix.accuracyM, locationAgeS, fix.provider, stateConfig);

  // 8. Stop detection
  const stopDetection = updateStopDetection(
    prev?.stopDetection ?? makeStopDetectionState(),
    smoothedSpeedKmh,
    coords,
    now,
    routeStops,
    stopConfig
  );

  return {
    telemetry: {
      busId: fix.busId,
      coords,
      speedKmh,
      headingDeg,
      accuracyM: fix.accuracyM ?? 50,
      altitudeM: fix.altitudeM,
      receivedAt: now,
      gpsTimestamp: fix.timestamp,
      smoothedCoords,
      smoothedSpeedKmh,
      accelerationKmhPerS,
      provider: fix.provider,
      state,
      confidence,
      locationAgeS,
      deltaDistanceM,
      deltaTimeS,
      anomaly: anomaly && !anomaly.reject ? anomaly : null,
    },
    stopDetection,
    reject: false,
  };
}
