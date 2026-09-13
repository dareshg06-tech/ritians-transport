"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { routes as ALL_ROUTES, RIT_CAMPUS_COORDS, type Coord } from "@/lib/ritians/data";
import { getRouteStopsWithCoords } from "@/lib/ritians/fleet";
import { haversineMeters, snapToRoute } from "@/lib/fleet/physics";

interface LiveTrackingPageProps {
  onBack: () => void;
}

// Load Leaflet map client-side only
const FleetMap = dynamic(() => import("../fleet/FleetMap.client").then((m) => m.FleetMap), {
  ssr: false,
  loading: () => (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 12 }}>
      <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} /> Loading map…
    </div>
  ),
}) as typeof import("../fleet/FleetMap.client").FleetMap;
type MapVehicle = import("../fleet/FleetMap.client").MapVehicle;

// ============================================================================
// Types
// ============================================================================
interface ActiveBus {
  vehicleId: string;
  vehicleNumber: string;
  vehicleName: string;
  routeNo: string;
  driverName: string;
  coords: Coord;
  speed: number;
  heading: number | null;
  lastSeenAt: number;
  status: "live" | "tracking" | "idle" | "offline";
}

// ============================================================================
// LiveTrackingPage — shows all active buses with a count badge.
// Clicking a bus opens its live map with start/end points + bus marker.
// ============================================================================
export function LiveTrackingPage({ onBack }: LiveTrackingPageProps) {
  const [buses, setBuses] = useState<ActiveBus[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch active buses from /api/vehicles every 2 seconds.
  // Only show buses that have a recent GPS fix (within 60s).
  useEffect(() => {
    const fetchBuses = async () => {
      try {
        const res = await fetch("/api/vehicles");
        const data = await res.json();
        const vehicles = data.vehicles || [];
        const now = Date.now();
        // Show ALL buses that have GPS coordinates (lastLat/lastLng).
        // Buses with a recent fix (< 60s) are "live", older fixes are "offline".
        // This way the user always sees buses in the list — not an empty page.
        const all: ActiveBus[] = vehicles
          .filter((v: { lastLat: number | null; lastLng: number | null }) =>
            v.lastLat != null && v.lastLng != null
          )
          .map((v: {
            id: string;
            vehicleNumber: string;
            vehicleName: string;
            routeNo: string | null;
            driverName: string | null;
            lastLat: number;
            lastLng: number;
            lastSpeed: number | null;
            lastHeading: number | null;
            lastSeenAt: string | null;
            status: string;
          }) => {
            const age = v.lastSeenAt ? now - new Date(v.lastSeenAt).getTime() : Infinity;
            return {
              vehicleId: v.id,
              vehicleNumber: v.vehicleNumber,
              vehicleName: v.vehicleName,
              routeNo: v.routeNo || "",
              driverName: v.driverName || "Unknown",
              coords: { lat: v.lastLat, lng: v.lastLng },
              speed: v.lastSpeed || 0,
              heading: v.lastHeading,
              lastSeenAt: v.lastSeenAt ? new Date(v.lastSeenAt).getTime() : 0,
              status: age < 60000 ? (v.status === "tracking" ? "tracking" : "live") : "offline",
            } as ActiveBus;
          });
        // Sort: live/tracking first, then offline
        all.sort((a: ActiveBus, b: ActiveBus) => {
          const aLive = a.status === "live" || a.status === "tracking";
          const bLive = b.status === "live" || b.status === "tracking";
          if (aLive && !bLive) return -1;
          if (!aLive && bLive) return 1;
          return 0;
        });
        setBuses(all);
        setLoading(false);
      } catch (_) {
        setLoading(false);
      }
    };
    fetchBuses();
    const id = setInterval(fetchBuses, 2000);
    return () => clearInterval(id);
  }, []);

  const activeCount = buses.filter((b) => b.status === "live" || b.status === "tracking").length;
  const offlineCount = buses.filter((b) => b.status === "offline").length;
  const selectedBus = buses.find((b) => b.vehicleId === selectedBusId);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0d18] text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0d18]/95 backdrop-blur border-b border-[#1f2538] flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              aria-label="Back"
              className="w-9 h-9 rounded-lg bg-white/[0.06] border border-[#1f2538] text-slate-300 hover:bg-white/[0.12] hover:text-white transition-colors flex items-center justify-center text-[12px] flex-shrink-0"
            >
              <i className="fas fa-chevron-left" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
              <i className="fas fa-satellite-dish text-white text-[16px]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight text-slate-100 leading-none">Live Tracking</h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-0.5 leading-none">
                Active Buses · Real-time GPS
              </p>
            </div>
          </div>
          {/* Bus count badge — the key metric the user wants */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold tracking-wide ${
              activeCount > 0
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-slate-600 bg-slate-700/30 text-slate-400"
            }`}>
              <i className={`fas fa-bus text-[10px] ${activeCount > 0 ? "animate-pulse" : ""}`} />
              {activeCount} {activeCount === 1 ? "bus" : "buses"} live
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4 pb-24 overflow-y-auto">
        {loading ? (
          <div className="text-center py-20 text-slate-500">
            <i className="fas fa-spinner fa-spin text-2xl block mb-3" />
            <p className="text-sm">Loading active buses…</p>
          </div>
        ) : buses.length === 0 ? (
          /* Empty state — no buses have GPS coordinates at all */
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-slate-700/30 flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-bus text-2xl text-slate-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-300 mb-2">No buses are tracked yet</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              When a driver starts sharing their location from the Driver GPS portal,
              their bus will appear here in real-time with its position on the map.
            </p>
            <div className="mt-6 p-4 rounded-xl border border-[#1f2538] bg-[#10131f] max-w-md mx-auto text-left">
              <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-2">
                <i className="fas fa-info-circle mr-1" /> How to start
              </div>
              <ol className="text-[12px] text-slate-400 space-y-1 list-decimal list-inside">
                <li>Go to <strong className="text-slate-200">Driver GPS</strong> from the navbar</li>
                <li>Select your bus route</li>
                <li>Click <strong className="text-emerald-300">Start Sharing Location</strong></li>
                <li>The bus will appear here within 2 seconds</li>
              </ol>
            </div>
          </div>
        ) : (
          /* Active bus list — each card shows the bus info + opens the live map */
          <>
            <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-3 px-1">
              {activeCount > 0
                ? `${activeCount} ${activeCount === 1 ? "bus" : "buses"} currently sharing location`
                : `${buses.length} ${buses.length === 1 ? "bus" : "buses"} in the fleet`}
              {offlineCount > 0 && activeCount > 0 && (
                <span className="text-slate-500 ml-2">· {offlineCount} offline</span>
              )}
            </div>
            <div className="grid gap-3">
              {buses.map((bus) => (
                <ActiveBusCard
                  key={bus.vehicleId}
                  bus={bus}
                  onClick={() => setSelectedBusId(bus.vehicleId)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Bus detail modal — shows the live map with start/end points + bus marker */}
      {selectedBus && (
        <BusDetailModal
          bus={selectedBus}
          onClose={() => setSelectedBusId(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// ActiveBusCard — a single bus in the list
// ============================================================================
function ActiveBusCard({ bus, onClick }: { bus: ActiveBus; onClick: () => void }) {
  const ageS = Math.floor((Date.now() - bus.lastSeenAt) / 1000);
  const routeInfo = ALL_ROUTES.find((r) => r.routeNo === bus.routeNo);
  const isOffline = bus.status === "offline";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-4 transition-all flex items-center gap-4 ${
        isOffline
          ? "border-[#1f2538] bg-[#10131f] hover:border-[#2a3252] hover:bg-[#161b2b] opacity-75"
          : "border-[#1f2538] bg-[#10131f] hover:border-emerald-500/40 hover:bg-[#161b2b]"
      }`}
    >
      <div className="flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center bg-[#1a2032]">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 leading-none">RTE</span>
        <span className="text-xs leading-tight text-amber-300 font-bold">{bus.routeNo || "—"}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-slate-100 truncate">
          {routeInfo ? `${routeInfo.routeName} → RIT Campus` : bus.vehicleName}
        </div>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <i className="fas fa-id-card text-[10px]" /> {bus.driverName}
          </span>
          {!isOffline && (
            <span className="flex items-center gap-1">
              <i className="fas fa-gauge-high text-[10px]" /> {Math.round(bus.speed)} km/h
            </span>
          )}
          <span className="flex items-center gap-1">
            <i className="fas fa-clock text-[10px]" />
            {bus.lastSeenAt === 0 ? "never" : ageS < 60 ? `${ageS}s ago` : ageS < 3600 ? `${Math.floor(ageS / 60)}m ago` : `${Math.floor(ageS / 3600)}h ago`}
          </span>
        </div>
      </div>
      {/* Status badge — LIVE for active, OFFLINE for stale */}
      {isOffline ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-600 bg-slate-700/30 text-slate-400 text-[10px] font-semibold flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          OFFLINE
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[10px] font-semibold flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ boxShadow: "0 0 6px #10b981" }} />
          LIVE
        </div>
      )}
      <i className="fas fa-chevron-right text-slate-600 text-[12px] flex-shrink-0" />
    </button>
  );
}

