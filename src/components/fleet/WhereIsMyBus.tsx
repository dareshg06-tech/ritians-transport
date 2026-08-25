"use client";

import { useEffect, useMemo, useState } from "react";
import { getRouteStopsWithCoords } from "@/lib/ritians/fleet";
import type { Vehicle } from "./Dashboard";

interface WhereIsMyBusProps {
  vehicles: Vehicle[];
  onBack: () => void;
  // Live position updates keyed by vehicleId
  livePositions: Map<string, { coords: { lat: number; lng: number }; speed: number | null; lastCrossed?: { name: string; sequence: number } | null; nextStop?: { name: string; sequence: number; etaMinutes: number; distanceMeters: number } | null; progressPercent?: number }>;
}

interface CrossingRow {
  id: string;
  stopName: string;
  sequence: number;
  crossedAt: string;
}

export function WhereIsMyBus({ vehicles, onBack, livePositions }: WhereIsMyBusProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [crossings, setCrossings] = useState<CrossingRow[]>([]);

  useEffect(() => {
    if (!selectedVehicleId && vehicles.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const live = livePositions.get(selectedVehicleId || "");

  // Fetch today's crossings when vehicle changes
  useEffect(() => {
    if (!selectedVehicleId) return;
    let cancelled = false;
    const fetchCrossings = async () => {
      try {
        const res = await fetch(`/api/stop-crossings/${selectedVehicleId}`);
        const data = await res.json();
        if (!cancelled) setCrossings(data.crossings || []);
      } catch {
        if (!cancelled) setCrossings([]);
      }
    };
    fetchCrossings();
    const id = setInterval(fetchCrossings, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [selectedVehicleId]);

  const stops = useMemo(() => {
    if (!vehicle?.routeNo) return [];
    return getRouteStopsWithCoords(vehicle.routeNo);
  }, [vehicle]);

  const crossedStopNames = useMemo(() => {
    // Combine DB-recorded crossings with live lastCrossed
    const names = new Set(crossings.map((c) => c.stopName));
    if (live?.lastCrossed) names.add(live.lastCrossed.name);
    return names;
  }, [crossings, live]);

  return (
    <div className="rt-wimb-page">
      <div className="rt-wimb-banner">
        <div className="icon"><i className="fas fa-map-location-dot" /></div>
        <div style={{ flex: 1 }}>
          <h2>Where Is My Bus?</h2>
          <p>Real-time bus tracking — see exactly which stop your bus crossed, ETA to next stop, and distance to college. Similar to "Where Is My Train" or Chalo app.</p>
        </div>
        <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onBack}>
          <i className="fas fa-arrow-left" /> Back
        </button>
      </div>

      {/* Vehicle selector */}
      <div className="rt-form-field" style={{ marginBottom: 18, maxWidth: 460 }}>
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)" }}>
          Select Your Bus
        </label>
        <select
          value={selectedVehicleId}
          onChange={(e) => setSelectedVehicleId(e.target.value)}
          style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 14, outline: "none" }}
        >
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.vehicleName} · {v.vehicleNumber} · R{v.routeNo}
            </option>
          ))}
        </select>
      </div>

      {/* Progress banner */}
      {live && (
        <div className="rt-wimb-banner" style={{ marginBottom: 18 }}>
          <div className="icon"><i className="fas fa-route" /></div>
          <div style={{ flex: 1 }}>
            <h2>{Math.round(live.progressPercent || 0)}% complete</h2>
            <p>
              {live.lastCrossed ? <>Last crossed <strong style={{ color: "#5EEAB0" }}>{live.lastCrossed.name}</strong></> : "Trip starting"}
              {live.nextStop && <> · Next stop <strong style={{ color: "var(--accent2)" }}>{live.nextStop.name}</strong> · ETA <strong style={{ color: "var(--accent2)" }}>{live.nextStop.etaMinutes} min</strong></>}
              {live.speed != null && <> · Speed <strong style={{ color: "var(--accent)" }}>{Math.round(live.speed)} km/h</strong></>}
            </p>
          </div>
        </div>
      )}

      {/* Notification toast-style card */}
      {live?.lastCrossed && (
        <div className="rt-wimb-notif">
          <div className="icon"><i className="fas fa-bell" /></div>
          <div className="body">
            <div className="title">{vehicle?.vehicleName} crossed {live.lastCrossed.name}</div>
            <div className="desc">
              {live.nextStop ? `Next stop: ${live.nextStop.name} · ETA ${live.nextStop.etaMinutes} min` : "Approaching destination"}
            </div>
          </div>
        </div>
      )}

      {/* Stop list */}
      <div className="rt-wimb-route-list">
        {stops.map((s, i) => {
          const isCrossed = crossedStopNames.has(s.stop);
          const isCurrent = live?.lastCrossed?.sequence === i;
          const isNext = live?.nextStop?.sequence === i;
          const crossing = crossings.find((c) => c.stopName === s.stop);

          return (
            <div key={i} className={`rt-wimb-stop ${isCrossed ? "crossed" : ""} ${isCurrent ? "current" : ""}`}>
              <div className="seq">{i + 1}</div>
              <div className="info">
                <div className="name">{s.stop}</div>
                <div className="meta">
                  Scheduled: <span style={{ fontFamily: "var(--font-mono)" }}>{s.time}</span>
                  {crossing && <> · Crossed at <span style={{ fontFamily: "var(--font-mono)", color: "#5EEAB0" }}>{new Date(crossing.crossedAt).toLocaleTimeString("en-IN")}</span></>}
                  {s.coords && <> · {s.coords.lat.toFixed(3)}, {s.coords.lng.toFixed(3)}</>}
                </div>
              </div>
              {isCrossed ? (
                <span className="badge crossed">✓ Crossed</span>
              ) : isNext ? (
                <span className="badge eta">ETA {live?.nextStop?.etaMinutes || 1} min</span>
              ) : (
                <span className="badge pending">Pending</span>
              )}
            </div>
          );
        })}
        {stops.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text3)" }}>
            <i className="fas fa-route" style={{ fontSize: 28, display: "block", marginBottom: 8 }} />
            No route stops configured for this vehicle.
          </div>
        )}
      </div>

      <div className="rt-footnote-note" style={{ marginTop: 18 }}>
        <i className="fas fa-info-circle" style={{ color: "var(--accent2)", fontSize: 11, marginRight: 5 }} />
        Live stop crossings are recorded with timestamps. When the bus reaches RIT Campus, the tracking session auto-resets for the next trip — just like "Where Is My Train".
      </div>
    </div>
  );
}
