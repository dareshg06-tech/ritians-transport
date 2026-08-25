"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFleetSocket, type VehicleLocationUpdate } from "@/lib/fleet/useFleetSocket";
import { useToast } from "@/lib/ritians/toast";
import { FLEET, getRouteStopsWithCoords, computeBusProgress } from "@/lib/ritians/fleet";
import { RIT_CAMPUS_COORDS, type Coord } from "@/lib/ritians/data";
import { haversineMeters, STOP_CROSSING_RADIUS_M, COLLEGE_ARRIVAL_RADIUS_M } from "@/lib/ritians/geo";
import type { Vehicle } from "./Dashboard";

interface DriverPortalProps {
  vehicles: Vehicle[];
  onBack: () => void;
}

type GPSError = "denied" | "unavailable" | "timeout" | "generic" | null;

interface GPSData {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  timestamp: number;
}

export function DriverPortal({ vehicles, onBack }: DriverPortalProps) {
  const { show, showStopCrossed, showArrived } = useToast();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [sharing, setSharing] = useState(false);
  const [gps, setGps] = useState<GPSData | null>(null);
  const [error, setError] = useState<GPSError>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const watchIdRef = useRef<number | null>(null);
  const crossedStopsRef = useRef<Set<number>>(new Set());
  const arrivedRef = useRef<boolean>(false);
  const [crossedStops, setCrossedStops] = useState<number>(0);
  const [progress, setProgress] = useState<{ percent: number; lastCrossed: string | null; nextStop: string | null; etaMin: number }>({ percent: 0, lastCrossed: null, nextStop: null, etaMin: 0 });

  // WebSocket for broadcasting location
  const { status: wsStatus, emitLocation, emitStop, emitArrived, emitStopSharing } = useFleetSocket({});

  // Pick first vehicle by default
  useEffect(() => {
    if (!selectedVehicleId && vehicles.length > 0) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  const vehicle = vehicles.find((v) => v.id === selectedVehicleId);

  const handlePosition = useCallback((pos: GeolocationPosition) => {
    const data: GPSData = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      speed: pos.coords.speed != null ? pos.coords.speed * 3.6 : null, // m/s → km/h
      heading: pos.coords.heading,
      altitude: pos.coords.altitude,
      timestamp: pos.timestamp,
    };
    setGps(data);
    setError(null);

    if (!vehicle) return;
    const currentPos: Coord = { lat: data.latitude, lng: data.longitude };

    // Save to backend (best-effort)
    fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId: vehicle.id,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        speed: data.speed,
        heading: data.heading,
        altitude: data.altitude,
        isSimulated: false,
      }),
    }).catch(() => {});

    // Check stop crossings
    const stops = getRouteStopsWithCoords(vehicle.routeNo || "");
    const crossedSet = crossedStopsRef.current;
    for (let i = 0; i < stops.length; i++) {
      if (crossedSet.has(i)) continue;
      const sc = stops[i].coords || RIT_CAMPUS_COORDS;
      const dist = haversineMeters(currentPos, sc);
      if (dist < STOP_CROSSING_RADIUS_M) {
        crossedSet.add(i);
        setCrossedStops(crossedSet.size);
        const isLastStop = i === stops.length - 1;
        const nextStopIdx = i + 1;
        const nextStop = nextStopIdx < stops.length
          ? { name: stops[nextStopIdx].stop, sequence: nextStopIdx, coords: stops[nextStopIdx].coords || RIT_CAMPUS_COORDS }
          : null;
        const etaMin = nextStop && data.speed && data.speed > 1
          ? Math.max(1, Math.round(haversineMeters(currentPos, nextStop.coords) / 1000 / (data.speed / 60)))
          : nextStop ? 1 : 0;

        // Save stop crossing to backend
        fetch("/api/stop-crossings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicleId: vehicle.id,
            routeNo: vehicle.routeNo,
            stopName: stops[i].stop,
            stopLat: sc.lat,
            stopLng: sc.lng,
            sequence: i,
          }),
        }).catch(() => {});

        // Show toast
        showStopCrossed({
          vehicleId: vehicle.id,
          vehicleName: vehicle.vehicleName,
          routeNo: vehicle.routeNo || "",
          stopName: stops[i].stop,
          sequence: i,
          crossedAt: Date.now(),
          nextStop: nextStop ? { name: nextStop.name, sequence: nextStop.sequence, etaMinutes: etaMin } : null,
        });

        // Broadcast via WS
        emitStop({
          vehicleId: vehicle.id,
          vehicleName: vehicle.vehicleName,
          routeNo: vehicle.routeNo || "",
          stopName: stops[i].stop,
          sequence: i,
          crossedAt: Date.now(),
          nextStop: nextStop ? { name: nextStop.name, sequence: nextStop.sequence, etaMinutes: etaMin } : null,
        });
      }
    }

    // Check college arrival (last stop = RIT Campus)
    if (!arrivedRef.current) {
      const lastStop = stops[stops.length - 1];
      if (lastStop) {
        const sc = lastStop.coords || RIT_CAMPUS_COORDS;
        const dist = haversineMeters(currentPos, sc);
        if (dist < COLLEGE_ARRIVAL_RADIUS_M) {
          arrivedRef.current = true;
          showArrived({ vehicleId: vehicle.id, vehicleName: vehicle.vehicleName, arrivedAt: Date.now() });
          emitArrived({ vehicleId: vehicle.id, vehicleName: vehicle.vehicleName, arrivedAt: Date.now() });
          // Stop tracking session, reset crossings
          fetch("/api/tracking/stop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vehicleId: vehicle.id }),
          }).catch(() => {});
          show("Arrived at RIT Campus — tracking session saved.", "success");
          setTimeout(() => {
            arrivedRef.current = false;
            crossedStopsRef.current.clear();
            setCrossedStops(0);
          }, 5000);
        }
      }
    }

    // Compute progress for UI
    const p = computeBusProgress(vehicle.routeNo || "", currentPos, Array.from(crossedSet).map((s) => ({ stopName: stops[s].stop, sequence: s })));
    setProgress({
      percent: p.progressPercent,
      lastCrossed: p.lastCrossed?.name || null,
      nextStop: p.nextStop?.name || null,
      etaMin: p.nextStop ? Math.max(1, Math.round(p.nextStop.distanceMeters / 1000 / ((data.speed || 30) / 60))) : 0,
    });

    // Broadcast via WebSocket
    emitLocation({
      vehicleId: vehicle.id,
      vehicleNumber: vehicle.vehicleNumber,
      vehicleName: vehicle.vehicleName,
      routeNo: vehicle.routeNo || "",
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
      speed: data.speed || 0,
      heading: data.heading || 0,
      altitude: data.altitude || undefined,
      isSimulated: false,
      timestamp: new Date(data.timestamp).toISOString(),
      lastCrossedStop: p.lastCrossed ? { name: p.lastCrossed.name, sequence: p.lastCrossed.sequence, crossedAt: Date.now() } : null,
      nextStop: p.nextStop ? { name: p.nextStop.name, sequence: p.nextStop.sequence, etaMinutes: progress.etaMin, distanceMeters: p.nextStop.distanceMeters } : null,
      progressPercent: p.progressPercent,
    });
  }, [vehicle, emitLocation, emitStop, emitArrived, showStopCrossed, showArrived, show, progress.etaMin]);

  const handleError = useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      setError("denied");
      setErrorMsg("Location permission is required to share your live GPS location.");
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      setError("unavailable");
      setErrorMsg("GPS signal is currently unavailable. Please move to an area with better GPS reception.");
    } else if (err.code === err.TIMEOUT) {
      setError("timeout");
      setErrorMsg("GPS request timed out. Retrying…");
    } else {
      setError("generic");
      setErrorMsg(err.message || "Unknown GPS error.");
    }
  }, []);

  const startSharing = useCallback(async () => {
    if (!vehicle) {
      show("Select a vehicle first", "error");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("unavailable");
      setErrorMsg("GPS is not supported by this browser.");
      return;
    }

    // Reset state
    crossedStopsRef.current.clear();
    setCrossedStops(0);
    arrivedRef.current = false;
    setError(null);
    setErrorMsg("");
    setSharing(true);

    // Start tracking session in backend
    fetch("/api/tracking/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId: vehicle.id }),
    }).catch(() => {});

    // Watch position
    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    });

    show("Live location sharing started", "success");
  }, [vehicle, handlePosition, handleError, show]);

  const stopSharing = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
    if (vehicle) {
      emitStopSharing(vehicle.id);
      fetch("/api/tracking/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: vehicle.id }),
      }).catch(() => {});
    }
    show("Location sharing stopped", "info");
  }, [vehicle, emitStopSharing, show]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Stop sharing when vehicle changes
  useEffect(() => {
    if (sharing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      stopSharing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicleId]);

  return (
    <div className="rt-gps-portal">
      <div className="rt-gps-card-elite">
        <div className="rt-gps-hero-elite">
          <div className="rt-gps-hero-icon-elite"><i className="fas fa-location-arrow" /></div>
          <h1>Driver GPS Portal</h1>
          <p>Share your live location with the fleet tracking system</p>
        </div>

        <div className="rt-gps-body-elite">
          {/* Vehicle selector */}
          <div className="rt-gps-label" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 8 }}>
            Your Vehicle
          </div>
          <div className="rt-gps-select-wrap" style={{ marginBottom: 18 }}>
            <i className="fas fa-bus prefix" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", fontSize: 14, pointerEvents: "none" }} />
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              disabled={sharing}
              style={{
                width: "100%", padding: "13px 40px 13px 38px",
                background: "rgba(255,255,255,0.045)", border: "1px solid var(--border2)", borderRadius: "var(--r)",
                color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 14, outline: "none", cursor: "pointer",
                appearance: "none",
              }}
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicleName} · {v.vehicleNumber} · R{v.routeNo || "—"}
                </option>
              ))}
            </select>
            <i className="fas fa-chevron-down" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", fontSize: 12, pointerEvents: "none" }} />
          </div>

          {/* Status message */}
          <div className={`rt-gps-status-msg ${sharing ? "active" : "idle"}`}>
            <i className={sharing ? "fas fa-circle-check" : "fas fa-circle-info"} />
            <span>
              {sharing
                ? "Your location is currently being shared with the tracking system."
                : "Your location is currently not being shared."}
            </span>
          </div>

          {/* Start/Stop button */}
          {!sharing ? (
            <button className="rt-gps-share-btn-elite start" onClick={startSharing}>
              <i className="fas fa-rocket" /> Start Sharing Location
            </button>
          ) : (
            <button className="rt-gps-share-btn-elite stop" onClick={stopSharing}>
              <i className="fas fa-stop" /> Stop Sharing Location
            </button>
          )}

          {/* Progress bar (visible when sharing) */}
          {sharing && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>
                <span>{progress.lastCrossed ? `Last crossed: ${progress.lastCrossed}` : "Starting trip…"}</span>
                <span>{Math.round(progress.percent)}%</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${progress.percent}%`,
                  background: "linear-gradient(90deg, var(--accent2), var(--accent))",
                  transition: "width 0.5s ease",
                  borderRadius: 99,
                }} />
              </div>
              {progress.nextStop && (
                <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 6, textAlign: "center" }}>
                  Next: <strong style={{ color: "var(--accent2)" }}>{progress.nextStop}</strong> · ETA {progress.etaMin} min
                </div>
              )}
              {crossedStops > 0 && (
                <div style={{ fontSize: 11, color: "#5EEAB0", marginTop: 4, textAlign: "center" }}>
                  ✓ {crossedStops} stop{crossedStops === 1 ? "" : "s"} crossed
                </div>
              )}
            </div>
          )}

          {/* GPS telemetry */}
          {sharing && gps && (
            <div className="rt-gps-telemetry">
              <div className="rt-gps-telemetry-head">
                <span className="title">GPS Status</span>
                <span className="indicator">Connected</span>
              </div>
              <div className="rt-gps-telemetry-grid">
                <div className="rt-gps-tel-row">
                  <div className="lbl">Latitude</div>
                  <div className="val cyan">{gps.latitude.toFixed(5)}</div>
                </div>
                <div className="rt-gps-tel-row">
                  <div className="lbl">Longitude</div>
                  <div className="val cyan">{gps.longitude.toFixed(5)}</div>
                </div>
                <div className="rt-gps-tel-row">
                  <div className="lbl">Accuracy</div>
                  <div className="val green">{Math.round(gps.accuracy)} m</div>
                </div>
                <div className="rt-gps-tel-row">
                  <div className="lbl">Speed</div>
                  <div className="val orange">{gps.speed != null ? `${Math.round(gps.speed)} km/h` : "—"}</div>
                </div>
                <div className="rt-gps-tel-row">
                  <div className="lbl">Heading</div>
                  <div className="val">{gps.heading != null ? `${Math.round(gps.heading)}°` : "—"}</div>
                </div>
                <div className="rt-gps-tel-row">
                  <div className="lbl">Altitude</div>
                  <div className="val">{gps.altitude != null ? `${Math.round(gps.altitude)} m` : "—"}</div>
                </div>
                <div className="rt-gps-tel-row">
                  <div className="lbl">Last Update</div>
                  <div className="val" style={{ fontSize: 11 }}>
                    {new Date(gps.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </div>
                </div>
                <div className="rt-gps-tel-row">
                  <div className="lbl">Update Freq</div>
                  <div className="val" style={{ fontSize: 11 }}>Every 2–5s</div>
                </div>
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="rt-gps-error">
              <i className="fas fa-triangle-exclamation" />
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  {error === "denied" ? "Location Permission Denied" :
                   error === "unavailable" ? "GPS Unavailable" :
                   error === "timeout" ? "GPS Timeout" : "GPS Error"}
                </div>
                {errorMsg}
                {error === "denied" && (
                  <div style={{ marginTop: 6, fontSize: 11 }}>
                    To fix: open browser settings → site permissions → location → allow.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Connection status */}
          <div style={{ marginTop: 14, fontSize: 11, color: "var(--text3)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: wsStatus === "connected" ? "#34D399" : wsStatus === "connecting" ? "#FBBF24" : "#F87171",
              boxShadow: wsStatus === "connected" ? "0 0 6px #34D399" : "none",
            }} />
            WebSocket: {wsStatus === "connected" ? "Connected" : wsStatus === "connecting" ? "Connecting…" : "Disconnected"}
          </div>

          {/* Back button */}
          <button className="rt-btn rt-btn-ghost rt-btn-sm rt-btn-full" style={{ marginTop: 14 }} onClick={onBack}>
            <i className="fas fa-arrow-left" /> Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