// ============================================================================
// BusDetailModal — full-screen map showing the bus with start/end points
// ============================================================================
function BusDetailModal({ bus, onClose }: { bus: ActiveBus; onClose: () => void }) {
  const routeInfo = ALL_ROUTES.find((r) => r.routeNo === bus.routeNo);
  const stops = bus.routeNo ? getRouteStopsWithCoords(bus.routeNo) : [];

  // Build the route polyline
  const routeCoords: Coord[] = stops.map((s) => s.coords || { lat: 0, lng: 0 });
  if (routeCoords.length > 0) routeCoords[routeCoords.length - 1] = RIT_CAMPUS_COORDS;

  // Snap the bus position to the route
  const snap = snapToRoute(bus.coords, routeCoords);
  const displayCoords: Coord = (snap && snap.deviationM < 200) ? snap.snappedCoords : bus.coords;

  // Compute distance from bus to RIT Campus
  const distToCampusKm = haversineMeters(displayCoords, RIT_CAMPUS_COORDS) / 1000;
  const etaMin = bus.speed > 1 ? Math.max(1, Math.round(distToCampusKm / (bus.speed / 60))) : Infinity;

  const mapVehicles: MapVehicle[] = [{
    id: bus.vehicleId,
    vehicleNumber: bus.vehicleNumber,
    vehicleName: bus.vehicleName,
    status: "tracking" as const,
    coords: displayCoords,
    speed: bus.speed,
    heading: bus.heading ?? undefined,
    lastSeenAt: new Date(bus.lastSeenAt).toISOString(),
    routeNo: bus.routeNo,
    selected: true,
  }];

  return (
    <div className="fixed inset-0 z-[200] bg-[#0a0d18] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0d18]/95 backdrop-blur border-b border-[#1f2538] flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-white/[0.06] border border-[#1f2538] text-slate-300 hover:bg-white/[0.12] flex items-center justify-center text-[12px] flex-shrink-0"
            >
              <i className="fas fa-chevron-left" />
            </button>
            <div className="flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center bg-[#1a2032]">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 leading-none">RTE</span>
              <span className="text-xs leading-tight text-amber-300 font-bold">{bus.routeNo}</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">
                {routeInfo ? `${routeInfo.routeName} → RIT Campus` : bus.vehicleName}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                <span><i className="fas fa-id-card text-[10px] mr-1" />{bus.driverName}</span>
                <span><i className="fas fa-bus text-[10px] mr-1" />{bus.vehicleNumber}</span>
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[11px] font-semibold flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ boxShadow: "0 0 6px #10b981" }} />
            LIVE GPS
          </span>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-5xl w-full mx-auto px-4 pt-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[#1f2538] bg-[#10131f] p-3">
            <div className="text-[9px] uppercase tracking-widest text-cyan-400 font-bold mb-1 flex items-center gap-1">
              <i className="fas fa-location-dot text-[10px]" /> Position
            </div>
            <div className="text-[11px] font-mono text-slate-300">
              {displayCoords.lat.toFixed(5)}, {displayCoords.lng.toFixed(5)}
            </div>
            {snap && snap.deviationM < 200 && (
              <div className="text-[9px] text-emerald-400 mt-1">
                <i className="fas fa-road mr-1" />snapped to route
              </div>
            )}
          </div>
          <div className="rounded-xl border border-[#1f2538] bg-[#10131f] p-3">
            <div className="text-[9px] uppercase tracking-widest text-amber-400 font-bold mb-1 flex items-center gap-1">
              <i className="fas fa-gauge-high text-[10px]" /> Speed
            </div>
            <div className="text-sm font-bold text-white">
              {Math.round(bus.speed)} <span className="text-[10px] text-slate-500 font-normal">km/h</span>
            </div>
            {bus.speed < 1 && (
              <div className="text-[9px] text-amber-400 font-bold mt-1 animate-pulse">🛑 NOT MOVING</div>
            )}
          </div>
          <div className="rounded-xl border border-[#1f2538] bg-[#10131f] p-3">
            <div className="text-[9px] uppercase tracking-widest text-emerald-400 font-bold mb-1 flex items-center gap-1">
              <i className="fas fa-flag-checkered text-[10px]" /> ETA to Campus
            </div>
            <div className="text-sm font-bold text-white">
              {etaMin === Infinity ? "—" : etaMin > 60 ? `${Math.floor(etaMin / 60)}h ${etaMin % 60}m` : `${etaMin} min`}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{distToCampusKm.toFixed(1)} km remaining</div>
          </div>
        </div>
      </div>

      {/* Live Map with start (A) and end (B) points */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4 overflow-y-auto">
        <div className="rounded-2xl border border-[#1f2538] bg-[#10131f] p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold flex items-center gap-1.5">
              <i className="fas fa-map" /> Live Map — Updated every 2s
            </div>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ boxShadow: "0 0 6px #10b981" }} />
              LIVE
            </span>
          </div>
          <div style={{ height: 400 }} className="rounded-xl overflow-hidden relative">
            <FleetMap
              vehicles={mapVehicles}
              selectedVehicleId={bus.vehicleId}
              onSelectVehicle={() => {}}
              showRouteForVehicleId={bus.vehicleId}
              height="100%"
              centerOnSelected={true}
            />
          </div>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-4 flex-wrap">
            <span><i className="fas fa-circle text-amber-400 mr-1 text-[8px]" /> Start point (A)</span>
            <span><i className="fas fa-circle text-red-400 mr-1 text-[8px]" /> RIT Campus (B)</span>
            <span><i className="fas fa-bus text-emerald-400 mr-1 text-[8px]" /> Current bus position</span>
          </div>
        </div>

        {/* Boarding points list with crossed/not-crossed status + timestamps */}
        {stops.length > 0 && (
          <BoardingPointsList
            routeNo={bus.routeNo}
            busCoords={displayCoords}
            stops={stops}
          />
        )}
      </main>
    </div>
  );
}

