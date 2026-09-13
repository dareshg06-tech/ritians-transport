// ============================================================================
// physicsSimulator.ts — Realistic Bus GPS Simulator
// ============================================================================
// Replaces the kinematic-only demoSimulator.ts with a physics-based model
// that produces realistic telemetry: acceleration, cruising, deceleration,
// stops at intersections, GPS noise, GPS loss/recovery, and network latency.
//
// The simulator is ONLY for development/testing. Production consumes actual
// bus telemetry from real GPS devices.
//
// Output: RawGpsFix objects ready to feed into processTelemetry() / POST /api/locations
// ============================================================================

import {
  type Coord,
  haversineMeters,
  bearing,
  lerpCoord,
  kmhToMs,
  msToKmh,
  type RawGpsFix,
} from "./physics";
import { getRouteStopsWithCoords } from "@/lib/ritians/fleet";
import { RIT_CAMPUS_COORDS } from "@/lib/ritians/data";

// ============================================================================
// Simulator phases — the bus cycles through these as it travels the route
// ============================================================================

export type SimulatorPhase =
  | "STOPPED_AT_ORIGIN"
  | "ACCELERATING"
  | "CRUISING"
  | "DECELERATING"
  | "STOPPED_AT_INTERSECTION"
  | "TURNING"
  | "ARRIVED_AT_CAMPUS"
  | "GPS_LOSS"
  | "NETWORK_FALLBACK";

export interface SimulatorConfig {
  /** Target cruising speed in km/h. */
  targetSpeedKmh: number;
  /** Acceleration in km/h per second. */
  accelerationKmhPerS: number;
  /** Deceleration in km/h per second (positive value, applied as negative). */
  decelerationKmhPerS: number;
  /** Max speed on turns (km/h). */
  turnSpeedKmh: number;
  /** Initial stop duration at origin (s). */
  initialStopS: number;
  /** Intersection stop duration (s). */
  intersectionStopS: number;
  /** GPS noise standard deviation (metres). */
  gpsNoiseStdM: number;
  /** Probability of GPS loss per tick. */
  gpsLossProbability: number;
  /** GPS loss duration (s) when triggered. */
  gpsLossDurationS: number;
  /** Tick interval (ms). */
  tickMs: number;
}

export const DEFAULT_SIMULATOR_CONFIG: SimulatorConfig = {
  targetSpeedKmh: 30,
  accelerationKmhPerS: 8, // 0-30 in ~4s (realistic for a city bus)
  decelerationKmhPerS: 10,
  turnSpeedKmh: 15,
  initialStopS: 3,
  intersectionStopS: 5,
  gpsNoiseStdM: 3,
  gpsLossProbability: 0.002, // ~once every 500 ticks (~8 minutes)
  gpsLossDurationS: 8,
  tickMs: 1000,
};

// ============================================================================
// Simulator state — one per bus
// ============================================================================

export interface SimulatorState {
  busId: string;
  routeNo: string;
  vehicleNumber: string;
  vehicleName: string;
  /** Full route as a list of coords (stops with coords, ending at RIT Campus). */
  routeCoords: Coord[];
  /** Stop names (parallel to routeCoords). */
  routeStopNames: string[];
  /** Current segment index (0 = between stop 0 and stop 1). */
  segIdx: number;
  /** Progress along current segment [0, 1]. */
  segProgress: number;
  /** Current speed in km/h. */
  speedKmh: number;
  /** Current heading in degrees. */
  headingDeg: number;
  /** Current phase. */
  phase: SimulatorPhase;
  /** Phase entered at (ms). */
  phaseStartTs: number;
  /** Position (smoothed). */
  coords: Coord;
  /** GPS loss active until (ms). 0 = no loss. */
  gpsLossUntil: number;
  /** Whether the simulator is paused. */
  paused: boolean;
  /** Provider override during GPS loss. */
  provider: string;
  /** Total distance travelled (m). */
  totalDistanceM: number;
  /** Recent speeds for average calculation (last 30 entries). */
  speedHistory: number[];
}

// ============================================================================
// Initialize a simulator for a bus + route
// ============================================================================

