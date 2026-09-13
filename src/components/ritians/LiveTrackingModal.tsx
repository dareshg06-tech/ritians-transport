"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { routes as ALL_ROUTES, routeStops, RIT_CAMPUS_COORDS, type Coord } from "@/lib/ritians/data";
import { getRouteStopsWithCoords } from "@/lib/ritians/fleet";
import { snapToRoute, type RouteSnapResult } from "@/lib/fleet/physics";
import { useToast } from "@/lib/ritians/toast";

interface LiveTrackingPageProps {
  onBack: () => void;
}

// Load Leaflet map client-side only
const FleetMap = dynamic(() => import("../fleet/FleetMap.client").then((m) => m.FleetMap), {
  ssr: false,
  loading: () => (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 12 }}>
      <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} /> Loading map…
    </div>
  ),
}) as typeof import("../fleet/FleetMap.client").FleetMap;
type MapVehicle = import("../fleet/FleetMap.client").MapVehicle;

// ============================================================================
// Helpers
// ============================================================================
function lerp(a: Coord, b: Coord, t: number): Coord {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}
function haversineDist(a: Coord, b: Coord): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const TRACKED_ROUTE_NOS = ALL_ROUTES.map((r) => r.routeNo);

interface BusPosition {
  routeNo: string;
  routeName: string;
  no: number;
  coords: Coord;
  progress: number;
  segIdx: number;
  speed: number;
}

function initialBuses(): BusPosition[] {
  return TRACKED_ROUTE_NOS.map((rno) => {
    const r = ALL_ROUTES.find((x) => x.routeNo === rno)!;
    // Use getRouteStopsWithCoords so the first stop has the route's actual
    // starting coordinates (not undefined fallback to r.coords).
    const stops = getRouteStopsWithCoords(rno);
    const firstStop = stops[0];
    const startCoords = firstStop?.coords || r.coords;
    return { routeNo: r.routeNo, routeName: r.routeName, no: r.no, coords: startCoords, progress: 0, segIdx: 0, speed: 35 };
  });
}

// Compute duration label from the live tracking site: e.g. "1h 35m", "45 min"
function routeDurationLabel(routeNo: string): string {
  // Map derived from the live tracking site's static data — falls back to haversine-based estimate
  const DURATIONS: Record<string, string> = {
    R01: "1h 35m", R01A: "1h 15m", R01B: "1h 5m", R02: "1h 0m", R03: "1h 5m",
    R03A: "40 min", R03B: "40 min", R04: "35 min", R05: "55 min", R05A: "50 min",
    R06: "28 min", R07: "1h 5m", R08: "55 min", R08A: "50 min", R09: "1h 15m",
    R10: "1h 20m", R11: "1h 50m", R11A: "1h 30m", R12: "1h 55m", R13: "1h 10m",
    R13A: "1h 5m", R14: "1h 15m", R14B: "1h 20m", R15: "2h 40m", R15A: "2h 5m",
    R15B: "1h 55m", R16: "1h 5m", R16B: "1h 15m", R17: "55 min", R17A: "32 min",
    R18: "55 min", R18A: "1h 0m", R18B: "1h 25m", R19: "5h 20m", R19A: "1h 8m",
    R20: "45 min", R20A: "40 min", R21: "28 min", R22: "2h 10m", R22A: "2h 50m",
    R23: "1h 0m", R24: "3h 10m", R25: "35 min", R25A: "32 min", R26: "2h 0m",
    R26A: "18 min", R27: "32 min", R27A: "45 min", R28: "1h 8m", R29: "1h 0m",
    R29A: "45 min", R29B: "40 min",
  };
  return DURATIONS[routeNo] || "—";
}

// Static distance from the live tracking site (km)
function routeDistanceKm(routeNo: string): string {
  const DIST: Record<string, string> = {
    R01: "45.0", R01A: "35.0", R01B: "30.0", R02: "28.0", R03: "30.0",
    R03A: "18.0", R03B: "18.0", R04: "16.0", R05: "25.0", R05A: "22.0",
    R06: "12.0", R07: "30.0", R08: "25.0", R08A: "22.0", R09: "35.0",
    R10: "38.0", R11: "55.0", R11A: "45.0", R12: "55.0", R13: "32.0",
    R13A: "30.0", R14: "35.0", R14B: "38.0", R15: "95.0", R15A: "70.0",
    R15B: "65.0", R16: "30.0", R16B: "35.0", R17: "25.0", R17A: "14.0",
    R18: "25.0", R18A: "28.0", R18B: "40.0", R19: "230.0", R19A: "32.0",
    R20: "20.0", R20A: "18.0", R21: "12.0", R22: "75.0", R22A: "100.0",
    R23: "28.0", R24: "115.0", R25: "15.0", R25A: "14.0", R26: "65.0",
    R26A: "7.0", R27: "14.0", R27A: "20.0", R28: "32.0", R29: "28.0",
    R29A: "20.0", R29B: "18.0",
  };
  return DIST[routeNo] || "—";
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

// ============================================================================
// Driver Mode (inlined GPS portal logic, redesigned to match the live tracking site)
// ============================================================================
interface DriverGPSData {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  timestamp: number;
}

function useVehicleIdMap() {
  const [routeToVehicleId, setRouteToVehicleId] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/vehicles")
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, string> = {};
        for (const v of data.vehicles || []) {
          if (v.routeNo) map[v.routeNo] = v.id;
        }
        setRouteToVehicleId(map);
      })
      .catch(() => {});
  }, []);
  return routeToVehicleId;
}

