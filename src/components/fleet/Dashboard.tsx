"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useFleetSocket, type VehicleLocationUpdate } from "@/lib/fleet/useFleetSocket";
import { useDemoSimulator } from "@/lib/fleet/demoSimulator";
import { useToast } from "@/lib/ritians/toast";
import { FLEET } from "@/lib/ritians/fleet";
import { timeAgo, formatDistance } from "@/lib/ritians/geo";
import type { Coord } from "@/lib/ritians/data";

// Leaflet must be loaded client-side only
const FleetMap = dynamic(() => import("./FleetMap.client").then((m) => m.FleetMap), {
  ssr: false,
  loading: () => <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)" }}><i className="fas fa-spinner fa-spin" /> Loading map…</div>,
}) as typeof import("./FleetMap.client").FleetMap;
type MapVehicle = import("./FleetMap.client").MapVehicle;

interface Vehicle {
  id: string;
  vehicleNumber: string;
  vehicleName: string;
  driverName: string | null;
  routeNo: string | null;
  status: string;
  lastLat: number | null;
  lastLng: number | null;
  lastSpeed: number | null;
  lastHeading: number | null;
  lastAccuracy: number | null;
  lastSeenAt: string | null;
}

interface DashboardProps {
  vehicles: Vehicle[];
  onSelectVehicleForDetails: (id: string) => void;
  onOpenDriver: () => void;
  onOpenWhereIsMyBus: () => void;
  onLiveUpdate?: (vehicleId: string, pos: { coords: Coord; speed: number | null; lastCrossed?: { name: string; sequence: number } | null; nextStop?: { name: string; sequence: number; etaMinutes: number; distanceMeters: number } | null; progressPercent?: number }) => void;
}

interface LiveVehicle extends Vehicle {
  liveCoords: Coord | null;
  liveSpeed: number | null;
  liveHeading: number | null;
  liveAccuracy: number | null;
  liveAltitude: number | null;
  liveSeenAt: string | null;
  isSimulated: boolean;
  lastCrossedStop: { name: string; sequence: number; crossedAt: number } | null;
  nextStop: { name: string; sequence: number; etaMinutes: number; distanceMeters: number } | null;
  progressPercent: number;
}

