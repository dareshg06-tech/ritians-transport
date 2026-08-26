// Geo utilities — Haversine distance, ETA calculation, bearing
import type { Coord } from "./data";

export function haversineMeters(a: Coord, b: Coord): number {
  const R = 6371000; // Earth radius (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearingDeg(a: Coord, b: Coord): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatDuration(min: number): string {
  if (min < 1) return "<1 min";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

export function timeAgo(date: Date | number): string {
  const ts = typeof date === "number" ? date : date.getTime();
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  return `${h}h ago`;
}

// STATUS_OFFLINE_TIMEOUT_MS — no update for 2 minutes → offline
export const OFFLINE_TIMEOUT_MS = 2 * 60 * 1000;
// STOP_CROSSING_RADIUS_M — bus is "at" a stop when within 100m
export const STOP_CROSSING_RADIUS_M = 150;
// RIT_CAMPUS arrival radius — bus has "arrived at college" when within 200m
export const COLLEGE_ARRIVAL_RADIUS_M = 200;

export function statusFromLastSeen(lastSeenAt: Date | null | undefined, speed: number | null | undefined): "live" | "idle" | "offline" {
  if (!lastSeenAt) return "offline";
  const age = Date.now() - lastSeenAt.getTime();
  if (age > OFFLINE_TIMEOUT_MS) return "offline";
  if ((speed ?? 0) > 1) return "live";
  return "idle";
}
