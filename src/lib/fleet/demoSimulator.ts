"use client";

// Demo simulator — runs in the admin dashboard to "fake" live GPS positions
// for vehicles that aren't currently being driver-tracked via real GPS.
// Marked isSimulated: true so the UI can show the DEMO badge.

import { useEffect, useRef } from "react";
import { FLEET, getRouteStopsWithCoords, computeBusProgress } from "@/lib/ritians/fleet";
import { RIT_CAMPUS_COORDS, type Coord } from "@/lib/ritians/data";
import { haversineMeters, STOP_CROSSING_RADIUS_M, COLLEGE_ARRIVAL_RADIUS_M } from "@/lib/ritians/geo";
import type { VehicleLocationUpdate } from "@/lib/fleet/useFleetSocket";

interface DemoVehicle {
  vehicleId: string;
  vehicleNumber: string;
  vehicleName: string;
  routeNo: string;
  position: Coord;
  segIdx: number;
  progress: number;
  speed: number;
  heading: number;
  crossedStopSeqs: Set<number>;
  arrivedAtCollege: boolean;
}

const SIM_SPEED_KMH = 35;
const TICK_MS = 2000;

export function useDemoSimulator(opts: {
  enabled: boolean;
  vehicles: { id: string; vehicleNumber: string; vehicleName: string; routeNo: string; status: string }[];
  onTick: (update: VehicleLocationUpdate) => void;
  onStopCrossed: (vehicleId: string, routeNo: string, stopName: string, sequence: number, vehicleName: string, nextStop: { name: string; sequence: number; etaMinutes: number } | null) => void;
  onArrivedAtCollege: (vehicleId: string, vehicleName: string) => void;
}) {
  const demosRef = useRef<Map<string, DemoVehicle>>(new Map());
  const cbRef = useRef(opts);
  useEffect(() => { cbRef.current = opts; }, [opts]);

  useEffect(() => {
    if (!opts.enabled) return;
    // Initialize demo vehicles
    const demos = new Map<string, DemoVehicle>();
    for (const v of opts.vehicles) {
      const stops = getRouteStopsWithCoords(v.routeNo);
      if (stops.length === 0) continue;
      const startPos = stops[0].coords || RIT_CAMPUS_COORDS;
      demos.set(v.id, {
        vehicleId: v.id,
        vehicleNumber: v.vehicleNumber,
        vehicleName: v.vehicleName,
        routeNo: v.routeNo,
        position: startPos,
        segIdx: 0,
        progress: 0,
        speed: SIM_SPEED_KMH,
        heading: 0,
        crossedStopSeqs: new Set(),
        arrivedAtCollege: false,
      });
    }
    demosRef.current = demos;

    const tick = () => {
      const now = Date.now();
      for (const [id, d] of demos.entries()) {
        if (d.arrivedAtCollege) continue;
        const stops = getRouteStopsWithCoords(d.routeNo);
        if (stops.length < 2) continue;
        const coordsList = stops.map((s) => s.coords || RIT_CAMPUS_COORDS);

        // Don't simulate vehicles that are being driver-tracked (status === "tracking")
        const v = cbRef.current.vehicles.find((x) => x.id === id);
        if (v?.status === "tracking") continue;

        // Move forward
        const a = coordsList[d.segIdx];
        const b = coordsList[Math.min(d.segIdx + 1, coordsList.length - 1)];
        const segLen = haversineMeters(a, b); // meters
        // distance covered in TICK_MS at d.speed km/h
        const dist = (d.speed * 1000 / 3600) * (TICK_MS / 1000); // meters
        let remaining = dist;
        // Walk through segments until we exhaust `dist`
        let newSeg = d.segIdx;
        let newProg = d.progress;
        let newPos = d.position;
        while (remaining > 0 && newSeg < coordsList.length - 1) {
          const segA = coordsList[newSeg];
          const segB = coordsList[Math.min(newSeg + 1, coordsList.length - 1)];
          const segL = haversineMeters(segA, segB);
          const remainingInSeg = segL * (1 - newProg);
          if (remaining < remainingInSeg) {
            newProg = newProg + remaining / segL;
            newPos = lerpCoord(segA, segB, newProg);
            remaining = 0;
          } else {
            remaining -= remainingInSeg;
            newSeg += 1;
            newProg = 0;
            if (newSeg < coordsList.length - 1) {
              newPos = coordsList[newSeg];
            } else {
              // Arrived at last stop
              newPos = coordsList[coordsList.length - 1];
            }
          }
        }
        // If we hit the last stop, mark arrived
        if (newSeg >= coordsList.length - 1 && newProg >= 0.95) {
          d.arrivedAtCollege = true;
          d.position = coordsList[coordsList.length - 1];
          d.speed = 0;
          // Notify
          cbRef.current.onArrivedAtCollege(d.vehicleId, d.vehicleName);
          // After 10s, reset for the next day's "morning" trip
          setTimeout(() => {
            const stops2 = getRouteStopsWithCoords(d.routeNo);
            d.arrivedAtCollege = false;
            d.position = stops2[0]?.coords || RIT_CAMPUS_COORDS;
            d.segIdx = 0;
            d.progress = 0;
            d.crossedStopSeqs.clear();
            d.speed = SIM_SPEED_KMH;
          }, 10000);
          continue;
        }

        d.position = newPos;
        d.segIdx = newSeg;
        d.progress = newProg;

        // Vary speed slightly
        d.speed = SIM_SPEED_KMH + Math.sin(now / 30000 + id.charCodeAt(0)) * 8;
        // Heading: bearing from previous position to new position
        d.heading = bearingDeg(d.position, b);

        // Check stop crossings
        for (let i = 0; i < stops.length; i++) {
          if (d.crossedStopSeqs.has(i)) continue;
          const sc = stops[i].coords || RIT_CAMPUS_COORDS;
          const dist = haversineMeters(d.position, sc);
          if (dist < STOP_CROSSING_RADIUS_M) {
            d.crossedStopSeqs.add(i);
            const nextStopIdx = i + 1;
            const nextStop = nextStopIdx < stops.length
              ? {
                  name: stops[nextStopIdx].stop,
                  sequence: nextStopIdx,
                  coords: stops[nextStopIdx].coords || RIT_CAMPUS_COORDS,
                }
              : null;
            const etaMin = nextStop
              ? Math.max(1, Math.round(haversineMeters(d.position, nextStop.coords) / 1000 / (d.speed / 60)))
              : 0;
            cbRef.current.onStopCrossed(
              d.vehicleId,
              d.routeNo,
              stops[i].stop,
              i,
              d.vehicleName,
              nextStop ? { name: nextStop.name, sequence: nextStop.sequence, etaMinutes: etaMin } : null
            );
          }
        }

        // Compute progress
        const progress = computeBusProgress(d.routeNo, d.position, Array.from(d.crossedStopSeqs).map((s) => ({ stopName: stops[s].stop, sequence: s })));

        // Emit update
        const update: VehicleLocationUpdate = {
          vehicleId: d.vehicleId,
          vehicleNumber: d.vehicleNumber,
          vehicleName: d.vehicleName,
          routeNo: d.routeNo,
          latitude: d.position.lat,
          longitude: d.position.lng,
          accuracy: 15 + Math.random() * 5,
          speed: d.speed,
          heading: d.heading,
          isSimulated: true,
          timestamp: new Date().toISOString(),
          lastCrossedStop: progress.lastCrossed ? { name: progress.lastCrossed.name, sequence: progress.lastCrossed.sequence, crossedAt: now } : null,
          nextStop: progress.nextStop ? { name: progress.nextStop.name, sequence: progress.nextStop.sequence, etaMinutes: Math.max(1, Math.round(progress.nextStop.distanceMeters / 1000 / (d.speed / 60))), distanceMeters: progress.nextStop.distanceMeters } : null,
          progressPercent: progress.progressPercent,
        };
        cbRef.current.onTick(update);
      }
    };

    const id = setInterval(tick, TICK_MS);
    // Run once immediately
    tick();
    return () => clearInterval(id);
  }, [opts.enabled, opts.vehicles]);
}

function lerpCoord(a: Coord, b: Coord, t: number): Coord {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

function bearingDeg(a: Coord, b: Coord): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