export function Dashboard({ vehicles, onSelectVehicleForDetails, onOpenDriver, onOpenWhereIsMyBus, onLiveUpdate }: DashboardProps) {
  const { show, showStopCrossed, showArrived } = useToast();
  const [liveVehicles, setLiveVehicles] = useState<Map<string, LiveVehicle>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "live" | "idle" | "offline" | "tracking">("all");
  const [showDemo, setShowDemo] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showWhereIsMyBus, setShowWhereIsMyBus] = useState(false);

  // Bootstrap live state from vehicles prop (only first time + when vehicles length changes)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveVehicles((prev) => {
      const next = new Map(prev);
      for (const v of vehicles) {
        const existing = next.get(v.id);
        if (!existing) {
          next.set(v.id, {
            ...v,
            liveCoords: v.lastLat != null && v.lastLng != null ? { lat: v.lastLat, lng: v.lastLng } : null,
            liveSpeed: v.lastSpeed,
            liveHeading: v.lastHeading,
            liveAccuracy: v.lastAccuracy,
            liveAltitude: null,
            liveSeenAt: v.lastSeenAt,
            isSimulated: false,
            lastCrossedStop: null,
            nextStop: null,
            progressPercent: 0,
          });
        } else {
          // Update base info but keep live state if available
          next.set(v.id, { ...existing, ...v });
        }
      }
      // Remove deleted
      for (const id of Array.from(next.keys())) {
        if (!vehicles.find((v) => v.id === id)) next.delete(id);
      }
      return next;
    });
  }, [vehicles]);

  const onLocationUpdate = useCallback((u: VehicleLocationUpdate) => {
    setLiveVehicles((prev) => {
      const next = new Map(prev);
      const base = next.get(u.vehicleId);
      if (!base) return prev;
      next.set(u.vehicleId, {
        ...base,
        lastLat: u.latitude,
        lastLng: u.longitude,
        lastSpeed: u.speed ?? base.lastSpeed,
        lastHeading: u.heading ?? base.lastHeading,
        lastAccuracy: u.accuracy ?? base.lastAccuracy,
        lastSeenAt: u.timestamp || new Date().toISOString(),
        liveCoords: { lat: u.latitude, lng: u.longitude },
        liveSpeed: u.speed ?? null,
        liveHeading: u.heading ?? null,
        liveAccuracy: u.accuracy ?? null,
        isSimulated: u.isSimulated || false,
        lastCrossedStop: u.lastCrossedStop || null,
        nextStop: u.nextStop || null,
        progressPercent: u.progressPercent || 0,
        status: u.speed && u.speed > 1 ? "live" : "idle",
      });
      return next;
    });
    // Forward to parent (for Where Is My Bus view)
    onLiveUpdate?.(u.vehicleId, {
      coords: { lat: u.latitude, lng: u.longitude },
      speed: u.speed ?? null,
      lastCrossed: u.lastCrossedStop ? { name: u.lastCrossedStop.name, sequence: u.lastCrossedStop.sequence } : null,
      nextStop: u.nextStop ? { name: u.nextStop.name, sequence: u.nextStop.sequence, etaMinutes: u.nextStop.etaMinutes, distanceMeters: u.nextStop.distanceMeters } : null,
      progressPercent: u.progressPercent,
    });
  }, [onLiveUpdate]);

  const onStopCrossed = useCallback((vehicleId: string, routeNo: string, stopName: string, sequence: number, vehicleName: string, nextStop: { name: string; sequence: number; etaMinutes: number } | null) => {
    // Show toast
    showStopCrossed({
      vehicleId,
      vehicleName,
      routeNo,
      stopName,
      sequence,
      crossedAt: Date.now(),
      nextStop,
    });
    // Save to backend (best-effort)
    fetch("/api/stop-crossings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId,
        routeNo,
        stopName,
        stopLat: 0,
        stopLng: 0,
        sequence,
      }),
    }).catch(() => {});
  }, [showStopCrossed]);

  const onArrivedAtCollege = useCallback((vehicleId: string, vehicleName: string) => {
    showArrived({ vehicleId, vehicleName, arrivedAt: Date.now() });
    // Stop tracking session for this vehicle
    fetch("/api/tracking/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId }),
    }).catch(() => {});
  }, [showArrived]);

  const { status: wsStatus } = useFleetSocket({
    onLocationUpdate,
    onVehicleOffline: (vehicleId) => {
      setLiveVehicles((prev) => {
        const next = new Map(prev);
        const v = next.get(vehicleId);
        if (v) {
          next.set(vehicleId, { ...v, status: "offline" });
        }
        return next;
      });
    },
    onStopCrossed: (n) => {
      onStopCrossed(n.vehicleId, n.routeNo, n.stopName, n.sequence, n.vehicleName || n.vehicleId, n.nextStop ? { name: n.nextStop.name, sequence: n.nextStop.sequence, etaMinutes: n.nextStop.etaMinutes } : null);
    },
    onArrivedAtCollege: (n) => {
      onArrivedAtCollege(n.vehicleId, n.vehicleName || n.vehicleId);
    },
  });

  // Demo simulator
  useDemoSimulator({
    enabled: showDemo,
    vehicles: Array.from(liveVehicles.values()).map((v) => ({
      id: v.id, vehicleNumber: v.vehicleNumber, vehicleName: v.vehicleName, routeNo: v.routeNo || "", status: v.status
    })),
    onTick: onLocationUpdate,
    onStopCrossed: (vid, rno, sn, seq, vn, next) => onStopCrossed(vid, rno, sn, seq, vn, next),
    onArrivedAtCollege: (vid, vn) => onArrivedAtCollege(vid, vn),
  });

  // Compute stats
  const stats = useMemo(() => {
    const list = Array.from(liveVehicles.values());
    return {
      total: list.length,
      live: list.filter((v) => v.status === "live").length,
      idle: list.filter((v) => v.status === "idle").length,
      offline: list.filter((v) => v.status === "offline").length,
      tracking: list.filter((v) => v.status === "tracking").length,
    };
  }, [liveVehicles]);

  // Filter + search
  const filtered = useMemo(() => {
    const list = Array.from(liveVehicles.values());
    const q = search.trim().toLowerCase();
    return list
      .filter((v) => {
        if (filter !== "all" && v.status !== filter) return false;
        if (!q) return true;
        return `${v.vehicleName} ${v.vehicleNumber} ${v.routeNo || ""} ${v.driverName || ""}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        // sort: tracking > live > idle > offline
        const order = (s: string) => s === "tracking" ? 0 : s === "live" ? 1 : s === "idle" ? 2 : 3;
        return order(a.status) - order(b.status);
      });
  }, [liveVehicles, filter, search]);

  // Map vehicles
  const mapVehicles: MapVehicle[] = useMemo(() => {
    return Array.from(liveVehicles.values())
      .filter((v) => v.liveCoords)
      .map((v) => ({
        id: v.id,
        vehicleNumber: v.vehicleNumber,
        vehicleName: v.vehicleName,
        status: (["live", "idle", "offline", "tracking"].includes(v.status) ? v.status : "offline") as MapVehicle["status"],
        coords: v.liveCoords!,
        speed: v.liveSpeed ?? undefined,
        heading: v.liveHeading ?? undefined,
        lastSeenAt: v.liveSeenAt || v.lastSeenAt || undefined,
        routeNo: v.routeNo || undefined,
        selected: v.id === selectedId,
      }));
  }, [liveVehicles, selectedId]);

  const selected = selectedId ? liveVehicles.get(selectedId) : null;
  const selectedCrossedStops = useMemo(() => {
    // For the selected vehicle, fetch its stop crossings from backend
    if (!selected) return [];
    // We'll track them locally for the session
    // For now, use the lastCrossedStop + simulator's progress
    return []; // We rely on backend API to populate this when details view is opened
  }, [selected]);

  return (
    <div className="rt-fleet">
      <header className="rt-fleet-header">
        <div className="rt-fleet-header-left">
          <div className="logo"><i className="fas fa-bus" /></div>
          <div>
            <div className="title">Live Tracking</div>
            <div className="sub">
              {wsStatus === "connected" ? "Real-time vehicle monitoring" :
               wsStatus === "connecting" ? "Connecting to tracking server…" :
               "Connection lost — reconnecting…"}
            </div>
          </div>
        </div>
        <div className="rt-fleet-header-right">
          <div className="rt-fleet-stat-pill">
            <span className="dot live" /> <span className="num">{stats.live}</span> Live
          </div>
          <div className="rt-fleet-stat-pill">
            <span className="dot tracking" /> <span className="num">{stats.tracking}</span> Tracking
          </div>
          <div className="rt-fleet-stat-pill">
            <span className="dot idle" /> <span className="num">{stats.idle}</span> Idle
          </div>
          <div className="rt-fleet-stat-pill">
            <span className="dot offline" /> <span className="num">{stats.offline}</span> Offline
          </div>
          <button className="rt-fleet-stat-pill" style={{ cursor: "pointer" }} onClick={() => setShowDemo((s) => !s)} title="Toggle demo simulation">
            <i className="fas fa-flask" style={{ color: showDemo ? "#FBBF24" : "var(--text3)" }} />
            <span style={{ color: showDemo ? "#FDE68A" : "var(--text2)" }}>{showDemo ? "DEMO ON" : "DEMO OFF"}</span>
          </button>
          <button className="rt-fleet-stat-pill" style={{ cursor: "pointer" }} onClick={onOpenDriver}>
            <i className="fas fa-location-arrow" style={{ color: "#5EEAB0" }} />
            <span>Driver Portal</span>
          </button>
          <button className="rt-fleet-stat-pill" style={{ cursor: "pointer", background: "rgba(167,139,250,0.12)", borderColor: "rgba(167,139,250,0.3)" }} onClick={onOpenWhereIsMyBus}>
            <i className="fas fa-map-location-dot" style={{ color: "#A78BFA" }} />
            <span style={{ color: "#D8CCFF" }}>Where Is My Bus?</span>
          </button>
        </div>
      </header>

      <div className="rt-fleet-body">
        <aside className={`rt-fleet-sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="rt-fleet-sidebar-head">
            <h2><i className="fas fa-truck-fast" /> Vehicle Tracker</h2>
            <div className="rt-fleet-search">
              <i className="fas fa-search" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search buses, routes, drivers…"
              />
            </div>
            <div className="rt-fleet-filter-row">
              <button className={`rt-fleet-filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
                <i className="fas fa-list" /> All ({stats.total})
              </button>
              <button className={`rt-fleet-filter-btn ${filter === "live" ? "active" : ""}`} onClick={() => setFilter("live")}>
                <span className="dot live" /> Live ({stats.live})
              </button>
              <button className={`rt-fleet-filter-btn ${filter === "tracking" ? "active" : ""}`} onClick={() => setFilter("tracking")}>
                <span className="dot tracking" /> Track ({stats.tracking})
              </button>
              <button className={`rt-fleet-filter-btn ${filter === "offline" ? "active" : ""}`} onClick={() => setFilter("offline")}>
                <span className="dot offline" /> Off ({stats.offline})
              </button>
            </div>
          </div>
          <div className="rt-fleet-sidebar-list">
            <h3>Active Vehicles</h3>
            {filtered.map((v) => {
              const isOnline = v.status === "live" || v.status === "tracking" || v.status === "idle";
              return (
                <div
                  key={v.id}
                  className={`rt-fleet-vehicle-card ${v.id === selectedId ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedId(v.id);
                    setSidebarOpen(false);
                  }}
                >
                  <div className="row1">
                    <div className={`icon ${v.status}`}>
                      <i className="fas fa-bus" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="name">{v.vehicleName}</div>
                      <div className="num">{v.vehicleNumber} · R{v.routeNo || "—"}</div>
                    </div>
                    <span className={`status-chip ${v.status}`}>{v.status}</span>
                  </div>
                  <div className="row2">
                    <span className="speed">{v.liveSpeed != null ? `${Math.round(v.liveSpeed)} km/h` : "—"}</span>
                    <span className="time">{v.liveSeenAt ? timeAgo(new Date(v.liveSeenAt)) : "—"}</span>
                  </div>
                  {v.progressPercent > 0 && (
                    <div className="progress">
                      <div className="progress-bar" style={{ width: `${v.progressPercent}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
                <i className="fas fa-bus-simple" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                No vehicles match.
              </div>
            )}
          </div>
        </aside>

        <div className="rt-fleet-map">
          <button className="rt-fleet-sidebar-toggle" onClick={() => setSidebarOpen((s) => !s)}>
            <i className="fas fa-bars" /> {sidebarOpen ? "Close" : "Vehicles"}
          </button>

          {showDemo && (
            <div className="rt-fleet-map-demo-badge">DEMO · SIMULATED GPS</div>
          )}

          {selected && selected.liveCoords && (
            <div className="rt-fleet-map-overlay">
              <div className="title">{selected.vehicleName} · {selected.vehicleNumber}</div>
              <div className="row"><span className="lbl">Status</span><span className="val">{selected.status}</span></div>
              <div className="row"><span className="lbl">Speed</span><span className="val">{selected.liveSpeed != null ? `${Math.round(selected.liveSpeed)} km/h` : "—"}</span></div>
              <div className="row"><span className="lbl">Coordinates</span><span className="val">{selected.liveCoords.lat.toFixed(4)}, {selected.liveCoords.lng.toFixed(4)}</span></div>
              {selected.lastCrossedStop && (
                <div className="row"><span className="lbl">Last crossed</span><span className="val">{selected.lastCrossedStop.name}</span></div>
              )}
              {selected.nextStop && (
                <div className="row"><span className="lbl">Next stop</span><span className="val">{selected.nextStop.name} · {selected.nextStop.etaMinutes}m</span></div>
              )}
              {selected.progressPercent > 0 && (
                <div className="row"><span className="lbl">Progress</span><span className="val">{Math.round(selected.progressPercent)}%</span></div>
              )}
              <div className="row"><span className="lbl">Updated</span><span className="val">{selected.liveSeenAt ? timeAgo(new Date(selected.liveSeenAt)) : "—"}</span></div>
              <button
                className="rt-btn rt-btn-primary rt-btn-sm rt-btn-full"
                style={{ marginTop: 8 }}
                onClick={() => onSelectVehicleForDetails(selected.id)}
              >
                <i className="fas fa-chart-line" /> View Details & History
              </button>
            </div>
          )}

          <FleetMap
            vehicles={mapVehicles}
            selectedVehicleId={selectedId}
            onSelectVehicle={(id) => setSelectedId(id)}
            showRouteForVehicleId={selectedId}
            crossedStopNames={[]}
          />
        </div>
      </div>
    </div>
  );
}
