"use client";

import { useEffect, useRef, useState } from "react";
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
}

function lerp(a: Coord, b: Coord, t: number): Coord {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

function project(c: Coord, bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number }) {
  const x = ((c.lng - bbox.minLng) / (bbox.maxLng - bbox.minLng)) * 100;
  const y = (1 - (c.lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * 100;
  return { x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) };
}

const BBOX = { minLat: 12.6, maxLat: 13.45, minLng: 79.3, maxLng: 80.45 };

// The fixed set of routes we track live (always the same — no need to reset state)
const TRACKED_ROUTE_NOS = ["R01", "R12", "R24", "R16B", "R29", "R05"];

function initialBuses(): BusPosition[] {
  return TRACKED_ROUTE_NOS.map((rno) => {
    const r = ALL_ROUTES.find((x) => x.routeNo === rno)!;
    const stops = routeStops[rno] || [];
    const firstStop = stops[0];
    const startCoords = firstStop?.coords || r.coords;
    return {
      routeNo: r.routeNo,
      routeName: r.routeName,
      no: r.no,
      coords: startCoords,
      progress: 0,
      segIdx: 0,
    };
  });
}

export function LiveTrackingModal({ open, onClose }: LiveTrackingModalProps) {
  const [selectedRoute, setSelectedRoute] = useState<string>("R01");
  const [buses, setBuses] = useState<BusPosition[]>(() => initialBuses());
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  // Tick: move each bus along its route every 1.5s (only when open)
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
          if (newProg >= 1) {
            newProg = 0;
            newSeg += 1;
            if (newSeg >= coordsList.length - 1) {
              newSeg = 0;
            }
          }
          const a = coordsList[newSeg];
          const c = coordsList[Math.min(newSeg + 1, coordsList.length - 1)];
          const newCoords = lerp(a, c, newProg);
          return { ...b, segIdx: newSeg, progress: newProg, coords: newCoords };
        })
      );
      tickRef.current += 1;
      setTick(tickRef.current);
    }, 1500);
    return () => clearInterval(id);
  }, [open]);

  if (!open) return null;

  // Build polyline for selected route
  const selRoute = ALL_ROUTES.find((r) => r.routeNo === selectedRoute);
  const selStops = routeStops[selectedRoute] || [];
  const selCoords: Coord[] = selStops.map((s) => s.coords || selRoute?.coords || RIT_CAMPUS_COORDS);
  if (selCoords.length > 0) selCoords[selCoords.length - 1] = RIT_CAMPUS_COORDS;
  const selPoints = selCoords.map((c) => project(c, BBOX));
  const polylinePoints = selPoints.map((p) => `${p.x},${p.y}`).join(" ");

  const selectedBus = buses.find((b) => b.routeNo === selectedRoute);

  return (
    <div className="rt-modal-overlay" onClick={onClose}>
      <div
        className="rt-modal-box"
        style={{ maxWidth: 760, maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="rt-modal-close" onClick={onClose} aria-label="Close">
          <i className="fas fa-xmark" />
        </button>
        <div className="rt-modal-header">
          <div className="rt-modal-icon-ring stops-ring">
            <i className="fas fa-satellite-dish" />
          </div>
          <h2>Live GPS Tracking</h2>
          <p>Real-time simulated positions of {buses.length} college buses</p>
        </div>

        <div className="rt-modal-body">
          {/* Route selector */}
          <div className="rt-form-field" style={{ marginBottom: 12 }}>
            <label>Select Route to Highlight</label>
            <select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)}>
              {ALL_ROUTES.map((r) => (
                <option key={r.routeNo} value={r.routeNo}>
                  Bus {r.no} · {r.routeNo} · {r.routeName}
                </option>
              ))}
            </select>
          </div>

          {/* Map */}
          <div className="rt-map-container">
            <div className="rt-map-grid" />

            {/* Route polyline for selected route */}
            {selPoints.length > 1 && (
              <svg
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="0.5"
                  strokeDasharray="2 1.5"
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: "drop-shadow(0 0 2px var(--glow-accent))" }}
                />
              </svg>
            )}

            {/* Stops for selected route */}
            {selStops.map((s, i) => {
              const c = s.coords || selRoute?.coords || RIT_CAMPUS_COORDS;
              const p = project(c, BBOX);
              const isRIT = s.stop === "RIT Campus";
              return (
                <div
                  key={i}
                  className={`rt-map-stop ${isRIT ? "rit" : ""}`}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  title={`${s.stop} · ${s.time}`}
                />
              );
            })}

            {/* Bus markers */}
            {buses.map((b) => {
              const p = project(b.coords, BBOX);
              const isSelected = b.routeNo === selectedRoute;
              return (
                <div
                  key={b.routeNo}
                  className="rt-map-bus"
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    opacity: isSelected ? 1 : 0.55,
                    zIndex: isSelected ? 20 : 10,
                  }}
                  title={`Bus ${b.no} · ${b.routeNo} · ${b.routeName}`}
                >
                  {isSelected && <div className="rt-map-bus-pulse" />}
                  <div className="rt-map-bus-icon" style={isSelected ? {} : { transform: "scale(0.85)" }}>
                    <i className="fas fa-bus" />
                  </div>
                </div>
              );
            })}

            {/* Legend */}
            <div className="rt-map-legend">
              <div className="rt-map-legend-item">
                <span className="rt-dot rt-dot-on" /> Bus (live)
              </div>
              <div className="rt-map-legend-item">
                <span className="rt-dot rt-dot-early" /> Boarding stop
              </div>
              <div className="rt-map-legend-item">
                <span className="rt-dot rt-dot-late" /> RIT Campus
              </div>
            </div>

            {/* Info panel for selected bus */}
            {selectedBus && (
              <div className="rt-map-info">
                <div className="title">Bus {selectedBus.no} · {selectedBus.routeNo} · {selectedBus.routeName}</div>
                <div className="coord">
                  LAT: {selectedBus.coords.lat.toFixed(4)} · LNG: {selectedBus.coords.lng.toFixed(4)}
                </div>
                <div className="coord" style={{ marginTop: 2, color: "var(--text2)" }}>
                  Status: En route · Updated {tick}s ago
                </div>
              </div>
            )}
          </div>

          {/* Tracked buses — route cards like reference */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: "var(--font-head)", fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {buses.length} Buses Live on Map
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {buses.map((b) => {
                const r = ALL_ROUTES.find((x) => x.routeNo === b.routeNo);
                const isSelected = b.routeNo === selectedRoute;
                // Calculate distance and ETA
                const distKm = r ? Math.round(haversineDist(r.coords, RIT_CAMPUS_COORDS) / 100) / 10 : 0;
                const etaMin = r ? Math.max(15, Math.round(distKm * 2)) : 0;
                const etaH = Math.floor(etaMin / 60);
                const etaM = etaMin % 60;
                return (
                  <button
                    key={b.routeNo}
                    onClick={() => setSelectedRoute(b.routeNo)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", borderRadius: "var(--r)",
                      background: isSelected ? "rgba(34,211,238,0.08)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${isSelected ? "var(--accent2)" : "var(--border)"}`,
                      cursor: "pointer", transition: "all 0.18s ease", textAlign: "left",
                    }}
                  >
                    {/* RTE badge */}
                    <div style={{
                      width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                      background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    }}>
                      <div style={{ fontSize: 8, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase" }}>RTE</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#FBBF24", fontFamily: "var(--font-mono)" }}>{b.routeNo}</div>
                    </div>
                    {/* Route info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                        {b.routeName} → RIT Campus
                      </div>
                      <div style={{ display: "flex", gap: 12, marginTop: 3, fontSize: 11, color: "var(--text3)" }}>
                        <span><i className="fas fa-road" style={{ marginRight: 4 }} />{distKm.toFixed(1)} km</span>
                        <span><i className="fas fa-clock" style={{ marginRight: 4 }} />~{etaH > 0 ? `${etaH}h ` : ""}{etaM}m</span>
                        {b.speed > 0 && <span style={{ color: "var(--accent2)" }}><i className="fas fa-gauge-high" style={{ marginRight: 4 }} />{Math.round(b.speed)} km/h</span>}
                      </div>
                    </div>
                    {/* Live indicator */}
                    {isSelected && (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34D399", boxShadow: "0 0 8px #34D399", flexShrink: 0 }} />
                    )}
                    <i className="fas fa-chevron-right" style={{ color: "var(--text3)", fontSize: 10, flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rt-footnote-note" style={{ marginTop: 14 }}>
            <i className="fas fa-info-circle" style={{ color: "var(--accent2)", fontSize: 11, marginRight: 5 }} />
            Simulated GPS positions update every 1.5 seconds. In production, this would use Firebase Realtime DB
            with driver-phone GPS streams.
          </div>
        </div>
      </div>
    </div>
  );
}

// keep file format consistent
export {};

function haversineDist(a: Coord, b: Coord): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
