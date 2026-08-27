"use client";

import { useEffect, useRef, useState } from "react";
import { routes, routeStops, RIT_CAMPUS_COORDS, type Coord } from "@/lib/ritians/data";
import { useToast } from "@/lib/ritians/toast";

interface DriverGpsProps {
  onBack: () => void;
  onOpenTracking: () => void;
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

export function DriverGpsPortal({ onBack, onOpenTracking }: DriverGpsProps) {
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
  const watchIdRef = useRef<number | null>(null);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segIdxRef = useRef(0);
  const progRef = useRef(0);

  const vehicle = routes.find((r) => r.routeNo === selectedRoute);
  // The actual DB vehicle ID for the selected route
  const dbVehicleId = routeToVehicleId[selectedRoute] || null;

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
        <button className={`rt-gps-nav-btn ${sharing ? "active" : ""}`} onClick={onOpenTracking}>
          <i className="fas fa-satellite-dish" /> Live Tracking
        </button>
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
                  <span className={`rt-gps-data-value ${gps ? (gps.speed > 0 ? "orange" : "idle") : "idle"}`}>
                    {gps ? `${Math.round(gps.speed)} km/h` : "—"}
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

          {/* Back button */}
          <button className="rt-btn rt-btn-ghost rt-btn-sm rt-btn-full" style={{ marginTop: 14 }} onClick={onBack}>
            <i className="fas fa-arrow-left" /> Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
