"use client";

import { useEffect, useState } from "react";
import { routes, routeStops, RIT_CAMPUS_COORDS } from "@/lib/ritians/data";
import { useToast } from "@/lib/ritians/toast";

interface DriverGpsProps {
  onBack: () => void;
}

export function DriverGpsPortal({ onBack }: DriverGpsProps) {
  const { show } = useToast();
  const [selectedRoute, setSelectedRoute] = useState("");
  const [sharing, setSharing] = useState(false);
  const [position, setPosition] = useState({ lat: 0, lng: 0 });
  const [tick, setTick] = useState(0);

  // Simulated GPS position update — runs every 2s while sharing is active.
  // Initial position is set in `toggleShare` (when sharing flips on) so we don't
  // need to call setPosition synchronously inside this effect body.
  useEffect(() => {
    if (!sharing || !selectedRoute) return;
    const r = routes.find((x) => x.routeNo === selectedRoute);
    if (!r) return;
    const stops = routeStops[selectedRoute] || [];
    let segIdx = 0;
    let prog = 0;
    const id = setInterval(() => {
      const coordsList = stops.map((s) => s.coords || r.coords);
      if (coordsList.length < 2) return;
      coordsList[coordsList.length - 1] = RIT_CAMPUS_COORDS;
      prog += 0.06;
      if (prog >= 1) {
        prog = 0;
        segIdx += 1;
        if (segIdx >= coordsList.length - 1) segIdx = 0;
      }
      const a = coordsList[segIdx];
      const b = coordsList[Math.min(segIdx + 1, coordsList.length - 1)];
      setPosition({
        lat: a.lat + (b.lat - a.lat) * prog,
        lng: a.lng + (b.lng - a.lng) * prog,
      });
      setTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(id);
  }, [sharing, selectedRoute]);

  const toggleShare = () => {
    if (!selectedRoute) {
      show("Select your route first", "error");
      return;
    }
    if (!sharing) {
      // Set the initial position before flipping sharing on, so the first paint
      // of the live preview shows the bus at the route's main destination.
      const r = routes.find((x) => x.routeNo === selectedRoute);
      if (r) setPosition(r.coords);
      setSharing(true);
      show("Live location sharing started");
    } else {
      setSharing(false);
      show("Location sharing stopped");
    }
  };

  const r = routes.find((x) => x.routeNo === selectedRoute);

  return (
    <div className="rt-dash-page">
      <div className="rt-dash-top">
        <div>
          <div className="title"><i className="fas fa-location-arrow" style={{ color: "#FBBF24", marginRight: 8 }} />Driver GPS Portal</div>
          <div className="sub">Share your live location with students on campus</div>
        </div>
        <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onBack}>
          <i className="fas fa-arrow-left" /> Back to Dashboard
        </button>
      </div>

      <div className="rt-footnote-note" style={{ marginBottom: 16, background: "rgba(251,191,36,0.08)", borderColor: "rgba(251,191,36,0.25)" }}>
        <i className="fas fa-circle-info" style={{ color: "#FBBF24", fontSize: 11, marginRight: 5 }} />
        Your location is only visible while tracking is active. It auto-expires after 60 seconds of inactivity.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="rt-driver-layout">
        {/* Left: route picker + share button */}
        <div className="rt-panel">
          <div className="rt-panel-head">
            <div><h3>Your Route / Vehicle ID</h3><p>Select your assigned route to begin sharing.</p></div>
          </div>
          <div className="rt-panel-body">
            <div className="rt-form-field" style={{ marginBottom: 14 }}>
              <label>Select Your Route *</label>
              <select
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                disabled={sharing}
              >
                <option value="">Select Your Route</option>
                {routes.map((r) => (
                  <option key={r.routeNo} value={r.routeNo}>
                    Bus {r.no} · {r.routeNo} · {r.routeName}
                  </option>
                ))}
              </select>
            </div>

            {r && (
              <div style={{
                padding: 12, background: "rgba(255,255,255,0.04)", borderRadius: "var(--r)",
                border: "1px solid var(--border)", marginBottom: 14,
              }}>
                <div style={{ fontFamily: "var(--font-head)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Route Summary
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div><i className="fas fa-route" style={{ marginRight: 5, color: "var(--accent2)" }} />{r.routeNo} · {r.routeName}</div>
                  <div><i className="fas fa-clock" style={{ marginRight: 5, color: "var(--accent2)" }} />Start: {r.start}</div>
                  <div><i className="fas fa-location-dot" style={{ marginRight: 5, color: "var(--accent2)" }} />{routeStops[r.routeNo]?.length || 0} stops</div>
                  <div><i className="fas fa-flag-checkered" style={{ marginRight: 5, color: "var(--accent2)" }} />Arrives 7.40 am</div>
                </div>
              </div>
            )}

            <button
              className={`rt-btn ${sharing ? "rt-btn-ghost" : "rt-btn-primary"} rt-btn-full`}
              onClick={toggleShare}
              style={sharing ? { background: "rgba(239,68,68,0.15)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.4)" } : {}}
            >
              <i className={sharing ? "fas fa-stop" : "fas fa-location-dot"} />
              {sharing ? "Stop Sharing Location" : "Start Sharing Location"}
            </button>

            {sharing && (
              <div style={{ marginTop: 14, padding: 12, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: "var(--r)" }}>
                <div style={{ fontSize: 12, color: "#5EEAB0", fontWeight: 600, marginBottom: 6 }}>
                  <i className="fas fa-circle-check" style={{ marginRight: 6 }} />Live sharing active
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text2)" }}>
                  LAT: {position.lat.toFixed(5)}<br />
                  LNG: {position.lng.toFixed(5)}<br />
                  Updated: {tick}s ago
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: live preview */}
        <div className="rt-panel">
          <div className="rt-panel-head">
            <div><h3>Live Position Preview</h3><p>What students see on their tracking map.</p></div>
          </div>
          <div className="rt-panel-body">
            <div className="rt-map-container" style={{ height: 320 }}>
              <div className="rt-map-grid" />
              {sharing && r && (
                <>
                  {/* Route stops as dots */}
                  {(routeStops[r.routeNo] || []).map((s, i) => {
                    const c = s.coords || r.coords;
                    const x = ((c.lng - 79.3) / (80.45 - 79.3)) * 100;
                    const y = (1 - (c.lat - 12.6) / (13.45 - 12.6)) * 100;
                    const isRIT = s.stop === "RIT Campus";
                    return (
                      <div
                        key={i}
                        className={`rt-map-stop ${isRIT ? "rit" : ""}`}
                        style={{ left: `${Math.max(2, Math.min(98, x))}%`, top: `${Math.max(2, Math.min(98, y))}%` }}
                        title={s.stop}
                      />
                    );
                  })}
                  {/* Bus marker */}
                  <div
                    className="rt-map-bus"
                    style={{
                      left: `${((position.lng - 79.3) / (80.45 - 79.3)) * 100}%`,
                      top: `${(1 - (position.lat - 12.6) / (13.45 - 12.6)) * 100}%`,
                      zIndex: 20,
                    }}
                  >
                    <div className="rt-map-bus-pulse" />
                    <div className="rt-map-bus-icon"><i className="fas fa-bus" /></div>
                  </div>
                </>
              )}
              {!sharing && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "var(--text3)" }}>
                  <i className="fas fa-location-slash" style={{ fontSize: 36, marginBottom: 10, opacity: 0.5 }} />
                  <div style={{ fontSize: 13 }}>Location sharing is off</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Select your route and start sharing to see live preview</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rt-footnote-note" style={{ marginTop: 18 }}>
        <i className="fas fa-info-circle" style={{ color: "var(--accent2)", fontSize: 11, marginRight: 5 }} />
        Simulated GPS — in production, use <code className="rt-code">navigator.geolocation.watchPosition()</code> or
        Capacitor's Geolocation plugin, streaming to Firebase Realtime DB.
      </div>
    </div>
  );
}