export function initSimulator(
  busId: string,
  routeNo: string,
  vehicleNumber: string,
  vehicleName: string,
  config: SimulatorConfig = DEFAULT_SIMULATOR_CONFIG
): SimulatorState | null {
  const stops = getRouteStopsWithCoords(routeNo);
  if (stops.length < 2) return null;

  const routeCoords: Coord[] = stops.map((s) => s.coords || RIT_CAMPUS_COORDS);
  // Ensure the last stop is RIT Campus
  routeCoords[routeCoords.length - 1] = RIT_CAMPUS_COORDS;
  const routeStopNames = stops.map((s) => s.stop);

  const startPos = routeCoords[0];
  const secondPos = routeCoords[1];
  const initialHeading = bearing(startPos, secondPos);

  return {
    busId,
    routeNo,
    vehicleNumber,
    vehicleName,
    routeCoords,
    routeStopNames,
    segIdx: 0,
    segProgress: 0,
    speedKmh: 0,
    headingDeg: initialHeading,
    phase: "STOPPED_AT_ORIGIN",
    phaseStartTs: Date.now(),
    coords: startPos,
    gpsLossUntil: 0,
    paused: false,
    provider: "SIMULATED",
    totalDistanceM: 0,
    speedHistory: [],
  };
}

// ============================================================================
// Tick — advance the simulator by one tick and produce a RawGpsFix
// ============================================================================

/**
 * Advance the simulator by one tick. Returns the next RawGpsFix, or null
 * if the simulator is paused or has arrived at the destination.
 */
export function tickSimulator(
  state: SimulatorState,
  config: SimulatorConfig = DEFAULT_SIMULATOR_CONFIG
): RawGpsFix | null {
  if (state.paused) return null;

  const now = Date.now();
  const dt = config.tickMs / 1000; // seconds

  // Check GPS loss recovery
  if (state.gpsLossUntil > 0 && now >= state.gpsLossUntil) {
    state.gpsLossUntil = 0;
    state.provider = "SIMULATED";
    state.phase = "ACCELERATING";
    state.phaseStartTs = now;
  }

  // Random GPS loss
  if (state.gpsLossUntil === 0 && Math.random() < config.gpsLossProbability) {
    state.gpsLossUntil = now + config.gpsLossDurationS * 1000;
    state.phase = "GPS_LOSS";
    state.phaseStartTs = now;
    state.provider = "SIMULATED";
  }

  // During GPS loss, emit no fix (caller will see null)
  if (state.phase === "GPS_LOSS") {
    return null;
  }

  // Phase machine
  switch (state.phase) {
    case "STOPPED_AT_ORIGIN": {
      if (now - state.phaseStartTs >= config.initialStopS * 1000) {
        state.phase = "ACCELERATING";
        state.phaseStartTs = now;
      }
      state.speedKmh = 0;
      break;
    }

    case "ACCELERATING": {
      state.speedKmh = Math.min(
        config.targetSpeedKmh,
        state.speedKmh + config.accelerationKmhPerS * dt
      );
      if (state.speedKmh >= config.targetSpeedKmh) {
        state.phase = "CRUISING";
        state.phaseStartTs = now;
      }
      break;
    }

    case "CRUISING": {
      // Vary speed slightly for realism
      const variation = Math.sin(now / 8000) * 3;
      state.speedKmh = Math.max(
        0,
        Math.min(config.targetSpeedKmh + variation, config.targetSpeedKmh * 1.1)
      );

      // Check if approaching a stop (within 200m) → decelerate
      const nextStopIdx = state.segIdx + 1;
      if (nextStopIdx < state.routeCoords.length) {
        const nextStop = state.routeCoords[nextStopIdx];
        const distToStop = haversineMeters(state.coords, nextStop);
        if (distToStop < 200 && nextStopIdx < state.routeCoords.length - 1) {
          state.phase = "DECELERATING";
          state.phaseStartTs = now;
        }
      }

      // Check if at campus (last segment)
      if (state.segIdx >= state.routeCoords.length - 2 && state.segProgress > 0.8) {
        state.phase = "DECELERATING";
        state.phaseStartTs = now;
      }
      break;
    }

    case "DECELERATING": {
      state.speedKmh = Math.max(
        0,
        state.speedKmh - config.decelerationKmhPerS * dt
      );
      if (state.speedKmh <= 0) {
        // Stopped — decide what to do next
        const atCampus =
          state.segIdx >= state.routeCoords.length - 2 &&
          state.segProgress >= 0.95;
        if (atCampus) {
          state.phase = "ARRIVED_AT_CAMPUS";
          state.phaseStartTs = now;
          state.speedKmh = 0;
        } else {
          state.phase = "STOPPED_AT_INTERSECTION";
          state.phaseStartTs = now;
          state.speedKmh = 0;
        }
      }
      break;
    }

    case "STOPPED_AT_INTERSECTION": {
      if (now - state.phaseStartTs >= config.intersectionStopS * 1000) {
        state.phase = "ACCELERATING";
        state.phaseStartTs = now;
      }
      state.speedKmh = 0;
      break;
    }

    case "ARRIVED_AT_CAMPUS": {
      state.speedKmh = 0;
      // The caller should reset/restart the simulator at this point
      break;
    }

    case "TURNING": {
      // Turns are handled inline (see movement application below)
      break;
    }
  }

  // Apply movement based on current speed
  if (state.speedKmh > 0) {
    const distanceM = kmhToMs(state.speedKmh) * dt;
    state.totalDistanceM += distanceM;

    // Walk along the route, consuming distance
    let remaining = distanceM;
    while (remaining > 0 && state.segIdx < state.routeCoords.length - 1) {
      const segStart = state.routeCoords[state.segIdx];
      const segEnd = state.routeCoords[state.segIdx + 1];
      const segLen = haversineMeters(segStart, segEnd);
      if (segLen < 1) {
        state.segIdx++;
        state.segProgress = 0;
        continue;
      }
      const remainingOnSeg = (1 - state.segProgress) * segLen;
      if (remaining >= remainingOnSeg) {
        // Cross to next segment
        remaining -= remainingOnSeg;
        state.segIdx++;
        state.segProgress = 0;
        // Recompute heading for new segment
        if (state.segIdx < state.routeCoords.length - 1) {
          const newStart = state.routeCoords[state.segIdx];
          const newEnd = state.routeCoords[state.segIdx + 1];
          state.headingDeg = bearing(newStart, newEnd);
          // If heading change > 30°, enter TURNING phase briefly
          const headingDelta = Math.abs(
            ((state.headingDeg - (state.headingDeg || 0) + 540) % 360) - 180
          );
          if (headingDelta > 30 && state.phase !== "TURNING") {
            state.phase = "TURNING";
            state.phaseStartTs = now;
          }
        }
      } else {
        // Advance progress on current segment
        state.segProgress += remaining / segLen;
        remaining = 0;
        // Update position
        state.coords = lerpCoord(segStart, segEnd, state.segProgress);
        // Update heading gradually
        const newHeading = bearing(segStart, segEnd);
        // Smooth heading change
        const delta = ((newHeading - state.headingDeg + 540) % 360) - 180;
        state.headingDeg = (state.headingDeg + delta * 0.2 + 360) % 360;
      }
    }
  }

  // Update speed history (for average)
  state.speedHistory.push(state.speedKmh);
  if (state.speedHistory.length > 30) state.speedHistory.shift();

  // Apply GPS noise to the reported position (not the internal state.coords)
  const noiseLat = (Math.random() - 0.5) * 2 * config.gpsNoiseStdM / 111000;
  const noiseLng =
    (Math.random() - 0.5) *
    2 *
    config.gpsNoiseStdM /
    (111000 * Math.cos((state.coords.lat * Math.PI) / 180));

  return {
    busId: state.busId,
    latitude: state.coords.lat + noiseLat,
    longitude: state.coords.lng + noiseLng,
    speedKmh: state.speedKmh,
    headingDeg: state.headingDeg,
    accuracyM: 3 + Math.random() * 2,
    altitudeM: 30 + Math.random() * 10,
    timestamp: now,
    provider: state.provider,
  };
}

