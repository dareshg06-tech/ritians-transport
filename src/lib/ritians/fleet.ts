// Fleet ↔ Route mapping for the 10 seeded vehicles
// Each vehicle has a route, and each route has boarding stops.
// For "Where Is My Bus" tracking, we use approximate stop coordinates.

import { routeStops, RIT_CAMPUS_COORDS, type Coord, type Stop } from "./data";

export interface FleetVehicle {
  id: string;        // database id — filled at runtime
  vehicleNumber: string;
  vehicleName: string;
  driverName: string;
  routeNo: string;
  destination: Coord; // main route destination coords
}

// Fleet ↔ Route mapping — auto-generated from the 52 routes
import { routes as ALL_ROUTES } from "./data";

export const FLEET: Omit<FleetVehicle, "id">[] = ALL_ROUTES.map((r, i) => ({
  vehicleNumber: `BUS-${String(i + 1).padStart(3, "0")}`,
  vehicleName: r.routeName,
  driverName: `Driver ${i + 1}`,
  routeNo: r.routeNo,
  destination: r.coords,
}));

/**
 * Get stop list for a route, with approximate coords for each stop.
 * The original routeStops didn't have coords for every stop, so we synthesize
 * linearly interpolated coords between the main destination and RIT Campus.
 * This is what powers "Where Is My Bus" — each stop has a known lat/lng.
 */
export function getRouteStopsWithCoords(routeNo: string): Stop[] {
  const stops = routeStops[routeNo] || [];
  if (stops.length === 0) return [];

  // Find the destination coords from FLEET
  const fleetEntry = FLEET.find((f) => f.routeNo === routeNo);
  const destCoords = fleetEntry?.destination || { lat: 13.0827, lng: 80.2707 }; // Chennai center

  // First stop is the route's main destination; last stop is RIT Campus.
  // Linearly interpolate coordinates for intermediate stops.
  return stops.map((s, i) => {
    if (s.coords) return { ...s, coords: s.coords };
    if (i === stops.length - 1) return { ...s, coords: RIT_CAMPUS_COORDS };
    // Interpolate from destination (i=0) to RIT Campus (i=last)
    const t = stops.length > 1 ? i / (stops.length - 1) : 0;
    return {
      ...s,
      coords: {
        lat: destCoords.lat + (RIT_CAMPUS_COORDS.lat - destCoords.lat) * t,
        lng: destCoords.lng + (RIT_CAMPUS_COORDS.lng - destCoords.lng) * t,
      },
    };
  });
}

/**
 * Determine which stop a vehicle is at or has just crossed, given its current position.
 * Returns { lastCrossed, nextStop, progressPercent }.
 *
 * - lastCrossed: the stop with the highest sequence that the vehicle has passed
 *   (i.e. is closer to RIT Campus than the stop's coords)
 * - nextStop: the next stop the vehicle is approaching
 * - progressPercent: 0..100 — fraction of distance covered from start to RIT Campus
 */
export function computeBusProgress(
  routeNo: string,
  currentPos: Coord,
  crossedStops: { stopName: string; sequence: number }[] = []
): {
  lastCrossed: { name: string; sequence: number; coords: Coord } | null;
  nextStop: { name: string; sequence: number; coords: Coord; etaMinutes: number; distanceMeters: number } | null;
  progressPercent: number;
  totalDistanceMeters: number;
  remainingDistanceMeters: number;
} {
  const stops = getRouteStopsWithCoords(routeNo);
  if (stops.length === 0) {
    return { lastCrossed: null, nextStop: null, progressPercent: 0, totalDistanceMeters: 0, remainingDistanceMeters: 0 };
  }

  const start = stops[0];
  const end = stops[stops.length - 1];
  const startCoords = start.coords || RIT_CAMPUS_COORDS;
  const endCoords = end.coords || RIT_CAMPUS_COORDS;

  // Haversine
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const hav = (a: Coord, b: Coord) => {
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const totalDist = hav(startCoords, endCoords);
  const remaining = hav(currentPos, endCoords);
  const progressPercent = totalDist > 0 ? Math.max(0, Math.min(100, ((totalDist - remaining) / totalDist) * 100)) : 0;

  // Find last crossed stop (highest sequence whose coords are "behind" the current position
  // along the path from start to end). Use a simple heuristic: a stop is "crossed" if
  // hav(currentPos, endCoords) < hav(stopCoords, endCoords), meaning we're closer to RIT
  // than that stop is.
  let lastCrossedIdx = -1;
  for (let i = 0; i < stops.length; i++) {
    const sc = stops[i].coords || RIT_CAMPUS_COORDS;
    if (hav(currentPos, endCoords) < hav(sc, endCoords) - 30) {
      // We're past stop i
      lastCrossedIdx = i;
    }
  }
  // But also respect crossings the DB has recorded (they may have been crossed before
  // but the bus is between them now due to GPS jitter)
  if (crossedStops.length > 0) {
    const maxSeqCrossed = Math.max(...crossedStops.map((c) => c.sequence));
    if (maxSeqCrossed > lastCrossedIdx) lastCrossedIdx = maxSeqCrossed;
  }

  const lastCrossed = lastCrossedIdx >= 0
    ? {
        name: stops[lastCrossedIdx].stop,
        sequence: lastCrossedIdx,
        coords: stops[lastCrossedIdx].coords || RIT_CAMPUS_COORDS,
      }
    : null;

  const nextStopIdx = lastCrossedIdx + 1;
  const nextStop = nextStopIdx < stops.length
    ? {
        name: stops[nextStopIdx].stop,
        sequence: nextStopIdx,
        coords: stops[nextStopIdx].coords || RIT_CAMPUS_COORDS,
        distanceMeters: hav(currentPos, stops[nextStopIdx].coords || RIT_CAMPUS_COORDS),
        etaMinutes: 0, // filled in by caller using speed
      }
    : null;

  return {
    lastCrossed,
    nextStop,
    progressPercent,
    totalDistanceMeters: totalDist,
    remainingDistanceMeters: remaining,
  };
}
