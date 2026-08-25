"use client";

import { useEffect, useRef, useState } from "react";
import { routes, routeStops, RIT_CAMPUS_COORDS } from "@/lib/ritians/data";
import { useToast } from "@/lib/ritians/toast";

interface DriverGpsProps {
  onBack: () => void;
  onOpenTracking: () => void;
}

export function DriverGpsPortal({ onBack, onOpenTracking }: DriverGpsProps) {
  const { show } = useToast();
  const [selectedRoute, setSelectedRoute] = useState("");
  const [sharing, setSharing] = useState(false);
  const [position, setPosition] = useState({ lat: 0, lng: 0 });
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  // Simulated GPS position update — runs every 2s while sharing is active.
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
      tickRef.current += 1;
      setTick(tickRef.current);
    }, 2000);
    return () => clearInterval(id);
  }, [sharing, selectedRoute]);

  const toggleShare = () => {
    if (!selectedRoute) {
      show("Select your route first", "error");
      return;
    }
    if (!sharing) {
      const r = routes.find((x) => x.routeNo === selectedRoute);
      if (r) setPosition(r.coords);
      tickRef.current = 0;
      setTick(0);
      setSharing(true);
      show("Live location sharing started");
    } else {
      setSharing(false);
      show("Location sharing stopped");
    }
  };

  const r = routes.find((x) => x.routeNo === selectedRoute);
  const bbox = { minLat: 12.6, maxLat: 13.45, minLng: 79.3, maxLng: 80.45 };
  const projX = position.lng ? ((position.lng - bbox.minLng) / (bbox.maxLng - bbox.minLng)) * 100 : 50;
  const projY = position.lng ? (1 - (position.lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * 100 : 50;

  return (
    <div className="rt-gps-page">
      {/* Top nav buttons */}
      <div className="rt-gps-nav">
        <button className="rt-gps-nav-btn" onClick={onBack}>
          <i className="fas fa-arrow-left" /> Back to Home
        </button>
        <button className={`rt-gps-nav-btn ${sharing ? "active" : ""}`} onClick={onOpenTracking}>
          <i className="fas fa-satellite-dish" /> Live Tracking
        </button>
      </div>

      {/* Main card */}
      <div className="rt-gps-card">
        {/* Hero */}
        <div className="rt-gps-hero">
          <div className="rt-gps-hero-icon">
            <i className="fas fa-location-arrow" />
          </div>
          <h1>Driver GPS Portal</h1>
          <p>Share your live location with students on campus.</p>
        </div>

        {/* Body */}
        <div className="rt-gps-body">
          {/* Alert */}
          <div className="rt-gps-alert">
            <i className="fas fa-circle-info" />
            <span>Your location is only visible while tracking is active. It auto-expires after 60 seconds of inactivity.</span>
          </div>

          {/* Route selector */}
          <div className="rt-gps-label">Your Route / Vehicle ID</div>
          <div className="rt-gps-select-wrap">
            <i className="fas fa-route prefix" />
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
            <i className="fas fa-chevron-down chevron" />
          </div>

          {/* Start/Stop button */}
          <button
            className={`rt-gps-share-btn ${sharing ? "sharing" : ""}`}
            onClick={toggleShare}
          >
            <i className={sharing ? "fas fa-stop" : "fas fa-rocket"} />
            {sharing ? "Stop Sharing Location" : "Start Sharing Location"}
          </button>

          {/* Status / Lat / Lng data grid */}
          <div className="rt-gps-data-grid">
            <div className="rt-gps-data-row">
              <span className="rt-gps-data-label">Status</span>
              <span className={`rt-gps-data-value ${sharing ? "active" : "idle"}`}>
                {sharing ? "● Live sharing" : "Idle"}
              </span>
            </div>
            <div className="rt-gps-data-row">
              <span className="rt-gps-data-label">Latitude</span>
              <span className={`rt-gps-data-value ${sharing && position.lat ? "coords" : "idle"}`}>
                {sharing && position.lat ? position.lat.toFixed(5) : "—"}
              </span>
            </div>
            <div className="rt-gps-data-row">
              <span className="rt-gps-data-label">Longitude</span>
              <span className={`rt-gps-data-value ${sharing && position.lng ? "coords" : "idle"}`}>
                {sharing && position.lng ? position.lng.toFixed(5) : "—"}
              </span>
            </div>
            {sharing && r && (
              <>
                <div className="rt-gps-data-row">
                  <span className="rt-gps-data-label">Route</span>
                  <span className="rt-gps-data-value">
                    {r.routeNo} · {r.routeName}
                  </span>
                </div>
                <div className="rt-gps-data-row">
                  <span className="rt-gps-data-label">Updated</span>
                  <span className="rt-gps-data-value">{tick}s ago</span>
                </div>
              </>
            )}
          </div>

          {/* Mini map preview (only when sharing) */}
          {sharing && position.lat > 0 && (
            <div className="rt-gps-mini-map">
              <div className="rt-map-grid" />
              <div className="rt-gps-mini-map-label">Live Position</div>
              {r && (routeStops[r.routeNo] || []).map((s, i) => {
                const c = s.coords || r.coords;
                const x = ((c.lng - bbox.minLng) / (bbox.maxLng - bbox.minLng)) * 100;
                const y = (1 - (c.lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * 100;
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
              <div
                className="rt-map-bus"
                style={{
                  left: `${Math.max(2, Math.min(98, projX))}%`,
                  top: `${Math.max(2, Math.min(98, projY))}%`,
                  zIndex: 20,
                }}
              >
                <div className="rt-map-bus-pulse" />
                <div className="rt-map-bus-icon"><i className="fas fa-bus" /></div>
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="rt-footnote-note" style={{ marginTop: 16 }}>
            <i className="fas fa-info-circle" style={{ color: "var(--accent2)", fontSize: 11, marginRight: 5 }} />
            Simulated GPS — in production, use <code className="rt-code">navigator.geolocation.watchPosition()</code> or
            Capacitor's Geolocation plugin, streaming to Firebase Realtime DB.
          </div>
        </div>
      </div>
    </div>
  );
}