// ============================================================================
// Helper: reset simulator after arriving at campus
// ============================================================================

export function resetSimulator(state: SimulatorState): void {
  state.segIdx = 0;
  state.segProgress = 0;
  state.speedKmh = 0;
  state.phase = "STOPPED_AT_ORIGIN";
  state.phaseStartTs = Date.now();
  state.coords = state.routeCoords[0];
  state.gpsLossUntil = 0;
  state.totalDistanceM = 0;
  state.speedHistory = [];
}

// ============================================================================
// React hook: usePhysicsSimulator — drives multiple buses simultaneously
// ============================================================================

import { useEffect, useRef, useState, useCallback } from "react";
import type { ProcessedTelemetry, PipelinePrev } from "./physics";
import { processTelemetry, SpeedSmoother, makeStopDetectionState } from "./physics";

export interface SimulatedBus {
  state: SimulatorState;
  smoother: SpeedSmoother;
  prev: PipelinePrev | null;
  telemetry: ProcessedTelemetry | null;
}

export interface UsePhysicsSimulatorOptions {
  /** Buses to simulate: [{ busId, routeNo, vehicleNumber, vehicleName }]. */
  buses: Array<{
    busId: string;
    routeNo: string;
    vehicleNumber: string;
    vehicleName: string;
  }>;
  /** Configuration. */
  config?: SimulatorConfig;
  /** Called when a new telemetry is produced. */
  onTelemetry?: (busId: string, telemetry: ProcessedTelemetry) => void;
  /** Called when a bus arrives at campus. */
  onArrived?: (busId: string) => void;
  /** Whether the simulator is enabled. */
  enabled: boolean;
}

