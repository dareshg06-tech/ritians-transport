"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { routes, routeStops, RIT_CAMPUS_COORDS, type Coord } from "@/lib/ritians/data";
import { getRouteStopsWithCoords } from "@/lib/ritians/fleet";
import { haversineMeters, snapToRoute } from "@/lib/fleet/physics";
import { useToast } from "@/lib/ritians/toast";

// Load FleetMap client-side only
const FleetMap = dynamic(() => import("../fleet/FleetMap.client").then((m) => m.FleetMap), {
  ssr: false,
  loading: () => (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 12 }}>
      <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} /> Loading map…
    </div>
  ),
}) as typeof import("../fleet/FleetMap.client").FleetMap;
type MapVehicle = import("../fleet/FleetMap.client").MapVehicle;

interface DriverGpsProps {
  onBack: () => void;
  onOpenTracking?: () => void;
}

interface GPSData {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  timestamp: number;
}

// Maps a route number to the DB vehicle ID by fetching /api/vehicles on mount
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

export function DriverGpsPortal({ onBack }: DriverGpsProps) {
  // onOpenTracking removed — Live Tracking feature was removed because it wasn't working correctly
  const { show } = useToast();
  const routeToVehicleId = useVehicleIdMap();
  const [selectedRoute, setSelectedRoute] = useState("");
  const [sharing, setSharing] = useState(false);
  const [gps, setGps] = useState<GPSData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [positionSource, setPositionSource] = useState<"gps" | "network">("gps");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tripStartTime, setTripStartTime] = useState<number | null>(null);
  const [usingSimulated, setUsingSimulated] = useState(false);
  const [tick, setTick] = useState(0);
  // Bus count — how many buses are currently sharing location (polled from /api/vehicles)
  const [activeBusCount, setActiveBusCount] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segIdxRef = useRef(0);
  const progRef = useRef(0);

  const vehicle = routes.find((r) => r.routeNo === selectedRoute);
  // The actual DB vehicle ID for the selected route
  const dbVehicleId = routeToVehicleId[selectedRoute] || null;

  // Poll /api/vehicles every 2s to count active buses (lastSeenAt < 60s ago).
  // This drives the bus count badge in the header — when the driver starts
  // sharing, their bus is published and the count increments.
  useEffect(() => {
    const fetchActiveCount = async () => {
      try {
        const res = await fetch("/api/vehicles");
        const data = await res.json();
        const vehicles = data.vehicles || [];
        const now = Date.now();
        const active = vehicles.filter((v: { lastSeenAt: string | null; status: string }) =>
          v.lastSeenAt && (now - new Date(v.lastSeenAt).getTime()) < 60000
        ).length;
        setActiveBusCount(active);
      } catch (_) {}
    };
    fetchActiveCount();
    const id = setInterval(fetchActiveCount, 2000);
    return () => clearInterval(id);
  }, []);

  // Helper: POST location to backend with the correct DB vehicle ID
  const postLocation = (data: GPSData, isSim: boolean) => {
    if (!dbVehicleId) return; // Can't save without the DB vehicle ID
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
        timestamp: new Date(data.timestamp).toISOString(),
      }),
    }).catch(() => {});
  };

  // Real GPS handler — uses the EXACT coordinates from the browser
  const handlePosition = (pos: GeolocationPosition) => {
    const data: GPSData = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      // If speed is null (device doesn't report speed), set to 0 — not null
      speed: pos.coords.speed != null ? Math.max(0, pos.coords.speed * 3.6) : 0, // m/s → km/h, minimum 0
      // If heading is null, keep it null (bus is stationary — no direction)
      heading: pos.coords.heading,
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
    if (err.code === 1) msg = "Location permission denied. Showing simulated GPS data instead.";
    else if (err.code === 2) msg = "GPS signal unavailable. Showing simulated GPS data instead.";
    else if (err.code === 3) msg = "GPS request timed out. Showing simulated GPS data instead.";
    else msg = err.message;
    setError(msg);
    setUsingSimulated(true);
    startSimulatedGPS();
  };

  // Simulated GPS — starts at the EXACT starting location with speed 0, then moves
  const startSimulatedGPS = () => {
    if (!vehicle) return;
    const stops = routeStops[vehicle.routeNo] || [];
    if (stops.length < 2) return;
    const coordsList: Coord[] = stops.map((s) => s.coords || vehicle.coords);
    coordsList[coordsList.length - 1] = RIT_CAMPUS_COORDS;
    segIdxRef.current = 0;
    progRef.current = 0;

    // Post the INITIAL position — exactly at the starting location, speed = 0
    const startPos = coordsList[0];
    const initialData: GPSData = {
      latitude: startPos.lat,
      longitude: startPos.lng,
      accuracy: 8,
      speed: 0, // Bus is stationary at the start
      heading: null, // No heading when stationary
      altitude: 30,
      timestamp: Date.now(),
    };
    setGps(initialData);
    postLocation(initialData, true);

    // After 4 seconds, start moving
    setTimeout(() => {
      simIntervalRef.current = setInterval(() => {
        const segIdx = segIdxRef.current;
        const prog = progRef.current + 0.05;
        if (prog >= 1) {
          progRef.current = 0;
          segIdxRef.current = Math.min(segIdx + 1, coordsList.length - 2);
        } else {
          progRef.current = prog;
        }
        const a = coordsList[segIdxRef.current];
        const b = coordsList[Math.min(segIdxRef.current + 1, coordsList.length - 1)];
        const lat = a.lat + (b.lat - a.lat) * progRef.current;
        const lng = a.lng + (b.lng - a.lng) * progRef.current;
        // Speed varies between 20-40 km/h (realistic bus speed)
        const speed = 20 + Math.sin(Date.now() / 20000) * 10;
        // Heading = direction from current position to next stop
        const heading = Math.atan2(b.lng - lng, b.lat - lat) * 180 / Math.PI;

        const data: GPSData = {
          latitude: lat,
          longitude: lng,
          accuracy: 8 + Math.random() * 4,
          speed: Math.max(0, speed), // Never negative
          heading: heading < 0 ? heading + 360 : heading,
          altitude: 30 + Math.random() * 10,
          timestamp: Date.now(),
        };
        setGps(data);
        setTick((t) => t + 1);
        postLocation(data, true);
      }, 2000);
    }, 4000); // 4 second delay before bus starts moving
  };

  const startSharing = () => {
    if (!vehicle) { show("Select your route first", "error"); return; }
    if (!dbVehicleId) { show("Vehicle not found in database. Try again.", "error"); return; }
    setError(null);
    setSharing(true);
    setTripStartTime(Date.now());
    setGps(null);

    // Start tracking session in backend
    fetch("/api/tracking/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId: dbVehicleId }),
    }).catch(() => {});

    // Try real GPS first
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
        enableHighAccuracy: positionSource === "gps",
        maximumAge: 0,
        timeout: 8000,
      });
    } else {
      setError("Geolocation not supported. Showing simulated GPS data instead.");
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
    <div className="rt-gps-page">
      <div className="rt-gps-nav">
        <button className="rt-gps-nav-btn" onClick={onBack}>
          <i className="fas fa-arrow-left" /> Back to Home
        </button>
        {/* Bus count badge — shows how many buses are currently sharing location.
            When the driver clicks Start Sharing, their bus is published and
            the count increments. */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 14px", borderRadius: 99,
          background: activeBusCount > 0 ? "rgba(16,185,129,0.15)" : "rgba(100,116,139,0.1)",
          border: `1px solid ${activeBusCount > 0 ? "rgba(16,185,129,0.4)" : "rgba(100,116,139,0.2)"}`,
          color: activeBusCount > 0 ? "#10b981" : "#64748b",
          fontSize: 12, fontWeight: 700,
        }}>
          <i className="fas fa-bus" style={{ fontSize: 11 }} />
          {activeBusCount} {activeBusCount === 1 ? "bus" : "buses"} live
          {activeBusCount > 0 && (
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#10b981", marginLeft: 2,
              animation: "rtPulse 2s infinite",
              boxShadow: "0 0 6px #10b981",
            }} />
          )}
        </div>
      </div>

      <div className="rt-gps-card">
        <div className="rt-gps-hero">
          <div className="rt-gps-hero-icon"><i className="fas fa-location-arrow" /></div>
          <h1>Driver GPS Portal</h1>
          <p>Share your live location with passengers on route</p>
        </div>

        <div className="rt-gps-body">
          {/* Route info banner */}
          {vehicle && (
            <div style={{
              marginBottom: 14, padding: "10px 14px",
              background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)",
              borderRadius: "var(--r)", display: "flex", alignItems: "center", gap: 10, fontSize: 12,
            }}>
              <i className="fas fa-bus" style={{ color: "#FBBF24" }} />
              <span style={{ color: "#FDE68A" }}>
                <strong>BUS {String(vehicle.no).padStart(2, "0")}</strong> → {vehicle.routeName} → RIT Campus
              </span>
              {dbVehicleId && <span style={{ fontSize: 10, color: "var(--text3)", marginLeft: "auto" }}>ID: {dbVehicleId.slice(-6)}</span>}
            </div>
          )}

          {/* Alert */}
          <div className="rt-gps-alert">
            <i className="fas fa-circle-info" />
            <span>Your location is only visible to passengers while tracking is active. It auto-expires after <strong>60 seconds</strong> of inactivity.</span>
          </div>

          {/* Simulated GPS notice */}
          {usingSimulated && (
            <div style={{
              marginBottom: 14, padding: "10px 14px",
              background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
              borderRadius: "var(--r)", fontSize: 12, color: "#FDE68A",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <i className="fas fa-flask" /> SIMULATED GPS — Real GPS unavailable. Position simulated along route.
            </div>
          )}

          {/* Route selector */}
          <div className="rt-gps-label" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 8 }}>
            Your Route / Vehicle ID
          </div>
          <div className="rt-gps-select-wrap" style={{ marginBottom: 18, position: "relative" }}>
            <i className="fas fa-bus prefix" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", fontSize: 14, pointerEvents: "none" }} />
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              disabled={sharing}
              style={{
                width: "100%", padding: "13px 40px 13px 38px",
                background: "rgba(255,255,255,0.045)", border: "1px solid var(--border2)", borderRadius: "var(--r)",
                color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 14, outline: "none", cursor: "pointer",
                appearance: "none",
              }}
            >
              <option value="">Select Your Route</option>
              {routes.map((r) => (
                <option key={r.routeNo} value={r.routeNo}>
                  BUS {String(r.no).padStart(2, "0")} — {r.routeName}
                </option>
              ))}
            </select>
            <i className="fas fa-chevron-down" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", fontSize: 12, pointerEvents: "none" }} />
          </div>

          {/* Position source */}
          {!sharing && (
            <>
              <div className="rt-gps-label" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 8 }}>
                Position Source
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <button
                  onClick={() => setPositionSource("gps")}
                  style={{
                    padding: 12, borderRadius: "var(--r)", border: `2px solid ${positionSource === "gps" ? "var(--accent2)" : "var(--border)"}`,
                    background: positionSource === "gps" ? "rgba(34,211,238,0.08)" : "rgba(255,255,255,0.03)",
                    cursor: "pointer", transition: "all 0.2s ease", textAlign: "left",
                  }}
                >
                  <i className="fas fa-satellite" style={{ color: positionSource === "gps" ? "var(--accent2)" : "var(--text3)", fontSize: 18, marginBottom: 4, display: "block" }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: positionSource === "gps" ? "var(--accent2)" : "var(--text)" }}>GPS</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>High accuracy</div>
                </button>
                <button
                  onClick={() => setPositionSource("network")}
                  style={{
                    padding: 12, borderRadius: "var(--r)", border: `2px solid ${positionSource === "network" ? "var(--accent2)" : "var(--border)"}`,
                    background: positionSource === "network" ? "rgba(34,211,238,0.08)" : "rgba(255,255,255,0.03)",
                    cursor: "pointer", transition: "all 0.2s ease", textAlign: "left",
                  }}
                >
                  <i className="fas fa-tower-broadcast" style={{ color: positionSource === "network" ? "var(--accent2)" : "var(--text3)", fontSize: 18, marginBottom: 4, display: "block" }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: positionSource === "network" ? "var(--accent2)" : "var(--text)" }}>Network</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>Cell tower / Wi-Fi</div>
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 14 }}>
                {positionSource === "gps" ? "Uses device GPS satellites. Most accurate (±5–10 m) but uses more battery." : "Uses cell towers and Wi-Fi. Less accurate but saves battery."}
              </div>
            </>
          )}

          {/* Start/Stop button */}
          {!sharing ? (
            <button className="rt-gps-share-btn-elite start" onClick={startSharing} disabled={!dbVehicleId}>
              <i className="fas fa-location-dot" /> Start Sharing Location
            </button>
          ) : (
            <button className="rt-gps-share-btn-elite stop" onClick={stopSharing}>
              <i className="fas fa-stop" /> Stop Sharing Location
            </button>
          )}

          {/* Error message */}
          {error && !usingSimulated && (
            <div className="rt-gps-error" style={{ marginTop: 14 }}>
              <i className="fas fa-triangle-exclamation" />
              <div>{error}</div>
            </div>
          )}

          {/* GPS Telemetry — shows EXACT real or simulated data */}
          {sharing && (
            <div style={{ marginTop: 18 }}>
              <div className="rt-gps-data-grid">
                <div className="rt-gps-data-row">
                  <span className="rt-gps-data-label">Status</span>
                  <span className={`rt-gps-data-value ${gps ? "active" : "idle"}`}>
                    {gps ? (usingSimulated ? "● Tracking (simulated)" : "● Tracking • GPS") : "idle"}
                  </span>
                </div>
                <div className="rt-gps-data-row">
                  <span className="rt-gps-data-label">Position Source</span>
                  <span className="rt-gps-data-value" style={{ color: "var(--accent2)" }}>
                    {usingSimulated ? "Simulated GPS" : positionSource === "gps" ? "GPS (satellite)" : "Network (cell/Wi-Fi)"}
                  </span>
                </div>
                <div className="rt-gps-data-row">
                  <span className="rt-gps-data-label">Latitude</span>
                  <span className={`rt-gps-data-value ${gps ? "coords" : "idle"}`}>
                    {gps ? gps.latitude.toFixed(6) : "—"}
                  </span>
                </div>
                <div className="rt-gps-data-row">
                  <span className="rt-gps-data-label">Longitude</span>
                  <span className={`rt-gps-data-value ${gps ? "coords" : "idle"}`}>
                    {gps ? gps.longitude.toFixed(6) : "—"}
                  </span>
                </div>
                <div className="rt-gps-data-row">
                  <span className="rt-gps-data-label">Speed</span>
                  <span className={`rt-gps-data-value ${gps ? ((gps.speed ?? 0) > 0 ? "orange" : "idle") : "idle"}`}>
                    {gps ? `${Math.round(gps.speed ?? 0)} km/h` : "—"}
                  </span>
                </div>
                <div className="rt-gps-data-row">
                  <span className="rt-gps-data-label">Heading</span>
                  <span className={`rt-gps-data-value ${gps?.heading != null ? "" : "idle"}`}>
                    {gps?.heading != null ? `${Math.round(gps.heading)}°` : "—"}
                  </span>
                </div>
                <div className="rt-gps-data-row">
                  <span className="rt-gps-data-label">Accuracy</span>
                  <span className={`rt-gps-data-value ${gps ? "green" : "idle"}`}>
                    {gps ? `±${Math.round(gps.accuracy)} m` : "—"}
                  </span>
                </div>
                <div className="rt-gps-data-row">
                  <span className="rt-gps-data-label">Last Update</span>
                  <span className="rt-gps-data-value" style={{ fontSize: 12 }}>
                    {gps ? new Date(gps.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                  </span>
                </div>
                <div className="rt-gps-data-row">
                  <span className="rt-gps-data-label">Trip Status</span>
                  <span className="rt-gps-data-value" style={{ color: tripStartTime ? "#5EEAB0" : "var(--text3)" }}>
                    {tripStartTime ? `In progress · ${tripDuration}m` : "Not started"}
                  </span>
                </div>
              </div>

              {/* Advanced controls */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  marginTop: 12, width: "100%", padding: "10px 14px",
                  background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: "var(--r)",
                  color: "var(--text2)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <span><i className="fas fa-sliders" style={{ marginRight: 6 }} /> Advanced controls</span>
                <i className={`fas fa-chevron-${showAdvanced ? "up" : "down"}`} style={{ fontSize: 10 }} />
              </button>

              {showAdvanced && (
                <div style={{ marginTop: 10, padding: 14, background: "rgba(8,11,20,0.5)", border: "1px solid var(--border)", borderRadius: "var(--r)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="rt-gps-data-row">
                    <span className="rt-gps-data-label">Altitude</span>
                    <span className={`rt-gps-data-value ${gps?.altitude != null ? "" : "idle"}`}>
                      {gps?.altitude != null ? `${Math.round(gps.altitude)} m` : "—"}
                    </span>
                  </div>
                  <div className="rt-gps-data-row">
                    <span className="rt-gps-data-label">Update Frequency</span>
                    <span className="rt-gps-data-value" style={{ fontSize: 12 }}>Every 2 seconds</span>
                  </div>
                  <div className="rt-gps-data-row">
                    <span className="rt-gps-data-label">Route</span>
                    <span className="rt-gps-data-value">{vehicle?.routeNo} · {vehicle?.routeName}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ LIVE MAP + BOARDING POINTS ═══
              When the driver is sharing location, show:
              1. A live map with start (A) and end (B) points + bus marker
              2. Boarding points list with crossed/not-crossed status + Record Passengers button
              The bus marker is pinned by lat/lng and updates every 2 seconds. */}
          {sharing && selectedRoute && vehicle && (
            <DriverLiveMap
              routeNo={selectedRoute}
              vehicleNumber={`BUS-${String(vehicle.no).padStart(3, "0")}`}
              vehicleName={vehicle.routeName}
              gps={gps}
              usingSimulated={usingSimulated}
              onBack={onBack}
            />
          )}

          {/* Back button */}
          <button className="rt-btn rt-btn-ghost rt-btn-sm rt-btn-full" style={{ marginTop: 14 }} onClick={onBack}>
            <i className="fas fa-arrow-left" /> Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DriverLiveMap — shows the live map with start (A) and end (B) points +
// bus marker pinned by lat/lng. Updates every 2 seconds when the driver
// shares their GPS position. Also shows the boarding points list with
// crossed/not-crossed status + Record Passengers button.
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

function DriverLiveMap({
  routeNo,
  vehicleNumber,
  vehicleName,
  gps,
  usingSimulated,
}: {
  routeNo: string;
  vehicleNumber: string;
  vehicleName: string;
  gps: DriverGPSData | null;
  usingSimulated: boolean;
  onBack: () => void;
}) {
  const routeInfo = routes.find((r) => r.routeNo === routeNo);
  const stops = getRouteStopsWithCoords(routeNo);

  // Build the route polyline
  const routeCoords: Coord[] = stops.map((s) => s.coords || { lat: 0, lng: 0 });
  if (routeCoords.length > 0) routeCoords[routeCoords.length - 1] = RIT_CAMPUS_COORDS;

  // Current bus position from GPS
  const busCoords: Coord = gps
    ? { lat: gps.latitude, lng: gps.longitude }
    : (routeInfo?.coords || { lat: 13.0827, lng: 80.2707 });

  // Snap to route
  const snap = snapToRoute(busCoords, routeCoords);
  const displayCoords: Coord = (snap && snap.deviationM < 200) ? snap.snappedCoords : busCoords;

  // Speed and heading
  const speed = gps?.speed ?? 0;
  const heading = gps?.heading ?? undefined;

  const mapVehicles: MapVehicle[] = [{
    id: routeNo,
    vehicleNumber,
    vehicleName,
    status: "tracking" as const,
    coords: displayCoords,
    speed,
    heading,
    lastSeenAt: gps ? new Date(gps.timestamp).toISOString() : new Date().toISOString(),
    routeNo,
    selected: true,
    accuracy: gps?.accuracy,
    rawCoords: (snap && snap.deviationM < 200) ? busCoords : undefined,
  }];

  // Compute distance to campus
  const distToCampusKm = haversineMeters(displayCoords, RIT_CAMPUS_COORDS) / 1000;
  const etaMin = speed > 1 ? Math.max(1, Math.round(distToCampusKm / (speed / 60))) : Infinity;

  return (
    <div style={{ marginTop: 18 }}>
      {/* ── Live Map ── */}
      <div style={{
        padding: 12, borderRadius: 12, background: "#13161c",
        border: "1px solid #1e2330", marginBottom: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#06b6d4", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <i className="fas fa-map" /> Live Map · Start → End
          </div>
          <span style={{ fontSize: 10, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} className="animate-pulse" />
            Updates every 2s
          </span>
        </div>
        <div style={{ height: 320, borderRadius: 10, overflow: "hidden", position: "relative" }}>
          <FleetMap
            vehicles={mapVehicles}
            selectedVehicleId={routeNo}
            onSelectVehicle={() => {}}
            showRouteForVehicleId={routeNo}
            height="100%"
            centerOnSelected={true}
          />
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 16, fontSize: 10, color: "#64748b", flexWrap: "wrap" }}>
          <span><i className="fas fa-circle" style={{ color: "#f59e0b", fontSize: 7, marginRight: 4 }} /> Start (A): {stops[0]?.stop || routeInfo?.routeName || "—"}</span>
          <span><i className="fas fa-circle" style={{ color: "#ef4444", fontSize: 7, marginRight: 4 }} /> End (B): RIT Campus</span>
          <span><i className="fas fa-bus" style={{ color: "#10b981", fontSize: 9, marginRight: 4 }} /> Bus: {displayCoords.lat.toFixed(5)}, {displayCoords.lng.toFixed(5)}</span>
          <span><i className="fas fa-gauge-high" style={{ color: "#fbbf24", fontSize: 9, marginRight: 4 }} /> {Math.round(speed)} km/h</span>
          {speed < 1 && <span style={{ color: "#fbbf24", fontWeight: 700 }}>🛑 NOT MOVING</span>}
        </div>
      </div>

      {/* ── Trip Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div style={{ padding: 10, borderRadius: 10, background: "#13161c", border: "1px solid #1e2330" }}>
          <div style={{ fontSize: 9, color: "#06b6d4", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Distance</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{distToCampusKm.toFixed(1)} <span style={{ fontSize: 10, color: "#64748b" }}>km to campus</span></div>
        </div>
        <div style={{ padding: 10, borderRadius: 10, background: "#13161c", border: "1px solid #1e2330" }}>
          <div style={{ fontSize: 9, color: "#10b981", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>ETA</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
            {etaMin === Infinity ? "—" : etaMin > 60 ? `${Math.floor(etaMin / 60)}h ${etaMin % 60}m` : `${etaMin} min`}
          </div>
        </div>
        <div style={{ padding: 10, borderRadius: 10, background: "#13161c", border: "1px solid #1e2330" }}>
          <div style={{ fontSize: 9, color: "#fbbf24", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Provider</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: usingSimulated ? "#fbbf24" : "#10b981" }}>
            {usingSimulated ? "SIMULATED" : "GPS"}
          </div>
        </div>
      </div>

      {/* ── Boarding Points List ── */}
      {stops.length > 0 && (
        <DriverBoardingPoints
          routeNo={routeNo}
          busCoords={displayCoords}
          stops={stops}
        />
      )}
    </div>
  );
}

// ============================================================================
// DriverBoardingPoints — shows each boarding point with crossed/not-crossed
// status, scheduled time, and a Record Passengers button.
// ============================================================================
function DriverBoardingPoints({
  routeNo,
  busCoords,
  stops,
}: {
  routeNo: string;
  busCoords: Coord;
  stops: { stop: string; time: string; coords?: Coord }[];
}) {
  const distBusToEnd = haversineMeters(busCoords, RIT_CAMPUS_COORDS);
  const currentStopIdx = stops.findIndex((s) => {
    if (!s.coords) return false;
    return haversineMeters(busCoords, s.coords) < 200;
  });
  const crossedCount = stops.filter((s) => {
    if (!s.coords) return false;
    return distBusToEnd < haversineMeters(s.coords, RIT_CAMPUS_COORDS) - 30;
  }).length;

  return (
    <div style={{
      padding: 14, borderRadius: 12, background: "#13161c",
      border: "1px solid #1e2330",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
          <i className="fas fa-route" /> Boarding Points — {routeNo}
        </div>
        <div style={{ fontSize: 10, color: "#64748b" }}>{crossedCount} / {stops.length} crossed</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {stops.map((s, i) => {
          const stopCoords = s.coords || { lat: 0, lng: 0 };
          const distStopToEnd = haversineMeters(stopCoords, RIT_CAMPUS_COORDS);
          const isCrossed = distBusToEnd < distStopToEnd - 30;
          const isCurrent = i === currentStopIdx;
          const isFinal = i === stops.length - 1;

          return (
            <DriverBoardingPointRow
              key={i}
              index={i}
              stop={s}
              isCrossed={isCrossed}
              isCurrent={isCurrent}
              isFinal={isFinal}
              routeNo={routeNo}
            />
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// DriverBoardingPointRow — a single boarding point row
// ============================================================================
function DriverBoardingPointRow({
  index,
  stop,
  isCrossed,
  isCurrent,
  isFinal,
  routeNo,
}: {
  index: number;
  stop: { stop: string; time: string };
  isCrossed: boolean;
  isCurrent: boolean;
  isFinal: boolean;
  routeNo: string;
}) {
  const [showPassengerModal, setShowPassengerModal] = useState(false);

  const statusLabel = isCrossed ? "CROSSED" : isCurrent ? "HERE NOW" : isFinal ? "FINAL" : "UPCOMING";
  const statusColor = isCrossed ? "#10b981" : isCurrent ? "#06b6d4" : isFinal ? "#f59e0b" : "#64748b";
  const statusBg = isCrossed ? "rgba(16,185,129,0.15)" : isCurrent ? "rgba(6,182,212,0.15)" : isFinal ? "rgba(245,158,11,0.15)" : "rgba(100,116,139,0.1)";

  return (
    <>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
          borderRadius: 6,
          background: isCurrent ? "rgba(6,182,212,0.08)" : isCrossed ? "rgba(16,185,129,0.04)" : "transparent",
          border: isCurrent ? "1px solid rgba(6,182,212,0.3)" : "1px solid transparent",
        }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
          background: isCrossed ? "#10b981" : isCurrent ? "#06b6d4" : isFinal ? "#f59e0b" : "#1e2330",
          border: isCurrent ? "2px solid #06b6d4" : "none",
          boxShadow: isCrossed ? "0 0 6px #10b981" : isCurrent ? "0 0 8px #06b6d4" : "none",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isCrossed && <i className="fas fa-check" style={{ fontSize: 7, color: "#fff" }} />}
          {isCurrent && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#fff" }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 12, fontWeight: isCurrent ? 700 : 500,
            color: isCrossed ? "#10b981" : isCurrent ? "#06b6d4" : isFinal ? "#f59e0b" : "#94a3b8",
          }}>
            {index + 1}. {stop.stop}
            {isFinal && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#f59e0b", padding: "1px 5px", borderRadius: 99, background: "rgba(245,158,11,0.1)" }}>FINAL</span>}
          </span>
          <span style={{ fontSize: 10, color: "#64748b", marginLeft: 8, fontFamily: "monospace" }}>{stop.time}</span>
          {isCrossed && <span style={{ fontSize: 10, color: "#10b981", marginLeft: 8 }}>· Crossed</span>}
          {isCurrent && <span style={{ fontSize: 10, color: "#06b6d4", marginLeft: 8 }}>· Bus is here now</span>}
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 99,
          color: statusColor, background: statusBg, border: `1px solid ${statusColor}40`,
        }}>
          {statusLabel}
        </span>
        {(isCrossed || isCurrent) && (
          <button
            onClick={() => setShowPassengerModal(true)}
            style={{
              fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
              background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)",
              color: "#fbbf24", cursor: "pointer",
            }}
            title="Record passengers boarding/alighting at this stop"
          >
            <i className="fas fa-user-plus" style={{ fontSize: 8, marginRight: 3 }} />
            Record
          </button>
        )}
      </div>

      {showPassengerModal && (
        <DriverPassengerModal
          stopName={stop.stop}
          routeNo={routeNo}
          onClose={() => setShowPassengerModal(false)}
        />
      )}
    </>
  );
}

// ============================================================================
// DriverPassengerModal — record how many passengers boarded/alighted/waiting
// ============================================================================
function DriverPassengerModal({
  stopName,
  routeNo,
  onClose,
}: {
  stopName: string;
  routeNo: string;
  onClose: () => void;
}) {
  const [boarded, setBoarded] = useState(0);
  const [alighted, setAlighted] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    console.log("Passenger count saved:", { stopName, routeNo, boarded, alighted, waiting });
    setSaved(true);
    setTimeout(onClose, 1500);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#10131f", border: "1px solid #1f2538", borderRadius: 14,
          padding: 20, maxWidth: 340, width: "calc(100% - 32px)", margin: "0 16px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {saved ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "rgba(16,185,129,0.15)", display: "flex",
              alignItems: "center", justifyContent: "center", margin: "0 auto 12px",
            }}>
              <i className="fas fa-check" style={{ fontSize: 24, color: "#10b981" }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#10b981" }}>Passenger count saved!</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{stopName} · {routeNo}</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
              <i className="fas fa-users" style={{ marginRight: 4 }} /> Passenger Count
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
              Record passengers at <span style={{ color: "#fbbf24" }}>{stopName}</span>
            </div>

            <DriverCounterRow label="Boarded (got on)" icon="🟢" value={boarded} onChange={setBoarded} />
            <DriverCounterRow label="Alighted (got off)" icon="🟠" value={alighted} onChange={setAlighted} />
            <DriverCounterRow label="Waiting at stop" icon="🔵" value={waiting} onChange={setWaiting} />

            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  border: "1px solid #1f2538", background: "#0a0d18",
                  color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleSave}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                SAVE
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DriverCounterRow({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1a2032" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          style={{
            width: 28, height: 28, borderRadius: 8,
            background: "#1a2032", border: "1px solid #2a3252", color: "#94a3b8",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}
        >−</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#fff", width: 32, textAlign: "center" }}>{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          style={{
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}
        >+</button>
      </div>
    </div>
  );
}
