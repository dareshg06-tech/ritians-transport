"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { routes as ALL_ROUTES, routeStops, RIT_CAMPUS_COORDS, type Coord } from "@/lib/ritians/data";

interface LiveTrackingModalProps {
  open: boolean;
  onClose: () => void;
}

interface BusPosition {
  routeNo: string;
  routeName: string;
  no: number;
  coords: Coord;
  progress: number;
  segIdx: number;
  speed: number;
}

// Load Leaflet map client-side only
const FleetMap = dynamic(() => import("../fleet/FleetMap.client").then((m) => m.FleetMap), {
  ssr: false,
  loading: () => <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)" }}><i className="fas fa-spinner fa-spin" /> Loading map…</div>,
}) as typeof import("../fleet/FleetMap.client").FleetMap;
type MapVehicle = import("../fleet/FleetMap.client").MapVehicle;

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

// Track ALL routes — user wants "where is my bus" for all buses
const TRACKED_ROUTE_NOS = ALL_ROUTES.map((r) => r.routeNo);

function initialBuses(): BusPosition[] {
  return TRACKED_ROUTE_NOS.map((rno) => {
    const r = ALL_ROUTES.find((x) => x.routeNo === rno)!;
    const stops = routeStops[rno] || [];
    const firstStop = stops[0];
    const startCoords = firstStop?.coords || r.coords;
    return { routeNo: r.routeNo, routeName: r.routeName, no: r.no, coords: startCoords, progress: 0, segIdx: 0, speed: 35 };
  });
}

