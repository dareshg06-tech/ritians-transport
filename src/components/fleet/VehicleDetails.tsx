"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { getRouteStopsWithCoords } from "@/lib/ritians/fleet";
import { RIT_CAMPUS_COORDS, type Coord } from "@/lib/ritians/data";
import { haversineMeters, formatDistance, timeAgo } from "@/lib/ritians/geo";
import type { Vehicle } from "./Dashboard";

// Leaflet must be loaded client-side only
const FleetMap = dynamic(() => import("./FleetMap.client").then((m) => m.FleetMap), {
  ssr: false,
  loading: () => <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)" }}><i className="fas fa-spinner fa-spin" /> Loading map…</div>,
}) as typeof import("./FleetMap.client").FleetMap;
type MapVehicle = import("./FleetMap.client").MapVehicle;

interface VehicleDetailsProps {
  vehicle: Vehicle;
  onBack: () => void;
}

interface HistoryPoint {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  isSimulated: boolean;
  recordedAt: string;
}

interface StopCrossing {
  id: string;
  stopName: string;
  sequence: number;
  crossedAt: string;
}

export function VehicleDetails({ vehicle, onBack }: VehicleDetailsProps) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [crossings, setCrossings] = useState<StopCrossing[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(to).toISOString());
      params.set("limit", "2000");
      const res = await fetch(`/api/vehicles/${vehicle.id}/history?${params}`);
      const data = await res.json();
      setHistory(data.locations || []);
      setCrossings(data.crossings || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
     
  }, [vehicle.id]);

  // Compute stats from history
  const stats = useMemo(() => {
    if (history.length === 0) {
      return { distance: 0, duration: 0, maxSpeed: 0, avgSpeed: 0, points: 0 };
    }
    let dist = 0;
    let maxSpeed = 0;
    let speedSum = 0;
    let speedCount = 0;
    for (let i = 1; i < history.length; i++) {
      const a: Coord = { lat: history[i - 1].latitude, lng: history[i - 1].longitude };
      const b: Coord = { lat: history[i].latitude, lng: history[i].longitude };
      dist += haversineMeters(a, b);
      if (history[i].speed != null) {
        maxSpeed = Math.max(maxSpeed, history[i].speed!);
        speedSum += history[i].speed!;
        speedCount += 1;
      }
    }
    const start = new Date(history[0].recordedAt).getTime();
    const end = new Date(history[history.length - 1].recordedAt).getTime();
    const duration = (end - start) / 1000 / 60; // minutes
    return {
      distance: dist,
      duration,
      maxSpeed,
      avgSpeed: speedCount > 0 ? speedSum / speedCount : 0,
      points: history.length,
    };
  }, [history]);

  // Build map vehicles: just the one vehicle, with its latest position
  const mapVehicles: MapVehicle[] = useMemo(() => {
    if (history.length === 0) return [];
    const last = history[history.length - 1];
    return [{
      id: vehicle.id,
      vehicleNumber: vehicle.vehicleNumber,
      vehicleName: vehicle.vehicleName,
      status: vehicle.status as MapVehicle["status"],
      coords: { lat: last.latitude, lng: last.longitude },
      speed: last.speed ?? undefined,
      heading: last.heading ?? undefined,
      lastSeenAt: last.recordedAt,
      routeNo: vehicle.routeNo ?? undefined,
    }];
  }, [history, vehicle]);

  const crossedStopNames = crossings.map((c) => c.stopName);

  return (
    <div className="rt-vd-page">
      <div className="rt-vd-head">
        <button className="back" onClick={onBack}>
          <i className="fas fa-arrow-left" /> Back to Dashboard
        </button>
        <div>
          <h1 style={{ fontFamily: "var(--font-head)", fontSize: 22, fontWeight: 700 }}>
            {vehicle.vehicleName}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text3)", marginLeft: 10 }}>
              {vehicle.vehicleNumber}
            </span>
          </h1>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
            Driver: {vehicle.driverName || "—"} · Route: {vehicle.routeNo || "—"} · Status: {vehicle.status}
          </div>
        </div>
      </div>

      <div className="rt-vd-grid">
        <div className="rt-vd-map-card">
          <FleetMap
            vehicles={mapVehicles}
            selectedVehicleId={vehicle.id}
            onSelectVehicle={() => {}}
            showRouteForVehicleId={vehicle.id}
            crossedStopNames={crossedStopNames}
            height="100%"
            centerOnSelected={false}
          />
        </div>

        <div className="rt-vd-side">
          <div className="rt-vd-info-card">
            <h3><i className="fas fa-chart-line" /> Tracking Summary</h3>
            {loading ? (
              <div className="rt-skeleton" style={{ height: 120 }} />
            ) : (
              <>
                <div className="rt-vd-info-row"><span className="lbl">Distance travelled</span><span className="val">{formatDistance(stats.distance)}</span></div>
                <div className="rt-vd-info-row"><span className="lbl">Duration</span><span className="val">{Math.round(stats.duration)} min</span></div>
                <div className="rt-vd-info-row"><span className="lbl">Max speed</span><span className="val">{Math.round(stats.maxSpeed)} km/h</span></div>
                <div className="rt-vd-info-row"><span className="lbl">Avg speed</span><span className="val">{Math.round(stats.avgSpeed)} km/h</span></div>
                <div className="rt-vd-info-row"><span className="lbl">GPS points</span><span className="val">{stats.points}</span></div>
                <div className="rt-vd-info-row"><span className="lbl">Stops crossed</span><span className="val">{crossings.length}</span></div>
                {history.length > 0 && (
                  <>
                    <div className="rt-vd-info-row"><span className="lbl">Start time</span><span className="val" style={{ fontSize: 11 }}>
                      {new Date(history[0].recordedAt).toLocaleString("en-IN")}
                    </span></div>
                    <div className="rt-vd-info-row"><span className="lbl">End time</span><span className="val" style={{ fontSize: 11 }}>
                      {new Date(history[history.length - 1].recordedAt).toLocaleString("en-IN")}
                    </span></div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="rt-vd-info-card">
            <h3><i className="fas fa-filter" /> Date / Time Filter</h3>
            <div className="rt-form-field" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: "var(--text3)" }}>From</label>
              <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} style={{ fontSize: 12 }} />
            </div>
            <div className="rt-form-field" style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "var(--text3)" }}>To</label>
              <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} style={{ fontSize: 12 }} />
            </div>
            <button className="rt-btn rt-btn-primary rt-btn-sm rt-btn-full" onClick={fetchHistory}>
              <i className="fas fa-sync" /> Refresh History
            </button>
          </div>

          {crossings.length > 0 && (
            <div className="rt-vd-info-card">
              <h3><i className="fas fa-map-pin" /> Stop Crossings</h3>
              {crossings.map((c, i) => (
                <div key={c.id} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: i < crossings.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent2)", flexShrink: 0 }}>{c.sequence + 1}.</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{c.stopName}</div>
                    <div style={{ fontSize: 10, color: "var(--text3)" }}>{new Date(c.crossedAt).toLocaleString("en-IN")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