function DriverModePanel({
  driverPositions,
  tick,
  isMobile = false,
}: {
  driverPositions: Record<string, { coords: Coord; speed: number; heading: number | null; timestamp: number }>;
  tick: number;
  isMobile?: boolean;
}) {
  const { show } = useToast();
  const routeToVehicleId = useVehicleIdMap();
  const [selectedRoute, setSelectedRoute] = useState("");
  const [sharing, setSharing] = useState(false);
  const [gps, setGps] = useState<DriverGPSData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [positionSource, setPositionSource] = useState<"gps" | "network">("gps");
  const [tripStartTime, setTripStartTime] = useState<number | null>(null);
  const [usingSimulated, setUsingSimulated] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segIdxRef = useRef(0);
  const progRef = useRef(0);

  const vehicle = ALL_ROUTES.find((r) => r.routeNo === selectedRoute);
  const dbVehicleId = routeToVehicleId[selectedRoute] || null;

  const postLocation = (data: DriverGPSData, isSim: boolean) => {
    if (!dbVehicleId) return;
    fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId: dbVehicleId,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        speed: data.speed,
        heading: data.heading,
        altitude: data.altitude,
        isSimulated: isSim,
      }),
    }).catch(() => {});
  };

  // Track previous positions so we can compute heading + speed from delta.
  // We keep the last 3 fixes so we can smooth the speed value (rolling average)
  // — this prevents the displayed value from jumping erratically between fixes.
  const lastPosRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const recentSpeedsRef = useRef<number[]>([]);
  const lastUpdateTsRef = useRef<number>(0);

  const handlePosition = (pos: GeolocationPosition) => {
    // Throttle: ignore fixes that arrive less than 500ms after the previous one
    // (devices sometimes fire multiple fixes in rapid succession with stale data)
    if (pos.timestamp - lastUpdateTsRef.current < 500 && lastUpdateTsRef.current > 0) {
      return;
    }
    lastUpdateTsRef.current = pos.timestamp;

    const prev = lastPosRef.current;
    let speed: number;
    let heading: number | null = pos.coords.heading;

    if (prev) {
      const dt = (pos.timestamp - prev.t) / 1000; // seconds
      // Haversine distance between prev and current
      const R = 6371000;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(pos.coords.latitude - prev.lat);
      const dLng = toRad(pos.coords.longitude - prev.lng);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(prev.lat)) * Math.cos(toRad(pos.coords.latitude)) * Math.sin(dLng / 2) ** 2;
      const dist = 2 * R * Math.asin(Math.sqrt(h));

      // Always compute speed from the position delta — this is MORE accurate
      // than pos.coords.speed, which is often null on desktops/laptops and
      // can be inaccurate on mobile. We cross-check with pos.coords.speed
      // (when reported) and prefer the higher of the two when both indicate
      // movement (this filters out false "stationary" readings).
      let computedSpeed = 0;
      if (dt > 0) {
        // m/s → km/h, clamp to a realistic 0-80 km/h bus range
        computedSpeed = Math.min(80, Math.max(0, (dist / dt) * 3.6));
      }
      const deviceSpeed = pos.coords.speed != null && !Number.isNaN(pos.coords.speed)
        ? Math.max(0, pos.coords.speed * 3.6)
        : 0;

      if (dist < 2.5) {
        // GPS jitter — bus is effectively stationary. Don't let small position
        // wobble (±2.5m) register as speed.
        speed = 0;
      } else if (deviceSpeed > 1 && computedSpeed > 0.5) {
        // Both readings indicate movement — trust the higher one (devices
        // often under-report speed due to smoothing on their end)
        speed = Math.max(deviceSpeed, computedSpeed);
      } else if (computedSpeed > 0.5) {
        // Device didn't report speed but we have delta-based movement
        speed = computedSpeed;
      } else if (deviceSpeed > 1) {
        // Only device reported movement (delta too small to compute reliably)
        speed = deviceSpeed;
      } else {
        speed = 0;
      }

      // Computed heading from prev → current (only if bus has moved enough
      // to make the heading meaningful — otherwise keep previous heading)
      if ((heading == null || Number.isNaN(heading)) && dist > 5) {
        const hRad = Math.atan2(pos.coords.longitude - prev.lng, pos.coords.latitude - prev.lat);
        heading = hRad * 180 / Math.PI;
        if (heading < 0) heading += 360;
      } else if (heading == null || Number.isNaN(heading)) {
        heading = null;
      }
    } else {
      // First fix — no previous position, fall back to device speed
      speed = pos.coords.speed != null && !Number.isNaN(pos.coords.speed)
        ? Math.max(0, pos.coords.speed * 3.6)
        : 0;
      if (heading == null || Number.isNaN(heading)) heading = null;
    }

    // Smooth the speed value with a rolling average of the last 3 fixes.
    // This prevents the displayed number from jumping 18 → 35 → 22 between
    // consecutive fixes (which looks unrealistic and confusing).
    const smoothedSpeeds = [...recentSpeedsRef.current, speed].slice(-3);
    recentSpeedsRef.current = smoothedSpeeds;
    const smoothedSpeed = smoothedSpeeds.reduce((a, b) => a + b, 0) / smoothedSpeeds.length;

    lastPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: pos.timestamp };

    const data: DriverGPSData = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      speed: smoothedSpeed,
      heading,
      altitude: pos.coords.altitude,
      timestamp: pos.timestamp,
    };
    setGps(data);
    setError(null);
    setUsingSimulated(false);
    postLocation(data, false);
  };

  const handleError = (err: GeolocationPositionError) => {
    let msg = "";
    if (err.code === 1) msg = "Location permission denied. Using simulated GPS data.";
    else if (err.code === 2) msg = "GPS signal unavailable. Using simulated GPS data.";
    else if (err.code === 3) msg = "GPS request timed out. Using simulated GPS data.";
    else msg = err.message;
    setError(msg);
    setUsingSimulated(true);
    startSimulatedGPS();
  };

  const startSimulatedGPS = () => {
    if (!vehicle) return;
    // Use getRouteStopsWithCoords so each stop has interpolated coordinates
    // between the route's main destination and RIT Campus. Without this, all
    // stops fall back to the route's main coords and the bus appears stuck.
    const stops = getRouteStopsWithCoords(vehicle.routeNo);
    if (stops.length < 2) return;
    const coordsList: Coord[] = stops.map((s) => s.coords || vehicle.coords);
    coordsList[coordsList.length - 1] = RIT_CAMPUS_COORDS;
    segIdxRef.current = 0;
    progRef.current = 0;

    const startPos = coordsList[0];
    const initialData: DriverGPSData = {
      latitude: startPos.lat,
      longitude: startPos.lng,
      accuracy: 3, // High accuracy simulated GPS — ±3m (was 8)
      speed: 0,
      heading: null,
      altitude: 30,
      timestamp: Date.now(),
    };
    setGps(initialData);
    postLocation(initialData, true);

    setTimeout(() => {
      // Track previous simulated position so we can compute the actual speed
      // from the distance moved per tick (rather than just a sine wave).
      // Initialize with the starting position so the first delta isn't huge.
      let prevSimPos: { lat: number; lng: number; t: number } = { lat: startPos.lat, lng: startPos.lng, t: Date.now() };
      let prevTickTime = Date.now();
      // Target speed for the simulated bus (km/h). We compute the progress
      // per tick dynamically based on the segment length so the bus always
      // moves at ~25 km/h regardless of whether the segment is 1km or 10km.
      const TARGET_SPEED_KMH = 25;
      // Update every 1 second (was 2s) — smoother movement, more "real-time" feel
      simIntervalRef.current = setInterval(() => {
        const segIdx = segIdxRef.current;
        const a = coordsList[segIdxRef.current];
        const b = coordsList[Math.min(segIdxRef.current + 1, coordsList.length - 1)];

        // Compute the segment length in meters
        const R = 6371000;
        const toRad = (d: number) => (d * Math.PI) / 180;
        const segDLat = toRad(b.lat - a.lat);
        const segDLng = toRad(b.lng - a.lng);
        const segH = Math.sin(segDLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(segDLng / 2) ** 2;
        const segLen = 2 * R * Math.asin(Math.sqrt(segH)); // meters

        // Compute progress per tick so the bus moves at ~25 km/h:
        // distance_per_tick = TARGET_SPEED_KMH * 1000 / 3600 * dt = ~6.94 m/s
        // progress_per_tick = distance_per_tick / segLen
        const now = Date.now();
        const dt = Math.max(0.1, (now - prevTickTime) / 1000); // seconds, min 0.1s
        prevTickTime = now;
        const distancePerTick = (TARGET_SPEED_KMH * 1000 / 3600) * dt; // meters
        const progressPerTick = segLen > 0 ? distancePerTick / segLen : 0.015;

        // Add gentle variation in speed (±5 km/h) by adjusting progress ±20%
        const variation = 1 + Math.sin(now / 12000) * 0.2;
        const prog = progRef.current + progressPerTick * variation;
        if (prog >= 1) {
          progRef.current = 0;
          segIdxRef.current = Math.min(segIdx + 1, coordsList.length - 2);
        } else {
          progRef.current = prog;
        }
        const lat = a.lat + (b.lat - a.lat) * progRef.current;
        const lng = a.lng + (b.lng - a.lng) * progRef.current;

        // Compute actual speed from distance moved since the last tick.
        // This guarantees the displayed speed matches the visible movement
        // of the bus icon on the map.
        const dLat = toRad(lat - prevSimPos.lat);
        const dLng = toRad(lng - prevSimPos.lng);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(prevSimPos.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
        const dist = 2 * R * Math.asin(Math.sqrt(h));
        // m/s → km/h
        const baseSpeed = (dist / dt) * 3.6;
        // Clamp to a realistic city bus speed range: 0-45 km/h
        const speed = Math.max(0, Math.min(45, baseSpeed));
        prevSimPos = { lat, lng, t: now };

        const heading = Math.atan2(b.lng - lng, b.lat - lat) * 180 / Math.PI;

        const data: DriverGPSData = {
          latitude: lat,
          longitude: lng,
          // Higher accuracy: ±3-5m (was ±8-12m) — looks like real high-accuracy GPS
          accuracy: 3 + Math.random() * 2,
          speed,
          heading: heading < 0 ? heading + 360 : heading,
          altitude: 30 + Math.random() * 10,
          timestamp: now,
        };
        setGps(data);
        postLocation(data, true);
      }, 1000);
    }, 3000); // 3 second delay before bus starts moving (was 4s)
  };

  const startSharing = () => {
    if (!vehicle) { show("Select your route first", "error"); return; }
    if (!dbVehicleId) { show("Vehicle not found in database. Try again.", "error"); return; }
    setError(null);
    setSharing(true);
    setTripStartTime(Date.now());
    setGps(null);

    fetch("/api/tracking/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId: dbVehicleId }),
    }).catch(() => {});

    if (navigator.geolocation) {
      // Always enable high accuracy (GPS satellite) regardless of source —
      // network source just means we tolerate lower accuracy, but we still
      // request the best possible fix. maximumAge: 0 means always get fresh
      // position; timeout: 5000 means fail fast if GPS is slow.
      watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      });
    } else {
      setError("Geolocation not supported. Using simulated GPS data.");
      setUsingSimulated(true);
      startSimulatedGPS();
    }
    show("Live location sharing started");
  };

  const stopSharing = () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    // Clear the last position so the next session computes speed/heading fresh
    lastPosRef.current = null;
    recentSpeedsRef.current = [];
    lastUpdateTsRef.current = 0;
    setSharing(false);
    setTripStartTime(null);
    setGps(null);
    setUsingSimulated(false);
    setError(null);
    if (dbVehicleId) {
      fetch("/api/tracking/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: dbVehicleId }),
      }).catch(() => {});
    }
    show("Location sharing stopped", "info");
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  const tripDuration = tripStartTime ? Math.floor((Date.now() - tripStartTime) / 60000) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 pt-1 pb-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Driver Mode</div>
          <h2 className="text-lg font-bold text-white leading-tight mt-0.5 truncate">Broadcast your GPS</h2>
          <div className="text-[10px] text-slate-500">Pushes live location every 2 seconds to passengers</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium gap-1.5 ${
            sharing
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-slate-600 bg-slate-700/30 text-slate-400"
          }`}>
            <i className={`fas fa-circle text-[6px] ${sharing ? "animate-pulse" : ""}`} />
            {sharing ? "BROADCASTING" : "IDLE"}
          </span>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white text-sm font-bold">
            D
          </div>
        </div>
      </div>

      {/* Route info banner */}
      {vehicle && (
        <div className="rounded-xl px-3.5 py-2.5 border flex items-center gap-3 border-amber-500/30 bg-amber-500/10 text-xs">
          <i className="fas fa-bus text-amber-400" />
          <span className="text-amber-200 flex-1 min-w-0 truncate">
            <strong>BUS {String(vehicle.no).padStart(2, "0")}</strong> · {vehicle.routeName} → RIT Campus
          </span>
          {dbVehicleId && <span className="text-[10px] text-slate-500 font-mono">ID: {dbVehicleId.slice(-6)}</span>}
        </div>
      )}

      {/* Info alert */}
      <div className="rounded-xl px-3.5 py-3 border border-[#1f2538] bg-[#10131f] text-[11px] text-slate-400 flex items-start gap-2">
        <i className="fas fa-circle-info text-cyan-400 mt-0.5" />
        <span>Your location is only visible while tracking is active. It auto-expires after <strong className="text-slate-200">60 seconds</strong> of inactivity.</span>
      </div>

      {/* Simulated GPS notice */}
      {usingSimulated && (
        <div className="rounded-xl px-3.5 py-2.5 border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200 flex items-center gap-2">
          <i className="fas fa-flask" /> SIMULATED GPS — Real GPS unavailable. Position simulated along route.
        </div>
      )}

      {/* Route selector */}
      <div className="relative">
        <i className="fas fa-bus absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 flex items-center justify-center text-[12px]" />
        <select
          value={selectedRoute}
          onChange={(e) => setSelectedRoute(e.target.value)}
          disabled={sharing}
          className="w-full pl-10 pr-10 py-3 bg-[#0a0d18] border border-[#1a2032] text-slate-100 rounded-xl text-sm focus:outline-none focus:border-amber-500/40 appearance-none cursor-pointer disabled:opacity-60"
        >
          <option value="">Select Your Route</option>
          {ALL_ROUTES.map((r) => (
            <option key={r.routeNo} value={r.routeNo}>
              BUS {String(r.no).padStart(2, "0")} — {r.routeName}
            </option>
          ))}
        </select>
        <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] pointer-events-none" />
      </div>

      {/* Position source */}
      {!sharing && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setPositionSource("gps")}
            className={`text-left p-3 rounded-xl border transition-all ${
              positionSource === "gps"
                ? "border-cyan-500/40 bg-cyan-500/10"
                : "border-[#1a2032] bg-[#10131f] hover:border-[#2a3252]"
            }`}
          >
            <i className="fas fa-satellite block text-base mb-1 text-cyan-400" />
            <div className={`text-[12px] font-semibold ${positionSource === "gps" ? "text-cyan-300" : "text-slate-100"}`}>GPS</div>
            <div className="text-[10px] text-slate-500">High accuracy</div>
          </button>
          <button
            onClick={() => setPositionSource("network")}
            className={`text-left p-3 rounded-xl border transition-all ${
              positionSource === "network"
                ? "border-cyan-500/40 bg-cyan-500/10"
                : "border-[#1a2032] bg-[#10131f] hover:border-[#2a3252]"
            }`}
          >
            <i className="fas fa-tower-broadcast block text-base mb-1 text-cyan-400" />
            <div className={`text-[12px] font-semibold ${positionSource === "network" ? "text-cyan-300" : "text-slate-100"}`}>Network</div>
            <div className="text-[10px] text-slate-500">Cell / Wi-Fi</div>
          </button>
        </div>
      )}

      {/* Start/Stop button */}
      {!sharing ? (
        <button
          onClick={startSharing}
          disabled={!dbVehicleId}
          className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className="fas fa-location-dot" /> Start Sharing Location
        </button>
      ) : (
        <button
          onClick={stopSharing}
          className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/20 hover:from-rose-400 hover:to-rose-500"
        >
          <i className="fas fa-stop" /> Stop Sharing Location
        </button>
      )}

      {/* Error message */}
      {error && !usingSimulated && (
        <div className="rounded-xl px-3.5 py-3 border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300 flex items-start gap-2">
          <i className="fas fa-triangle-exclamation mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* GPS telemetry */}
      {sharing && (
        <div className="rounded-2xl border border-[#1f2538] bg-[#10131f] p-3.5">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2.5 flex items-center gap-2">
            <i className="fas fa-satellite-dish text-cyan-400" /> GPS Telemetry
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Status</span>
              <span className={gps ? "text-emerald-400 font-semibold" : "text-slate-500"}>
                {gps ? (usingSimulated ? "● Sim" : "● Live") : "idle"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Source</span>
              <span className="text-cyan-300 font-medium">
                {usingSimulated ? "Simulated" : positionSource === "gps" ? "Satellite" : "Network"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Latitude</span>
              <span className={`font-mono ${gps ? "text-slate-100" : "text-slate-500"}`}>
                {gps ? gps.latitude.toFixed(6) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Longitude</span>
              <span className={`font-mono ${gps ? "text-slate-100" : "text-slate-500"}`}>
                {gps ? gps.longitude.toFixed(6) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Speed</span>
              <span className={`font-mono ${gps && (gps.speed ?? 0) > 0 ? "text-amber-300" : "text-slate-500"}`}>
                {gps ? `${Math.round(gps.speed ?? 0)} km/h` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Heading</span>
              <span className={`font-mono ${gps?.heading != null ? "text-slate-100" : "text-slate-500"}`}>
                {gps?.heading != null ? `${Math.round(gps.heading)}°` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Accuracy</span>
              <span className={`font-mono ${gps ? "text-emerald-300" : "text-slate-500"}`}>
                {gps ? `±${Math.round(gps.accuracy)} m` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Trip</span>
              <span className={tripStartTime ? "text-emerald-300 font-medium" : "text-slate-500"}>
                {tripStartTime ? `${tripDuration}m` : "—"}
              </span>
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-[#1a2032] text-[10px] text-slate-500">
            Last update: {gps ? new Date(gps.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
          </div>
        </div>
      )}

      {/* Always-visible live map — when sharing, shows the bus moving in real
          time. When not sharing, shows a preview of the selected route so the
          driver can see where they'll be driving. */}
      {selectedRoute && (() => {
        const r = ALL_ROUTES.find((x) => x.routeNo === selectedRoute);
        if (!r) return null;
        // Use the live driver position from the parent (polled from /api/vehicles).
        // This is the SAME position the passenger-side map will see — so the driver
        // can verify their bus icon is actually moving on the map.
        const livePos = driverPositions[selectedRoute];
        // When sharing with real GPS, prefer the local gps state (freshest).
        // When sharing with simulated GPS, the gps state is also populated.
        // When not sharing, fall back to the route's starting coords.
        const rawCoords: Coord = livePos?.coords
          || (gps ? { lat: gps.latitude, lng: gps.longitude } : r.coords);
        const currentSpeed = livePos?.speed ?? (gps ? (gps.speed ?? 0) : 0);
        const currentHeading = livePos?.heading ?? (gps ? gps.heading : undefined);
        const isLive = sharing && !!livePos;
        const currentAccuracy = livePos ? 5 : (gps?.accuracy ?? 50);

        // ═══ ROAD SNAPPING ═══
        // Snap the raw GPS position to the nearest segment of the route polyline.
        // This prevents the bus marker from floating through buildings or across
        // empty space when GPS accuracy is poor (e.g. ±500m as seen in the
        // user's screen recording). The snapped position is what gets displayed
        // on the map and sent to passengers.
        //
        // We only snap when sharing (real or simulated GPS is active). When
        // previewing the route, we use the raw route coords directly.
        let displayCoords: Coord = rawCoords;
        let snapInfo: RouteSnapResult | null = null;
        let isSnapped = false;
        if (sharing) {
          // Build the route polyline from the route's boarding stops (with
          // interpolated coords) so we can snap the raw GPS position to it.
          const routeStopsList = getRouteStopsWithCoords(selectedRoute);
          const routeCoordsList: Coord[] = routeStopsList.map((s) => s.coords || r.coords);
          if (routeCoordsList.length > 0) routeCoordsList[routeCoordsList.length - 1] = RIT_CAMPUS_COORDS;
          snapInfo = snapToRoute(rawCoords, routeCoordsList);
          if (snapInfo && snapInfo.deviationM < 200) {
            // Only snap if the GPS position is within 200m of the route.
            // If the bus has genuinely detoured (deviation > 200m), we show
            // the raw GPS position so the dispatcher can see the actual location.
            displayCoords = snapInfo.snappedCoords;
            isSnapped = true;
          }
        }

        const mapVehicles: MapVehicle[] = [{
          id: selectedRoute,
          vehicleNumber: `BUS-${String(r.no).padStart(3, "0")}`,
          vehicleName: r.routeName,
          status: (sharing ? "tracking" : "idle") as "tracking" | "idle",
          coords: displayCoords,
          speed: currentSpeed,
          heading: currentHeading ?? undefined,
          lastSeenAt: livePos ? new Date(livePos.timestamp).toISOString() : (gps ? new Date(gps.timestamp).toISOString() : new Date().toISOString()),
          routeNo: selectedRoute,
          selected: true,
          // Pass accuracy + raw coords to the map so it can draw an accuracy circle
          accuracy: currentAccuracy,
          rawCoords: isSnapped ? rawCoords : undefined,
        } as MapVehicle & { accuracy?: number; rawCoords?: Coord }];

        return (
          <div className="rounded-2xl border border-[#1f2538] bg-[#10131f] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold flex items-center gap-1.5">
                <i className="fas fa-map" /> {sharing ? "Live Bus Position" : "Route Preview"}
              </div>
              <div className="flex items-center gap-1.5">
                {isLive ? (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"
                      style={{ boxShadow: "0 0 6px #10b981" }}
                    />
                    LIVE · {tick}s ago
                  </span>
                ) : sharing ? (
                  <span className="text-[10px] text-amber-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    STARTING…
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    PREVIEW
                  </span>
                )}
              </div>
            </div>
            <div style={{ height: isMobile ? 300 : 380 }} className="rounded-xl overflow-hidden relative">
              <FleetMap
                vehicles={mapVehicles}
                selectedVehicleId={selectedRoute}
                onSelectVehicle={() => {}}
                showRouteForVehicleId={selectedRoute}
                height="100%"
                centerOnSelected={sharing}
              />
            </div>
            {/* GPS accuracy + road-snapping status — shown below the map so the
                driver can verify their position is being correctly pinned to the
                road, not floating in empty space. */}
            <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-3 flex-wrap">
              <span title="Snapped position on the route (what passengers see)">
                <i className="fas fa-location-dot text-cyan-400 mr-1" />
                {displayCoords.lat.toFixed(5)}, {displayCoords.lng.toFixed(5)}
              </span>
              {isSnapped && snapInfo && (
                <span title="GPS was snapped to the nearest road segment" className="text-emerald-400">
                  <i className="fas fa-road mr-1" />
                  snapped to route (off by {Math.round(snapInfo.deviationM)} m)
                </span>
              )}
              {sharing && !isSnapped && (
                <span title="Raw GPS position shown — bus may have detoured from route" className="text-amber-400">
                  <i className="fas fa-triangle-exclamation mr-1" />
                  raw GPS (off-route)
                </span>
              )}
              {sharing && <span><i className="fas fa-gauge-high text-amber-400 mr-1" />{Math.round(currentSpeed)} km/h</span>}
              {sharing && currentHeading != null && <span><i className="fas fa-compass text-slate-400 mr-1" />{Math.round(currentHeading)}°</span>}
              {gps && (
                <span title="GPS accuracy radius" className={currentAccuracy > 50 ? "text-amber-400" : "text-emerald-400"}>
                  <i className="fas fa-bullseye mr-1" />±{Math.round(currentAccuracy)} m
                </span>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ============================================================================
// Route Detail (Find My Bus → clicked route)
// ============================================================================
function RouteDetailView({
  routeNo,
  buses,
  driverPositions,
  onBack,
  tick,
  isMobile = false,
  mode = "online",
}: {
  routeNo: string;
  buses: BusPosition[];
  driverPositions: Record<string, { coords: Coord; speed: number; heading: number | null; timestamp: number }>;
  onBack: () => void;
  tick: number;
  isMobile?: boolean;
  mode?: "online" | "offline";
}) {
  const [followToggle, setFollowToggle] = useState(true);
  // Passenger location state — auto-detected via browser geolocation,
  // or manually selected from the route's boarding stops. Used to compute
  // the distance from the passenger to the bus (like "Where is my Train").
  const [passengerCoords, setPassengerCoords] = useState<Coord | null>(null);
  const [passengerStopIdx, setPassengerStopIdx] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const selRoute = ALL_ROUTES.find((r) => r.routeNo === routeNo);
  const selectedBus = buses.find((b) => b.routeNo === routeNo);
  if (!selRoute || !selectedBus) return null;

  const busDistanceKm = haversineDist(selectedBus.coords, RIT_CAMPUS_COORDS) / 1000;
  const etaMin = Math.max(1, Math.round(busDistanceKm / (Math.max(selectedBus.speed, 20) / 60)));
  const isDriverGPS = !!driverPositions[routeNo];
  // Use getRouteStopsWithCoords so each stop has interpolated coordinates —
  // otherwise the boarding points tracker shows all stops at the same place.
  const stops = getRouteStopsWithCoords(routeNo);
  const r = selRoute;
  const coordsList: Coord[] = stops.map((s) => s.coords || r.coords);
  if (coordsList.length > 0) coordsList[coordsList.length - 1] = RIT_CAMPUS_COORDS;
  // ═══ ROAD SNAPPING (passenger side) ═══
  // Snap the bus's raw GPS position to the route polyline so the marker
  // always sits on a road, not floating in empty space. This matches what
  // the driver-side map does (in DriverModePanel) so both views stay in sync.
  const rawBusPos = selectedBus.coords;
  const busSnap = snapToRoute(rawBusPos, coordsList);
  const currentPos: Coord = (busSnap && busSnap.deviationM < 200) ? busSnap.snappedCoords : rawBusPos;

  // ─── Passenger location helpers ──────────────────────────────────────
  // Auto-detect passenger location via browser geolocation.
  const detectMyLocation = () => {
    if (mode === "offline") {
      setLocationError("Location detection is unavailable in offline mode. Please pick a boarding stop manually.");
      setShowLocationPicker(true);
      return;
    }
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported. Please pick a boarding stop manually.");
      setShowLocationPicker(true);
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPassengerCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPassengerStopIdx(null); // clear any manual pick
        setLocating(false);
        // Try to snap to nearest boarding stop (within 500m)
        let bestIdx = -1;
        let bestDist = Infinity;
        stops.forEach((s, i) => {
          if (!s.coords) return;
          const d = haversineDist({ lat: pos.coords.latitude, lng: pos.coords.longitude }, s.coords);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        });
        if (bestIdx >= 0 && bestDist < 500) {
          setPassengerStopIdx(bestIdx);
        }
      },
      (err) => {
        setLocating(false);
        let msg = "Could not get your location. ";
        if (err.code === 1) msg += "Permission denied — please pick a boarding stop manually.";
        else if (err.code === 2) msg += "GPS unavailable — please pick a boarding stop manually.";
        else if (err.code === 3) msg += "Request timed out — please pick a boarding stop manually.";
        else msg += err.message;
        setLocationError(msg);
        setShowLocationPicker(true);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );
  };

  // The "effective" passenger coordinates — either auto-detected GPS,
  // or the coords of the manually-selected boarding stop.
  const effectivePassengerCoords: Coord | null = passengerCoords
    ?? (passengerStopIdx != null && stops[passengerStopIdx]?.coords ? stops[passengerStopIdx]!.coords! : null);

  // ─── Distance from passenger to bus (the key "Where is my Train" metric) ───
  const passengerToBusM = effectivePassengerCoords
    ? haversineDist(effectivePassengerCoords, currentPos)
    : null;
  const passengerToBusKm = passengerToBusM != null ? passengerToBusM / 1000 : null;

  // ETA from bus to passenger's stop (if passenger is at a stop, how long until bus arrives?)
  const passengerStop = passengerStopIdx != null ? stops[passengerStopIdx] : null;
  const busToPassengerStopM = passengerStop?.coords
    ? haversineDist(currentPos, passengerStop.coords)
    : null;
  // If the bus has already passed the passenger's stop, ETA is 0 (bus is here/past)
  const busPassedPassengerStop = (() => {
    if (passengerStopIdx == null) return false;
    // If bus is closer to RIT Campus than the passenger's stop, bus has passed it
    const distBusToEnd = haversineDist(currentPos, RIT_CAMPUS_COORDS);
    const distStopToEnd = passengerStop?.coords ? haversineDist(passengerStop.coords, RIT_CAMPUS_COORDS) : Infinity;
    return distBusToEnd < distStopToEnd - 30;
  })();
  const etaToPassengerMin = busPassedPassengerStop
    ? 0
    : (busToPassengerStopM != null
      ? Math.max(1, Math.round((busToPassengerStopM / 1000) / (Math.max(selectedBus.speed, 20) / 60)))
      : null);

  // ─── Crossing detection (existing logic, unchanged) ──────────────────
  const crossedStops = new Set<number>();
  stops.forEach((s, i) => {
    const sc = s.coords || r.coords;
    const distStopToEnd = haversineDist(sc, RIT_CAMPUS_COORDS);
    if (haversineDist(currentPos, RIT_CAMPUS_COORDS) < distStopToEnd - 30) crossedStops.add(i);
  });
  const currentStopIdx = stops.findIndex((s) => {
    const sc = s.coords || r.coords;
    return haversineDist(currentPos, sc) < 150;
  });

  const mapVehicles: MapVehicle[] = [
    {
      id: selectedBus.routeNo,
      vehicleNumber: `BUS-${String(selectedBus.no).padStart(3, "0")}`,
      vehicleName: selectedBus.routeName,
      status: isDriverGPS ? "tracking" as const : "live" as const,
      coords: selectedBus.coords,
      speed: selectedBus.speed,
      heading: driverPositions[routeNo]?.heading ?? undefined,
      lastSeenAt: driverPositions[routeNo]
        ? new Date(driverPositions[routeNo].timestamp).toISOString()
        : new Date().toISOString(),
      routeNo: selectedBus.routeNo,
      selected: true,
    },
  ];

  const startLocation = stops.length > 0 ? stops[0].stop : r.routeName;
  const endLocation = stops.length > 0 ? stops[stops.length - 1].stop : "RIT Campus";
  const crossedCount = crossedStops.size;
  const totalStops = stops.length;
  const progressPct = totalStops > 0 ? Math.round((crossedCount / totalStops) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Back button + route header */}
      <div className="flex items-center gap-3 pt-1 pb-2">
        <button
          onClick={onBack}
          className="flex-shrink-0 w-9 h-9 rounded-lg border border-[#1f2538] bg-[#10131f] text-slate-300 flex items-center justify-center hover:bg-[#161b2b] transition-colors"
          aria-label="Back to routes"
        >
          <i className="fas fa-chevron-left text-[12px]" />
        </button>
        <div className="flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center bg-[#1a2032]">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 leading-none">RTE</span>
          <span className="text-xs leading-tight text-amber-300 font-bold">{routeNo}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-white truncate">{startLocation} → RIT Campus</h2>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <i className="fas fa-clock text-[10px]" /> {r.start}
            </span>
            <span className="flex items-center gap-1">
              <i className="fas fa-navigation text-[10px]" /> {routeDistanceKm(routeNo)} km
            </span>
            <span className="flex items-center gap-1">
              <i className="fas fa-gauge text-[10px]" /> ~{routeDurationLabel(routeNo)}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ "Where is my Train" / "Chalo" style passenger panel ═══
          Shows: bus location, distance to user, ETA to user's stop, speed, status.
          First the user picks the bus (done — they're on this route detail page),
          then they pick/detect their location. Then we compute the distance. */}

      {/* Passenger location panel — pick/detect "your location" */}
      <div className="rounded-2xl border border-[#1f2538] bg-[#10131f] p-3.5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold flex items-center gap-1.5">
            <i className="fas fa-street-view" /> Your Location
          </div>
          {effectivePassengerCoords && (
            <span className="text-[10px] text-slate-500 font-mono">
              {effectivePassengerCoords.lat.toFixed(4)}, {effectivePassengerCoords.lng.toFixed(4)}
            </span>
          )}
        </div>

        {!effectivePassengerCoords && !locating && (
          <div className="text-center py-2">
            <p className="text-[11px] text-slate-400 mb-2">
              {mode === "offline"
                ? "Offline mode — pick your boarding stop to see distance to the bus."
                : "Detect your location to see how far the bus is from you."}
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              {mode === "online" && (
                <button
                  onClick={detectMyLocation}
                  className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold hover:bg-emerald-500/25 transition-colors flex items-center gap-1.5"
                >
                  <i className="fas fa-location-crosshairs" /> Detect My Location
                </button>
              )}
              <button
                onClick={() => setShowLocationPicker(!showLocationPicker)}
                className="px-3 py-2 rounded-lg bg-[#1a2032] border border-[#2a3252] text-slate-300 text-[11px] font-semibold hover:bg-[#222a4a] transition-colors flex items-center gap-1.5"
              >
                <i className="fas fa-list" /> Pick Boarding Stop
              </button>
            </div>
            {locationError && (
              <p className="text-[10px] text-amber-400 mt-2">{locationError}</p>
            )}
          </div>
        )}

        {locating && (
          <div className="text-center py-2">
            <i className="fas fa-spinner fa-spin text-emerald-400 mr-2" />
            <span className="text-[11px] text-slate-400">Locating you…</span>
          </div>
        )}

        {effectivePassengerCoords && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              {passengerStopIdx != null && stops[passengerStopIdx] ? (
                <div>
                  <div className="text-[12px] font-semibold text-emerald-300 truncate">
                    <i className="fas fa-circle-dot text-[10px] mr-1" />
                    {stops[passengerStopIdx].stop}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {passengerCoords && passengerStopIdx != null
                      ? "Auto-detected (nearest stop)"
                      : "Manually selected boarding stop"}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[12px] font-semibold text-emerald-300 truncate">
                    <i className="fas fa-location-dot text-[10px] mr-1" />
                    Your GPS location
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Not near any boarding stop — showing straight-line distance to bus
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => { setPassengerCoords(null); setPassengerStopIdx(null); }}
              className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded-md hover:bg-white/5"
            >
              <i className="fas fa-xmark mr-1" /> Reset
            </button>
          </div>
        )}

        {/* Boarding stop picker */}
        {showLocationPicker && !effectivePassengerCoords && (
          <div className="mt-3 max-h-[200px] overflow-y-auto rounded-lg border border-[#1a2032] bg-[#0a0d18]">
            {stops.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setPassengerStopIdx(i);
                  if (s.coords) setPassengerCoords(s.coords);
                  setShowLocationPicker(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#161b2b] border-b border-[#1a2032] last:border-0 flex items-center gap-2"
              >
                <span className="text-[10px] text-slate-500 font-mono w-6">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-slate-200 truncate">{s.stop}</div>
                  <div className="text-[10px] text-slate-500">{s.time}</div>
                </div>
                <i className="fas fa-chevron-right text-[10px] text-slate-600" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══ THE KEY METRIC: Distance from passenger to bus ═══
          "Where is my Train" / Chalo style — the headline number passengers care about. */}
      {passengerToBusKm != null && (
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold flex items-center gap-1.5">
              <i className="fas fa-route" /> Bus is {busPassedPassengerStop ? "past your stop" : "away from you"}
            </div>
            {isDriverGPS && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" /> LIVE GPS
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {passengerToBusKm < 1 ? `${Math.round(passengerToBusM!)} m` : `${passengerToBusKm.toFixed(1)} km`}
            </span>
            <span className="text-[11px] text-slate-400">from you</span>
          </div>
          {passengerStopIdx != null && (
            <div className="mt-2 grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <div className="text-slate-500 text-[10px]">ETA to your stop</div>
                <div className={`font-bold ${busPassedPassengerStop ? "text-amber-400" : "text-emerald-300"}`}>
                  {busPassedPassengerStop ? "Bus passed" : `~${etaToPassengerMin} min`}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-[10px]">Bus speed</div>
                <div className={`font-bold ${selectedBus.speed < 1 ? "text-amber-400" : "text-cyan-300"}`}>
                  {Math.round(selectedBus.speed)} km/h
                  {selectedBus.speed < 1 && (
                    <span className="ml-1 text-[9px] text-amber-400">🛑 NOT MOVING</span>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* Progress bar showing bus position relative to passenger's stop */}
          {passengerStopIdx != null && totalStops > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                <span>{startLocation}</span>
                <span className="text-emerald-400">▼ Your stop</span>
                <span>{endLocation}</span>
              </div>
              <div className="relative h-2 bg-[#1a2032] rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
                {/* Marker for passenger's stop position */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white"
                  style={{
                    left: `calc(${(passengerStopIdx / Math.max(1, totalStops - 1)) * 100}% - 6px)`,
                    boxShadow: "0 0 6px #10b981",
                  }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                <span>{progressPct}% complete</span>
                <span>{crossedCount} / {totalStops} stops crossed</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats: distance to campus + ETA to campus + speed */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-[#1f2538] bg-[#10131f] p-3">
          <div className="text-[9px] uppercase tracking-widest text-cyan-400 font-bold mb-1 flex items-center gap-1">
            <i className="fas fa-globe text-[10px]" /> To Campus
          </div>
          <div className="text-sm font-bold text-white">{busDistanceKm.toFixed(1)}<span className="text-[10px] text-slate-500 font-normal ml-1">km</span></div>
          <div className="mt-1.5 h-[3px] bg-[#1a2032] rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${Math.min(100, busDistanceKm)}%` }} />
          </div>
        </div>
        <div className="rounded-xl border border-[#1f2538] bg-[#10131f] p-3">
          <div className="text-[9px] uppercase tracking-widest text-emerald-400 font-bold mb-1 flex items-center gap-1">
            <i className="fas fa-clock text-[10px]" /> ETA
          </div>
          <div className="text-sm font-bold text-white">
            {etaMin > 60 ? `${Math.floor(etaMin / 60)}h ${etaMin % 60}m` : `${etaMin}`}<span className="text-[10px] text-slate-500 font-normal ml-1">{etaMin > 60 ? "" : "min"}</span>
          </div>
          <div className="mt-1.5 h-[3px] bg-[#1a2032] rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, etaMin)}%` }} />
          </div>
        </div>
        <div className="rounded-xl border border-[#1f2538] bg-[#10131f] p-3">
          <div className="text-[9px] uppercase tracking-widest text-amber-400 font-bold mb-1 flex items-center gap-1">
            <i className="fas fa-gauge-high text-[10px]" /> Speed
          </div>
          {/* When the bus is not moving (speed < 1 km/h), show a prominent
              "NOT MOVING" badge below the speed value so the passenger is
              never confused about whether the bus is actually moving. */}
          <div className="text-sm font-bold text-white">
            {Math.round(selectedBus.speed)}
            <span className="text-[10px] text-slate-500 font-normal ml-1">km/h</span>
          </div>
          {selectedBus.speed < 1 && (
            <div className="mt-1 text-[9px] font-bold text-amber-400 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 inline-block animate-pulse">
              🛑 NOT MOVING
            </div>
          )}
          <div className="mt-1.5 h-[3px] bg-[#1a2032] rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${Math.min(100, (selectedBus.speed / 80) * 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Live Map */}
      <div className="rounded-2xl border border-[#1f2538] bg-[#10131f] p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold flex items-center gap-1.5">
            <i className="fas fa-map" /> Live Map
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">Follow</span>
            <button
              onClick={() => setFollowToggle(!followToggle)}
              className="relative w-9 h-5 rounded-full border-0 cursor-pointer transition-colors"
              style={{ background: followToggle ? "#06b6d4" : "#374151" }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: followToggle ? "18px" : "2px" }}
              />
            </button>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ boxShadow: "0 0 6px #10b981" }} />
              LIVE · {tick}s
            </span>
          </div>
        </div>
        <div style={{ height: isMobile ? 320 : 440 }} className="rounded-xl overflow-hidden relative">
          <FleetMap
            vehicles={mapVehicles}
            selectedVehicleId={routeNo}
            onSelectVehicle={() => {}}
            showRouteForVehicleId={routeNo}
            height="100%"
            centerOnSelected={followToggle}
          />
        </div>
      </div>

      {/* Boarding points tracker */}
      {stops.length > 0 && (
        <div className="rounded-2xl border border-[#1f2538] bg-[#10131f] p-3.5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold flex items-center gap-1.5">
              <i className="fas fa-route" /> Boarding Points
            </div>
            <div className="text-[11px] text-slate-500">{crossedCount} / {totalStops} crossed · {progressPct}%</div>
          </div>

          {/* Route summary */}
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-white/[0.03]">
            <div className="flex flex-col items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" style={{ boxShadow: "0 0 6px #10b981" }} />
              <div className="w-0.5 h-4 bg-[#1e2330]" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" style={{ boxShadow: "0 0 6px #f59e0b" }} />
            </div>
            <div className="flex-1 flex justify-between text-[12px]">
              <div>
                <div className="font-semibold text-emerald-400">{startLocation}</div>
                <div className="text-[10px] text-slate-500">Departure: {stops[0]?.time || r.start}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-amber-400">{endLocation}</div>
                <div className="text-[10px] text-slate-500">Arrival: {stops[stops.length - 1]?.time || "7.40 am"}</div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 bg-[#1e2330] rounded-full mb-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #10b981, #f59e0b)" }}
            />
          </div>

          {/* Stops list */}
          <div className="flex flex-col gap-1 max-h-[280px] overflow-y-auto pr-1">
            {stops.map((s, i) => {
              const isCrossed = crossedStops.has(i);
              const isCurrent = i === currentStopIdx;
              const sc = s.coords || r.coords;
              const distFromBus = haversineDist(currentPos, sc);
              const prevStop = i > 0 ? stops[i - 1] : null;
              const prevCoords = prevStop ? (prevStop.coords || r.coords) : sc;
              const distFromPrev = haversineDist(prevCoords, sc);
              const stopEta = distFromBus < 150 ? 0 : Math.max(1, Math.round((distFromBus / 1000) / (Math.max(selectedBus.speed, 20) / 60)));
              const isFinal = i === stops.length - 1;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors"
                  style={{
                    background: isCurrent ? "rgba(6,182,212,0.1)" : isCrossed ? "rgba(16,185,129,0.05)" : "transparent",
                    border: isCurrent ? "1px solid rgba(6,182,212,0.3)" : "1px solid transparent",
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{
                      background: isCrossed ? "#10b981" : isCurrent ? "#06b6d4" : isFinal ? "#f59e0b" : "#1e2330",
                      border: isCurrent ? "2px solid #06b6d4" : "none",
                      boxShadow: isCrossed ? "0 0 6px #10b981" : isCurrent ? "0 0 8px #06b6d4" : "none",
                    }}
                  >
                    {isCrossed && <i className="fas fa-check text-[7px] text-white" />}
                    {isCurrent && <div className="w-1 h-1 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-[12px] font-medium"
                      style={{
                        color: isCrossed ? "#10b981" : isCurrent ? "#06b6d4" : isFinal ? "#f59e0b" : "#94a3b8",
                        fontWeight: isCurrent ? 700 : 500,
                      }}
                    >
                      {i + 1}. {s.stop}
                      {isFinal && (
                        <span className="ml-1.5 text-[9px] font-bold text-amber-400 px-1.5 py-0.5 rounded-full bg-amber-500/10">
                          FINAL
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-2 font-mono">{s.time}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {i > 0 ? `${(distFromPrev / 1000).toFixed(1)} km` : "—"}
                  </span>
                  {isCrossed ? (
                    <span className="text-[9px] font-bold text-emerald-400 px-1.5 py-0.5 rounded-full bg-emerald-500/10">CROSSED</span>
                  ) : isCurrent ? (
                    <span className="text-[9px] font-bold text-cyan-400 px-1.5 py-0.5 rounded-full bg-cyan-500/10">HERE NOW</span>
                  ) : (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${stopEta > 0 ? "text-cyan-400 bg-cyan-500/[0.08]" : "text-slate-500 bg-white/[0.03]"}`}>
                      {stopEta > 0 ? `${stopEta} min` : "—"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Find My Bus Tab — list of 52 routes + search
// ============================================================================
function FindMyBusTab({
  buses,
  driverPositions,
  onSelectRoute,
  isMobile = false,
}: {
  buses: BusPosition[];
  driverPositions: Record<string, { coords: Coord; speed: number; heading: number | null; timestamp: number }>;
  onSelectRoute: (routeNo: string) => void;
  isMobile?: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_ROUTES;
    return ALL_ROUTES.filter((r) => {
      const txt = `${r.no} ${r.routeNo} ${r.routeName}`;
      return txt.toLowerCase().includes(q);
    });
  }, [query]);

  return (
    <div className="space-y-3">
      {/* Greeting header */}
      <div className="flex items-center justify-between gap-3 pt-1 pb-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Find My Bus</div>
          <h2 className="text-lg font-bold text-white leading-tight mt-0.5 truncate">
            {greeting()}, Student
          </h2>
          <div className="text-[10px] text-slate-500">Step 1: Pick your bus · Step 2: Pick your location</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium gap-1.5 border-slate-600 bg-slate-700/30 text-slate-400">
            <i className="fas fa-activity w-3 h-3 animate-pulse text-[10px]" />
            CONNECTING
          </span>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">
            S
          </div>
        </div>
      </div>

      {/* Search input */}
      <div className="relative">
        <i className="fas fa-crosshair absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 flex items-center justify-center text-[12px]" />
        <input
          placeholder="Search route no or destination (e.g. R11 or Chengalpattu)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-3 py-3 bg-[#0a0d18] border border-[#1a2032] text-slate-100 placeholder:text-slate-600 rounded-xl text-sm focus:outline-none focus:border-cyan-500/40"
        />
      </div>

      {/* Count label */}
      <div className="text-[10px] uppercase tracking-widest text-slate-500 px-1">
        {filtered.length} routes {filtered.length !== ALL_ROUTES.length ? "matched" : "available"}
      </div>

      {/* Route list */}
      <div className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-1">
        {filtered.map((r) => {
          const bus = buses.find((b) => b.routeNo === r.routeNo);
          const isLive = bus && bus.speed > 0;
          const isDriverGPS = !!driverPositions[r.routeNo];
          return (
            <button
              key={r.routeNo}
              onClick={() => onSelectRoute(r.routeNo)}
              className="w-full text-left rounded-xl px-3.5 py-3 border transition-all flex items-center gap-3 border-[#1a2032] bg-[#10131f] hover:border-[#2a3252] hover:bg-[#161b2b]"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center bg-[#1a2032]">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 leading-none">RTE</span>
                <span className="text-xs leading-tight text-amber-300 font-bold">{r.routeNo}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-slate-100 truncate">
                  {r.routeName} → RIT Campus
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1">
                    <i className="fas fa-clock text-[10px]" /> {r.start}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="fas fa-navigation text-[10px]" /> {routeDistanceKm(r.routeNo)} km
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="fas fa-gauge text-[10px]" /> ~{routeDurationLabel(r.routeNo)}
                  </span>
                </div>
              </div>
              {/* Status pill */}
              {isDriverGPS ? (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 text-[10px] font-semibold flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ boxShadow: "0 0 6px #06b6d4" }} />
                  GPS
                </div>
              ) : isLive ? (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-semibold flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px #10b981" }} />
                  LIVE
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-rose-500/25 bg-rose-500/10 text-rose-300 text-[10px] font-semibold flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  OFF
                </div>
              )}
              <i className="fas fa-chevron-right text-[12px] text-slate-600 flex-shrink-0" />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-sm">
            <i className="fas fa-magnifying-glass text-2xl block mb-2 opacity-50" />
            No routes found for &quot;{query}&quot;
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page (full-screen)
// ============================================================================
export function LiveTrackingPage({ onBack }: LiveTrackingPageProps) {
  const [mode, setMode] = useState<"online" | "offline">("online");
  const [tab, setTab] = useState<"passenger" | "driver">("passenger");
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [buses, setBuses] = useState<BusPosition[]>(() => initialBuses());
  const [tick, setTick] = useState(0);
  const [driverPositions, setDriverPositions] = useState<Record<string, { coords: Coord; speed: number; heading: number | null; timestamp: number }>>({});
  const tickRef = useRef(0);

  // Apply / remove the rt-force-mobile class on <body> so all the existing
  // mobile CSS rules apply when the user switches to mobile view.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (viewMode === "mobile") {
      document.body.classList.add("rt-force-mobile");
    } else {
      document.body.classList.remove("rt-force-mobile");
    }
    return () => { document.body.classList.remove("rt-force-mobile"); };
  }, [viewMode]);

  // Fetch real driver positions from the API every 2 seconds
  useEffect(() => {
    const fetchDriverPositions = async () => {
      try {
        const res = await fetch("/api/vehicles");
        const data = await res.json();
        const vehicles = data.vehicles || [];
        const positions: Record<string, { coords: Coord; speed: number; heading: number | null; timestamp: number }> = {};
        for (const v of vehicles) {
          if (v.lastLat != null && v.lastLng != null && v.lastSeenAt) {
            const age = Date.now() - new Date(v.lastSeenAt).getTime();
            if (age < 60000) {
              positions[v.routeNo] = {
                coords: { lat: v.lastLat, lng: v.lastLng },
                speed: v.lastSpeed || 0,
                heading: v.lastHeading,
                timestamp: new Date(v.lastSeenAt).getTime(),
              };
            }
          }
        }
        setDriverPositions(positions);
      } catch (_) {}
    };
    fetchDriverPositions();
    // Poll every 1 second (was 2s) to match the driver-side push rate so
    // passengers see the bus move smoothly without lag.
    const fetchId = setInterval(fetchDriverPositions, 1000);
    return () => clearInterval(fetchId);
  }, []);

  // Update bus positions every 1 second (was 2s):
  // - If a real driver is sharing GPS (driverPositions[routeNo] exists), the bus
  //   snaps to that exact GPS coordinate — the bus icon will MOVE as the driver moves.
  // - Otherwise, simulate movement along the route so the demo still looks alive.
  useEffect(() => {
    const id = setInterval(() => {
      setBuses((prev) =>
        prev.map((b) => {
          const driverPos = driverPositions[b.routeNo];
          if (driverPos) {
            // REAL DRIVER GPS — use the exact reported coordinates.
            // This is what makes the bus icon actually move with the driver.
            return {
              ...b,
              coords: driverPos.coords,
              speed: driverPos.speed,
              // Keep heading if the device reported one
            };
          }
          // Simulated movement for buses without a real driver
          const r = ALL_ROUTES.find((x) => x.routeNo === b.routeNo);
          if (!r) return b;
          // Use getRouteStopsWithCoords so each stop has interpolated coordinates
          // between the route destination and RIT Campus — otherwise all stops
          // fall back to the route's main coords and the bus appears stuck.
          const stops = getRouteStopsWithCoords(b.routeNo);
          if (stops.length < 2) return b;
          const coordsList: Coord[] = stops.map((s) => s.coords || r.coords);
          coordsList[coordsList.length - 1] = RIT_CAMPUS_COORDS;

          let newSeg = b.segIdx;
          // 0.04 per 1s = ~25 seconds per segment — smoother simulated movement
          // for buses without a real driver. Was 0.08 per 2s.
          let newProg = b.progress + 0.04;
          if (newProg >= 1) { newProg = 0; newSeg += 1; if (newSeg >= coordsList.length - 1) newSeg = 0; }
          const a = coordsList[newSeg];
          const c = coordsList[Math.min(newSeg + 1, coordsList.length - 1)];
          const newCoords = lerp(a, c, newProg);
          const newSpeed = 25 + Math.sin(Date.now() / 30000 + b.routeNo.charCodeAt(0)) * 12;
          return { ...b, segIdx: newSeg, progress: newProg, coords: newCoords, speed: newSpeed };
        })
      );
      tickRef.current += 1;
      setTick(tickRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [driverPositions]);

  // Scroll to top when the page mounts
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const handleBack = useCallback(() => {
    setSelectedRoute(null);
    onBack();
  }, [onBack]);

  const isMobile = viewMode === "mobile";

  return (
    <div className={`min-h-screen flex flex-col bg-[#0a0d18] text-slate-100 ${isMobile ? "rt-wimb-mobile" : ""}`}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0d18]/95 backdrop-blur border-b border-[#1f2538] flex-shrink-0">
        <div className={`mx-auto flex items-center justify-between gap-2 ${isMobile ? "px-3 py-2.5" : "max-w-5xl px-4 py-3"}`}>
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={handleBack}
              aria-label="Back"
              className={`rounded-lg bg-white/[0.06] border border-[#1f2538] text-slate-300 hover:bg-white/[0.12] hover:text-white transition-colors flex items-center justify-center flex-shrink-0 ${isMobile ? "w-8 h-8 text-[11px]" : "w-9 h-9 text-[12px]"}`}
            >
              <i className="fas fa-chevron-left" />
            </button>
            <div className={`rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20 ${isMobile ? "w-8 h-8" : "w-10 h-10"}`}>
              <i className={`fas fa-bus text-white flex items-center justify-center ${isMobile ? "text-[13px]" : "text-[16px]"}`} />
            </div>
            <div className="min-w-0">
              <h1 className={`font-bold tracking-tight text-slate-100 leading-none ${isMobile ? "text-[13px]" : "text-base"}`}>Where is my Bus</h1>
              <p className={`uppercase tracking-widest text-slate-500 leading-none ${isMobile ? "text-[8px] mt-0.5" : "text-[10px] mt-0.5"}`}>
                Live Tracking • Chennai Routes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* View toggle button — switches between desktop and mobile layouts */}
            <button
              onClick={() => setViewMode((v) => (v === "desktop" ? "mobile" : "desktop"))}
              aria-label={`Switch to ${isMobile ? "desktop" : "mobile"} view`}
              title={`Switch to ${isMobile ? "desktop" : "mobile"} view`}
              className={`inline-flex items-center justify-center gap-1.5 rounded-full border transition-colors flex-shrink-0 ${
                isMobile
                  ? "px-2 py-1 border-cyan-500/40 bg-cyan-500/10 text-cyan-300 text-[9px]"
                  : "px-2.5 py-1 border-slate-600 bg-slate-700/30 text-slate-400 text-[11px] hover:text-slate-200 hover:border-slate-500"
              }`}
            >
              <i className={`fas ${isMobile ? "fa-mobile-screen" : "fa-desktop"} text-[10px]`} />
              <span className="font-semibold tracking-wide">{isMobile ? "Mobile" : "Desktop"}</span>
              <i className="fas fa-repeat text-[8px] opacity-60 ml-0.5" />
            </button>
            <span className={`inline-flex items-center justify-center gap-1.5 rounded-full border font-semibold tracking-wide ${
              isMobile ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[11px]"
            } ${
              mode === "online"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-slate-600 bg-slate-700/30 text-slate-400"
            }`}>
              <i className={`fas fa-wifi text-[10px] ${mode === "online" ? "animate-pulse" : ""}`} />
              {mode === "online" ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className={`flex-1 w-full mx-auto overflow-y-auto ${isMobile ? "px-3 py-3 pb-32" : "max-w-5xl px-4 py-4 pb-24"}`}>
        {/* Online/Offline mode card */}
        <div className={`rounded-2xl border border-[#1f2538] bg-[#10131f] mb-4 ${isMobile ? "p-3" : "p-4"}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`rounded-lg flex items-center justify-center flex-shrink-0 ${
                mode === "online"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-slate-500/15 text-slate-400"
              } ${isMobile ? "w-8 h-8" : "w-10 h-10"}`}>
                <i className={`fas fa-wifi flex items-center justify-center ${isMobile ? "text-[13px]" : "text-[16px]"}`} />
              </div>
              <div className="min-w-0">
                <div className={`font-semibold text-slate-100 ${isMobile ? "text-[12px]" : "text-sm"}`}>
                  {mode === "online" ? "Online Mode — Live Tracking" : "Offline Mode — Static Schedule"}
                </div>
                <div className={`text-slate-500 mt-0.5 ${isMobile ? "text-[10px]" : "text-[11px]"}`}>
                  {mode === "online"
                    ? "Real GPS + Google Maps + speed via GPS/network towers. Driver pushes location every 1s. Auto-detect your location to see distance to bus."
                    : "Scheduled times only — no live GPS. Pick your boarding stop manually to see the route map and stops."}
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={mode === "online"}
              onClick={() => setMode((m) => (m === "online" ? "offline" : "online"))}
              aria-label="Toggle online/offline mode"
              className={`relative inline-flex ${isMobile ? "h-4 w-7" : "h-[18px] w-8"} shrink-0 items-center rounded-full border border-transparent shadow-xs transition-colors outline-none ${
                mode === "online" ? "bg-emerald-500" : "bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none block ${isMobile ? "w-3 h-3" : "w-4 h-4"} rounded-full bg-white ring-0 transition-transform ${
                  mode === "online" ? (isMobile ? "translate-x-[12px]" : "translate-x-[14px]") : (isMobile ? "translate-x-0.5" : "translate-x-0.5")
                }`}
              />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={`grid grid-cols-2 gap-1 bg-[#10131f] border border-[#1f2538] rounded-xl ${isMobile ? "h-10" : "h-12"} p-1 mb-4`}>
          <button
            onClick={() => { setTab("passenger"); setSelectedRoute(null); }}
            className={`inline-flex h-[calc(100%-2px)] flex-1 items-center justify-center gap-1.5 font-medium rounded-lg transition-all ${
              isMobile ? "text-[12px]" : "text-sm"
            } ${
              tab === "passenger"
                ? "bg-emerald-500/15 text-emerald-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <i className="fas fa-eye text-[12px]" />
            Find My Bus
          </button>
          <button
            onClick={() => setTab("driver")}
            className={`inline-flex h-[calc(100%-2px)] flex-1 items-center justify-center gap-1.5 font-medium rounded-lg transition-all ${
              isMobile ? "text-[12px]" : "text-sm"
            } ${
              tab === "driver"
                ? "bg-amber-500/15 text-amber-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <i className="fas fa-hand text-[12px]" />
            Driver Mode
          </button>
        </div>

        {/* Tab content */}
        {tab === "passenger" && (
          selectedRoute ? (
            <RouteDetailView
              routeNo={selectedRoute}
              buses={buses}
              driverPositions={driverPositions}
              onBack={() => setSelectedRoute(null)}
              tick={tick}
              isMobile={isMobile}
              mode={mode}
            />
          ) : (
            <FindMyBusTab
              buses={buses}
              driverPositions={driverPositions}
              onSelectRoute={setSelectedRoute}
              isMobile={isMobile}
            />
          )
        )}

        {tab === "driver" && (
          <DriverModePanel driverPositions={driverPositions} tick={tick} isMobile={isMobile} />
        )}

        {/* Footer */}
        <div className="text-center pt-6 pb-2 border-t border-[#1f2538]/50 mt-6">
          <div className={`text-slate-500 ${isMobile ? "text-[9px]" : "text-[10px]"}`}>Where is my Bus · 52 Chennai routes · All buses go to RIT Campus</div>
        </div>
      </main>
    </div>
  );
}

export {};