// ============================================================================
// BoardingPointsList — shows each boarding point with crossed/not-crossed
// status, scheduled time, and a "Record Passengers" button.
// ============================================================================
function BoardingPointsList({
  routeNo,
  busCoords,
  stops,
}: {
  routeNo: string;
  busCoords: Coord;
  stops: { stop: string; time: string; coords?: Coord }[];
}) {
  const routeCoords: Coord[] = stops.map((s) => s.coords || { lat: 0, lng: 0 });
  if (routeCoords.length > 0) routeCoords[routeCoords.length - 1] = RIT_CAMPUS_COORDS;

  const distBusToEnd = haversineMeters(busCoords, RIT_CAMPUS_COORDS);
  const currentStopIdx = stops.findIndex((s) => {
    if (!s.coords) return false;
    return haversineMeters(busCoords, s.coords) < 200;
  });

  return (
    <div className="rounded-2xl border border-[#1f2538] bg-[#10131f] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold flex items-center gap-1.5">
          <i className="fas fa-route" /> Boarding Points — {routeNo}
        </div>
        <div className="text-[10px] text-slate-500">
          {stops.filter((s, i) => {
            if (!s.coords) return false;
            return haversineMeters(busCoords, RIT_CAMPUS_COORDS) < haversineMeters(s.coords, RIT_CAMPUS_COORDS) - 30;
          }).length} / {stops.length} crossed
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {stops.map((s, i) => {
          const stopCoords = s.coords || { lat: 0, lng: 0 };
          const distStopToEnd = haversineMeters(stopCoords, RIT_CAMPUS_COORDS);
          const isCrossed = distBusToEnd < distStopToEnd - 30;
          const isCurrent = i === currentStopIdx;
          const isFinal = i === stops.length - 1;

          return (
            <BoardingPointRow
              key={i}
              index={i}
              stop={s}
              isCrossed={isCrossed}
              isCurrent={isCurrent}
              isFinal={isFinal}
              routeNo={routeNo}
            />
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// BoardingPointRow — a single boarding point with status + Record Passengers button
// ============================================================================
function BoardingPointRow({
  index,
  stop,
  isCrossed,
  isCurrent,
  isFinal,
  routeNo,
}: {
  index: number;
  stop: { stop: string; time: string };
  isCrossed: boolean;
  isCurrent: boolean;
  isFinal: boolean;
  routeNo: string;
}) {
  const [showPassengerModal, setShowPassengerModal] = useState(false);

  // Determine the crossing time (for crossed stops)
  // In a real system this would come from the StopCrossing DB record.
  // For now, we show the scheduled time + "Crossed" badge.
  const statusLabel = isCrossed ? "CROSSED" : isCurrent ? "HERE NOW" : isFinal ? "FINAL" : "UPCOMING";
  const statusColor = isCrossed ? "#10b981" : isCurrent ? "#06b6d4" : isFinal ? "#f59e0b" : "#64748b";
  const statusBg = isCrossed ? "rgba(16,185,129,0.15)" : isCurrent ? "rgba(6,182,212,0.15)" : isFinal ? "rgba(245,158,11,0.15)" : "rgba(100,116,139,0.1)";

  return (
    <>
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
        style={{
          background: isCurrent ? "rgba(6,182,212,0.08)" : isCrossed ? "rgba(16,185,129,0.04)" : "transparent",
          border: isCurrent ? "1px solid rgba(6,182,212,0.3)" : "1px solid transparent",
        }}
      >
        {/* Status circle */}
        <div
          className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
          style={{
            background: isCrossed ? "#10b981" : isCurrent ? "#06b6d4" : isFinal ? "#f59e0b" : "#1e2330",
            border: isCurrent ? "2px solid #06b6d4" : "none",
            boxShadow: isCrossed ? "0 0 6px #10b981" : isCurrent ? "0 0 8px #06b6d4" : "none",
          }}
        >
          {isCrossed && <i className="fas fa-check text-[8px] text-white" />}
          {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>

        {/* Stop info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium" style={{ color: isCrossed ? "#10b981" : isCurrent ? "#06b6d4" : isFinal ? "#f59e0b" : "#94a3b8", fontWeight: isCurrent ? 700 : 500 }}>
              {index + 1}. {stop.stop}
            </span>
            {isFinal && (
              <span className="text-[9px] font-bold text-amber-400 px-1.5 py-0.5 rounded-full bg-amber-500/10">FINAL</span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            <i className="fas fa-clock text-[8px] mr-1" />
            {stop.time}
            {isCrossed && <span className="text-emerald-400 ml-2">· Crossed</span>}
            {isCurrent && <span className="text-cyan-400 ml-2">· Bus is here now</span>}
          </div>
        </div>

        {/* Status badge */}
        <span
          className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ color: statusColor, background: statusBg, border: `1px solid ${statusColor}40` }}
        >
          {statusLabel}
        </span>

        {/* Record Passengers button — only for crossed or current stops */}
        {(isCrossed || isCurrent) && (
          <button
            onClick={() => setShowPassengerModal(true)}
            className="text-[9px] font-semibold px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-colors flex items-center gap-1 flex-shrink-0"
            title="Record passengers boarding/alighting at this stop"
          >
            <i className="fas fa-user-plus text-[8px]" />
            Record
          </button>
        )}
      </div>

      {/* Passenger Count Modal */}
      {showPassengerModal && (
        <PassengerCountModal
          stopName={stop.stop}
          routeNo={routeNo}
          onClose={() => setShowPassengerModal(false)}
        />
      )}
    </>
  );
}

// ============================================================================
// PassengerCountModal — record how many passengers boarded/alighted/waiting
// ============================================================================
function PassengerCountModal({
  stopName,
  routeNo,
  onClose,
}: {
  stopName: string;
  routeNo: string;
  onClose: () => void;
}) {
  const [boarded, setBoarded] = useState(0);
  const [alighted, setAlighted] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // In a real system, this would POST to /api/passenger-count
    // For now, just show a success message
    console.log("Passenger count saved:", { stopName, routeNo, boarded, alighted, waiting });
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#10131f] border border-[#1f2538] rounded-2xl p-5 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {saved ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
              <i className="fas fa-check text-2xl text-emerald-400" />
            </div>
            <div className="text-sm font-bold text-emerald-300">Passenger count saved!</div>
            <div className="text-[11px] text-slate-500 mt-1">{stopName} · {routeNo}</div>
          </div>
        ) : (
          <>
            <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-1">
              <i className="fas fa-users mr-1" /> Passenger Count
            </div>
            <div className="text-sm font-bold text-white mb-4">
              Record passengers at <span className="text-amber-300">{stopName}</span>
            </div>

            {/* Boarded counter */}
            <CounterRow
              label="Boarded (got on)"
              icon="🟢"
              value={boarded}
              onChange={setBoarded}
            />
            {/* Alighted counter */}
            <CounterRow
              label="Alighted (got off)"
              icon="🟠"
              value={alighted}
              onChange={setAlighted}
            />
            {/* Waiting counter */}
            <CounterRow
              label="Waiting at stop"
              icon="🔵"
              value={waiting}
              onChange={setWaiting}
            />

            {/* Action buttons */}
            <div className="flex gap-2 mt-5">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-[#1f2538] bg-[#0a0d18] text-slate-400 text-[12px] font-semibold hover:bg-[#161b2b] transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white text-[12px] font-semibold hover:from-amber-400 hover:to-amber-500 transition-colors"
              >
                SAVE
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CounterRow — a +/- counter for the passenger modal
// ============================================================================
function CounterRow({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#1a2032] last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-[12px] text-slate-300">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 rounded-lg bg-[#1a2032] border border-[#2a3252] text-slate-300 hover:bg-[#222a4a] flex items-center justify-center text-sm font-bold"
        >
          −
        </button>
        <span className="text-base font-bold text-white w-8 text-center">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 flex items-center justify-center text-sm font-bold"
        >
          +
        </button>
      </div>
    </div>
  );
}