export function usePhysicsSimulator({
  buses,
  config = DEFAULT_SIMULATOR_CONFIG,
  onTelemetry,
  onArrived,
  enabled,
}: UsePhysicsSimulatorOptions) {
  const simsRef = useRef<Map<string, SimulatedBus>>(new Map());
  const onTelemetryRef = useRef(onTelemetry);
  const onArrivedRef = useRef(onArrived);
  useEffect(() => {
    onTelemetryRef.current = onTelemetry;
  }, [onTelemetry]);
  useEffect(() => {
    onArrivedRef.current = onArrived;
  }, [onArrived]);

  // Initialize / refresh simulators when buses change
  useEffect(() => {
    const map = simsRef.current;
    // Remove simulators for buses no longer in the list
    for (const [id, sim] of map.entries()) {
      if (!buses.find((b) => b.busId === id)) {
        map.delete(id);
      }
    }
    // Add simulators for new buses
    for (const b of buses) {
      if (!map.has(b.busId)) {
        const state = initSimulator(b.busId, b.routeNo, b.vehicleNumber, b.vehicleName, config);
        if (state) {
          map.set(b.busId, {
            state,
            smoother: new SpeedSmoother(3),
            prev: null,
            telemetry: null,
          });
        }
      }
    }
  }, [buses, config]);

  // Tick loop
  useEffect(() => {
    if (!enabled) return;
    const tickFn = () => {
      const now = Date.now();
      for (const [busId, sim] of simsRef.current.entries()) {
        const fix = tickSimulator(sim.state, config);
        if (!fix) continue; // paused or GPS loss

        // Get route stops for stop detection
        const stops = sim.state.routeStopNames.map((name, i) => ({
          stop: name,
          coords: sim.state.routeCoords[i],
        }));

        const result = processTelemetry(
          fix,
          sim.prev,
          stops,
          sim.smoother,
          now
        );

        if (!result.reject) {
          sim.prev = {
            coords: result.telemetry.coords,
            smoothedCoords: result.telemetry.smoothedCoords,
            smoothedSpeedKmh: result.telemetry.smoothedSpeedKmh,
            speedKmh: result.telemetry.speedKmh,
            headingDeg: result.telemetry.headingDeg,
            accuracyM: result.telemetry.accuracyM,
            gpsTimestamp: result.telemetry.gpsTimestamp,
            receivedAt: result.telemetry.receivedAt,
            stopDetection: result.stopDetection,
          };
          sim.telemetry = result.telemetry;
          onTelemetryRef.current?.(busId, result.telemetry);
        }

        // Check arrival
        if (sim.state.phase === "ARRIVED_AT_CAMPUS") {
          onArrivedRef.current?.(busId);
          resetSimulator(sim.state);
        }
      }
    };

    const id = setInterval(tickFn, config.tickMs);
    return () => clearInterval(id);
  }, [enabled, config]);

  // Control functions
  const pause = useCallback((busId?: string) => {
    if (busId) {
      const sim = simsRef.current.get(busId);
      if (sim) sim.state.paused = true;
    } else {
      for (const sim of simsRef.current.values()) sim.state.paused = true;
    }
  }, []);

  const resume = useCallback((busId?: string) => {
    if (busId) {
      const sim = simsRef.current.get(busId);
      if (sim) sim.state.paused = false;
    } else {
      for (const sim of simsRef.current.values()) sim.state.paused = false;
    }
  }, []);

  const stop = useCallback((busId?: string) => {
    if (busId) {
      simsRef.current.delete(busId);
    } else {
      simsRef.current.clear();
    }
  }, []);

  const simulateGpsLoss = useCallback((busId: string, durationS?: number) => {
    const sim = simsRef.current.get(busId);
    if (!sim) return;
    const dur = durationS ?? config.gpsLossDurationS;
    sim.state.gpsLossUntil = Date.now() + dur * 1000;
    sim.state.phase = "GPS_LOSS";
    sim.state.phaseStartTs = Date.now();
  }, [config.gpsLossDurationS]);

  const simulateGpsRecovery = useCallback((busId: string) => {
    const sim = simsRef.current.get(busId);
    if (!sim) return;
    sim.state.gpsLossUntil = 0;
    sim.state.phase = "ACCELERATING";
    sim.state.phaseStartTs = Date.now();
  }, []);

  const getTelemetry = useCallback(() => {
    const result = new Map<string, ProcessedTelemetry>();
    for (const [id, sim] of simsRef.current.entries()) {
      if (sim.telemetry) result.set(id, sim.telemetry);
    }
    return result;
  }, []);

  const getStates = useCallback(() => {
    const result = new Map<string, SimulatorState>();
    for (const [id, sim] of simsRef.current.entries()) {
      result.set(id, sim.state);
    }
    return result;
  }, []);

  return {
    pause,
    resume,
    stop,
    simulateGpsLoss,
    simulateGpsRecovery,
    getTelemetry,
    getStates,
  };
}