export function LiveTrackingModal({ open, onClose }: LiveTrackingModalProps) {
  const [selectedRoute, setSelectedRoute] = useState<string>("R01");
  const [buses, setBuses] = useState<BusPosition[]>(() => initialBuses());
  const [tick, setTick] = useState(0);
  const [followToggle, setFollowToggle] = useState(true);
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const tickRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      setBuses((prev) =>
        prev.map((b) => {
          const r = ALL_ROUTES.find((x) => x.routeNo === b.routeNo);
          if (!r) return b;
          const stops = routeStops[b.routeNo] || [];
          if (stops.length < 2) return b;
          const coordsList: Coord[] = stops.map((s) => s.coords || r.coords);
          coordsList[coordsList.length - 1] = RIT_CAMPUS_COORDS;

          let newSeg = b.segIdx;
          let newProg = b.progress + 0.08;
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
    }, 2000);
    return () => clearInterval(id);
  }, [open]);

  if (!open) return null;

  const selRoute = ALL_ROUTES.find((r) => r.routeNo === selectedRoute);
  const selectedBus = buses.find((b) => b.routeNo === selectedRoute);
  const busDistanceKm = selectedBus ? haversineDist(selectedBus.coords, RIT_CAMPUS_COORDS) / 1000 : 0;
  const etaMin = selectedBus ? Math.max(1, Math.round(busDistanceKm / (Math.max(selectedBus.speed, 20) / 60))) : 0;

  // Build map vehicles
  const mapVehicles: MapVehicle[] = buses.map((b) => ({
    id: b.routeNo,
    vehicleNumber: `BUS-${String(b.no).padStart(3, "0")}`,
    vehicleName: b.routeName,
    status: "live" as const,
    coords: b.coords,
    speed: b.speed,
    lastSeenAt: new Date().toISOString(),
    routeNo: b.routeNo,
    selected: b.routeNo === selectedRoute,
  }));

  return (
    <div className="rt-modal-overlay" onClick={onClose} style={{ padding: 0, alignItems: "stretch", justifyContent: "stretch" }}>
      <div
        className="rt-modal-box"
        style={{ maxWidth: "100%", maxHeight: "100vh", borderRadius: 0, border: "none", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 20px", background: "rgba(8,11,20,0.95)", borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #f59e0b, #f97316)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: "#fff",
            }}>
              <i className="fas fa-bus-simple" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Where is my Bus</div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Live Tracking • Chennai Routes</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 99,
              background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)",
              color: "#10b981", fontSize: 11, fontWeight: 600,
            }}>
              <i className="fas fa-wifi" style={{ animation: "rtPulse 2s infinite" }} /> ONLINE
            </div>
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", borderRadius: 99,
              width: 30, height: 30, color: "var(--text2)", cursor: "pointer", fontSize: 12,
            }}>
              <i className="fas fa-xmark" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 8px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div style={{ padding: 16, borderRadius: 12, background: "#13161c", border: "1px solid #1e2330" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "#06b6d4", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <i className="fas fa-globe" /> Bus Distance
              </div>
              <div style={{ width: "100%", height: 3, background: "#1e2330", borderRadius: 99, marginBottom: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, busDistanceKm)}%`, background: "#06b6d4", borderRadius: 99, transition: "width 0.5s ease" }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{busDistanceKm.toFixed(1)} km</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>From your live location</div>
            </div>
            <div style={{ padding: 16, borderRadius: 12, background: "#13161c", border: "1px solid #1e2330" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "#10b981", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <i className="fas fa-clock" /> ETA to RIT
              </div>
              <div style={{ width: "100%", height: 3, background: "#1e2330", borderRadius: 99, marginBottom: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, etaMin)}%`, background: "#10b981", borderRadius: 99, transition: "width 0.5s ease" }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                {etaMin > 60 ? `${Math.floor(etaMin / 60)}h ${etaMin % 60}m` : `${etaMin} min`}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{selectedBus ? `${selectedBus.routeName} → RIT Campus` : "Waiting for bus"}</div>
            </div>
          </div>

          {/* Map section — real Leaflet map */}
          <div style={{ padding: 12, borderRadius: 12, background: "#13161c", border: "1px solid #1e2330", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#06b6d4", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <i className="fas fa-map" /> Live Map
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>Follow</span>
                <button
                  onClick={() => setFollowToggle(!followToggle)}
                  style={{
                    width: 36, height: 20, borderRadius: 99, border: "none", cursor: "pointer",
                    background: followToggle ? "#06b6d4" : "#374151", position: "relative",
                    transition: "background 0.2s ease",
                  }}
                >
                  <div style={{
                    position: "absolute", top: 2, left: followToggle ? 18 : 2,
                    width: 16, height: 16, borderRadius: "50%", background: "#fff",
                    transition: "left 0.2s ease",
                  }} />
                </button>
                {selectedBus && (
                  <>
                    <span style={{ fontSize: 10, color: "#10b981", display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                      LIVE · {tick}s ago
                    </span>
                    <button
                      onClick={() => setFullscreenMap(true)}
                      style={{
                        padding: "4px 10px", borderRadius: 6, border: "1px solid #1e2330", background: "#1a1f29",
                        color: "#94a3b8", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                      }}
                    >
                      <i className="fas fa-expand" /> Full
                    </button>
                  </>
                )}
              </div>
            </div>
            <div style={{ height: 320, borderRadius: 10, overflow: "hidden", position: "relative" }}>
              <FleetMap
                vehicles={mapVehicles}
                selectedVehicleId={selectedRoute}
                onSelectVehicle={(id) => setSelectedRoute(id)}
                showRouteForVehicleId={selectedRoute}
                height="100%"
                centerOnSelected={followToggle}
              />
            </div>
          </div>

          {/* Fullscreen map overlay */}
          {fullscreenMap && (
            <div style={{
              position: "fixed", inset: 0, zIndex: 300, background: "#0a0d18",
              display: "flex", flexDirection: "column",
            }}>
              {/* Fullscreen header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 16px", background: "#000", borderBottom: "1px solid #1e2330",
              }}>
                <button
                  onClick={() => setFullscreenMap(false)}
                  style={{
                    background: "transparent", border: "none", color: "#06b6d4", cursor: "pointer",
                    fontSize: 13, display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <i className="fas fa-chevron-down" /> Back
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {selectedBus && (
                    <span style={{ fontSize: 11, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                      LIVE · {tick}s ago
                    </span>
                  )}
                  <button
                    onClick={() => setFollowToggle(!followToggle)}
                    style={{
                      padding: "4px 10px", borderRadius: 6, border: followToggle ? "1px solid #06b6d4" : "1px solid #1e2330",
                      background: followToggle ? "rgba(6,182,212,0.1)" : "#1a1f29",
                      color: followToggle ? "#06b6d4" : "#94a3b8", fontSize: 10, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    <i className="fas fa-crosshairs" /> Following
                  </button>
                </div>
              </div>
              {/* Fullscreen map */}
              <div style={{ flex: 1, position: "relative" }}>
                <FleetMap
                  vehicles={mapVehicles}
                  selectedVehicleId={selectedRoute}
                  onSelectVehicle={(id) => setSelectedRoute(id)}
                  showRouteForVehicleId={selectedRoute}
                  height="100%"
                  centerOnSelected={followToggle}
                />
              </div>
            </div>
          )}

          {/* Boarding Points tracker — shows which stops the bus has crossed */}
          {selectedBus && selRoute && (() => {
            const stops = routeStops[selectedRoute] || [];
            const r = selRoute;
            const coordsList: Coord[] = stops.map((s) => s.coords || r.coords);
            if (coordsList.length > 0) coordsList[coordsList.length - 1] = RIT_CAMPUS_COORDS;
            const currentPos = selectedBus.coords;

            // Determine which stops the bus has crossed
            const haversine = (a: Coord, b: Coord) => {
              const R = 6371000;
              const toRad = (d: number) => (d * Math.PI) / 180;
              const dLat = toRad(b.lat - a.lat);
              const dLng = toRad(b.lng - a.lng);
              const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
              return 2 * R * Math.asin(Math.sqrt(h));
            };
            const distToEnd = haversine(currentPos, RIT_CAMPUS_COORDS);
            const crossedStops = new Set<number>();
            stops.forEach((s, i) => {
              const sc = s.coords || r.coords;
              const distStopToEnd = haversine(sc, RIT_CAMPUS_COORDS);
              if (distToEnd < distStopToEnd - 30) crossedStops.add(i);
            });
            // Also mark stops that the bus is currently at (within 150m)
            const currentStopIdx = stops.findIndex((s, i) => {
              const sc = s.coords || r.coords;
              return haversine(currentPos, sc) < 150;
            });

            const startLocation = stops.length > 0 ? stops[0].stop : r.routeName;
            const endLocation = stops.length > 0 ? stops[stops.length - 1].stop : "RIT Campus";
            const crossedCount = crossedStops.size;
            const totalStops = stops.length;
            const progressPct = totalStops > 0 ? Math.round((crossedCount / totalStops) * 100) : 0;

            return (
              <div style={{ padding: 16, borderRadius: 12, background: "#13161c", border: "1px solid #1e2330", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#f59e0b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <i className="fas fa-route" /> Boarding Points
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{crossedCount} / {totalStops} crossed · {progressPct}%</div>
                </div>

                {/* Route summary */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                    <div style={{ width: 2, height: 16, background: "#1e2330" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", boxShadow: "0 0 6px #f59e0b" }} />
                  </div>
                  <div style={{ flex: 1, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#10b981" }}>{startLocation}</div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>Departure: {stops[0]?.time || r.start}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 600, color: "#f59e0b" }}>{endLocation}</div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>Arrival: {stops[stops.length - 1]?.time || "7.40 am"}</div>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ width: "100%", height: 4, background: "#1e2330", borderRadius: 99, marginBottom: 12, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg, #10b981, #f59e0b)", borderRadius: 99, transition: "width 0.5s ease" }} />
                </div>

                {/* Stops list — with distance from previous + per-stop ETA */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 280, overflowY: "auto" }}>
                  {stops.map((s, i) => {
                    const isCrossed = crossedStops.has(i);
                    const isCurrent = i === currentStopIdx;
                    const sc = s.coords || r.coords;
                    const distFromBus = haversine(currentPos, sc);
                    // Distance from previous stop
                    const prevStop = i > 0 ? stops[i - 1] : null;
                    const prevCoords = prevStop ? (prevStop.coords || r.coords) : sc;
                    const distFromPrev = haversine(prevCoords, sc);
                    // Per-stop ETA based on distance from bus + speed
                    const stopEta = distFromBus < 150 ? 0 : Math.max(1, Math.round((distFromBus / 1000) / (Math.max(selectedBus!.speed, 20) / 60)));
                    const isFinal = i === stops.length - 1;
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                        borderRadius: 6,
                        background: isCurrent ? "rgba(6,182,212,0.1)" : isCrossed ? "rgba(16,185,129,0.05)" : "transparent",
                        border: isCurrent ? "1px solid rgba(6,182,212,0.3)" : "1px solid transparent",
                      }}>
                        {/* Status circle */}
                        <div style={{
                          width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                          background: isCrossed ? "#10b981" : isCurrent ? "#06b6d4" : isFinal ? "#f59e0b" : "#1e2330",
                          border: isCurrent ? "2px solid #06b6d4" : "none",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: isCrossed ? "0 0 6px #10b981" : isCurrent ? "0 0 8px #06b6d4" : "none",
                        }}>
                          {isCrossed && <i className="fas fa-check" style={{ fontSize: 7, color: "#fff" }} />}
                          {isCurrent && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#fff" }} />}
                        </div>
                        {/* Stop name + time */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{
                            fontSize: 12, fontWeight: isCurrent ? 700 : 500,
                            color: isCrossed ? "#10b981" : isCurrent ? "#06b6d4" : isFinal ? "#f59e0b" : "#94a3b8",
                          }}>
                            {i + 1}. {s.stop}
                            {isFinal && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#f59e0b", padding: "1px 5px", borderRadius: 99, background: "rgba(245,158,11,0.1)" }}>FINAL</span>}
                          </span>
                          <span style={{ fontSize: 10, color: "#64748b", marginLeft: 8, fontFamily: "var(--font-mono)" }}>{s.time}</span>
                        </div>
                        {/* Distance from previous stop */}
                        <span style={{ fontSize: 10, color: "#64748b", fontFamily: "var(--font-mono)" }}>
                          {i > 0 ? `${(distFromPrev / 1000).toFixed(1)} km` : "—"}
                        </span>
                        {/* Status badge */}
                        {isCrossed ? (
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#10b981", padding: "2px 6px", borderRadius: 99, background: "rgba(16,185,129,0.1)" }}>CROSSED</span>
                        ) : isCurrent ? (
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#06b6d4", padding: "2px 6px", borderRadius: 99, background: "rgba(6,182,212,0.1)" }}>HERE NOW</span>
                        ) : (
                          <span style={{ fontSize: 9, fontWeight: 700, color: stopEta > 0 ? "#06b6d4" : "#64748b", padding: "2px 6px", borderRadius: 99, background: stopEta > 0 ? "rgba(6,182,212,0.08)" : "rgba(255,255,255,0.03)" }}>
                            {stopEta > 0 ? `${stopEta} min` : "—"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Route selector */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#06b6d4", marginBottom: 8 }}>
              <i className="fas fa-route" /> Select Route
            </div>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px",
                background: "#13161c", border: "1px solid #1e2330", borderRadius: 8,
                color: "#e2e8f0", fontSize: 13, outline: "none", cursor: "pointer", appearance: "none",
              }}
            >
              {ALL_ROUTES.map((r) => (
                <option key={r.routeNo} value={r.routeNo}>{r.routeNo} · {r.routeName} (Bus {r.no})</option>
              ))}
            </select>
          </div>

          {/* Route cards */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", marginBottom: 8 }}>
              {buses.length} Buses Live on Map
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {buses.map((b) => {
                const r = ALL_ROUTES.find((x) => x.routeNo === b.routeNo);
                const isSelected = b.routeNo === selectedRoute;
                const isLive = b.speed > 0;
                const distKm = r ? Math.round(haversineDist(b.coords, RIT_CAMPUS_COORDS) / 100) / 10 : 0;
                const etaMin = r ? Math.max(1, Math.round(distKm / (Math.max(b.speed, 20) / 60))) : 0;
                const etaH = Math.floor(etaMin / 60);
                const etaM = etaMin % 60;
                const routeStopsList = r ? (routeStops[r.routeNo] || []) : [];
                const startLocation = routeStopsList.length > 0 ? routeStopsList[0].stop : (r?.routeName || "—");
                const endLocation = routeStopsList.length > 0 ? routeStopsList[routeStopsList.length - 1].stop : "RIT Campus";
                return (
                  <button
                    key={b.routeNo}
                    onClick={() => setSelectedRoute(b.routeNo)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", borderRadius: 10,
                      background: isSelected ? "rgba(6,182,212,0.08)" : "#13161c",
                      border: `1px solid ${isSelected ? "#06b6d4" : "#1e2330"}`,
                      cursor: "pointer", transition: "all 0.18s ease", textAlign: "left",
                    }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, background: "rgba(255,255,255,0.06)", border: "1px solid #1e2330", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ fontSize: 8, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>RTE</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", fontFamily: "var(--font-mono)" }}>{b.routeNo}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
                        {startLocation} → {endLocation}
                      </div>
                      <div style={{ display: "flex", gap: 12, marginTop: 3, fontSize: 11, color: "#64748b" }}>
                        <span><i className="fas fa-road" style={{ marginRight: 4 }} />{distKm.toFixed(1)} km</span>
                        {isLive ? (
                          <>
                            <span><i className="fas fa-clock" style={{ marginRight: 4 }} />~{etaH > 0 ? `${etaH}h ` : ""}{etaM}m</span>
                            <span style={{ color: "#06b6d4" }}><i className="fas fa-gauge-high" style={{ marginRight: 4 }} />{Math.round(b.speed)} km/h</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {/* Status badge: LIVE (green) or OFF (red) */}
                    {isLive ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 99, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", fontSize: 10, fontWeight: 700, color: "#10b981", flexShrink: 0 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} /> LIVE
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 99, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 10, fontWeight: 700, color: "#ef4444", flexShrink: 0 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} /> OFF
                      </div>
                    )}
                    <i className="fas fa-chevron-right" style={{ color: "#64748b", fontSize: 10, flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* System Status */}
          <div style={{ padding: 16, borderRadius: 12, background: "#13161c", border: "1px solid #1e2330", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <i className="fas fa-signal" /> System Status
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
              {[
                { icon: "fa-location-crosshairs", label: "Your Location", on: true },
                { icon: "fa-wifi", label: "Network", on: true },
                { icon: "fa-paper-plane", label: "Server", on: true },
                { icon: "fa-tower-broadcast", label: "Live Location", on: selectedBus?.speed ? selectedBus.speed > 0 : false },
                { icon: "fa-wave-square", label: "Bus Tracking", on: selectedBus?.speed ? selectedBus.speed > 0 : false },
                { icon: "fa-map-pin", label: "Trip Status", on: selectedBus?.speed ? selectedBus.speed > 0 : false },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#94a3b8" }}>
                    <i className={`fas ${item.icon}`} style={{ color: item.on ? "#10b981" : "#64748b", width: 14, textAlign: "center" }} />
                    <span>{item.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.on ? "#10b981" : "#ef4444", boxShadow: `0 0 6px ${item.on ? "#10b981" : "#ef4444"}` }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: item.on ? "#10b981" : "#ef4444" }}>{item.on ? "ON" : "OFF"}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: "#64748b" }}>
              Live updates from driver every 2 seconds. Last update: {tick > 0 ? `${tick * 2}s ago` : "never"}.
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", padding: "12px 0 8px", borderTop: "1px solid rgba(30,35,48,0.5)" }}>
            <div style={{ fontSize: 11, color: "#64748b" }}>Where is my Bus · 52 Chennai routes · All buses go to RIT Campus</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export {};
