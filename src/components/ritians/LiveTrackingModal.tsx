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

          {/* Tracked buses list */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: "var(--font-head)", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
              Currently Tracking ({buses.length} buses)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
              {buses.map((b) => (
                <button
                  key={b.routeNo}
                  onClick={() => setSelectedRoute(b.routeNo)}
                  style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: "var(--r)",
                    background: b.routeNo === selectedRoute ? "rgba(255,138,76,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${b.routeNo === selectedRoute ? "rgba(255,138,76,0.4)" : "var(--border)"}`,
                    cursor: "pointer", transition: "all 0.18s ease",
                  }}
                >
                  <div style={{ fontFamily: "var(--font-head)", fontSize: 12, fontWeight: 600 }}>
                    Bus {b.no} · {b.routeNo}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{b.routeName}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent2)", marginTop: 4 }}>
                    {b.coords.lat.toFixed(3)}, {b.coords.lng.toFixed(3)}
                  </div>
                </button>
              ))}
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
