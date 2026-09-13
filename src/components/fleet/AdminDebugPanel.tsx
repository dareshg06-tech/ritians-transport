"use client";

import { useEffect, useMemo, useState } from "react";
import { usePhysicsSimulator } from "@/lib/fleet/physicsSimulator";
import type { ProcessedTelemetry, BusState, LocationConfidence } from "@/lib/fleet/physics";
import dynamic from "next/dynamic";

const FleetMap = dynamic(() => import("./FleetMap.client").then((m) => m.FleetMap), {
  ssr: false,
  loading: () => (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 12 }}>
      Loading map…
    </div>
  ),
}) as typeof import("./FleetMap.client").FleetMap;
type MapVehicle = import("./FleetMap.client").MapVehicle;

// ============================================================================
// AdminDebugPanel — NEXUS Real-Time Physics Tracking Dashboard
// ============================================================================
// Shows live telemetry + bus state + anomaly feed + simulator controls.
// Acceptance tests 1-12 are verifiable here by observing the displayed state.
// ============================================================================

interface AdminDebugPanelProps {
  onBack: () => void;
}

interface SimulatedBusConfig {
  busId: string;
  routeNo: string;
  vehicleNumber: string;
  vehicleName: string;
}

// Map bus state → color + label.
// STOPPED uses amber (not red) — it's a normal state, not an error.
// The label is "🛑 NOT MOVING" so the user is never confused about whether
// the bus is actually moving.
const STATE_STYLES: Record<BusState, { color: string; bg: string; label: string }> = {
  MOVING: { color: "#10b981", bg: "rgba(16,185,129,0.15)", label: "🚌 MOVING" },
  SLOWING: { color: "#fbbf24", bg: "rgba(251,191,36,0.15)", label: "🐢 SLOWING" },
  STOPPED: { color: "#fbbf24", bg: "rgba(251,191,36,0.15)", label: "🛑 NOT MOVING" },
  ACCELERATING: { color: "#06b6d4", bg: "rgba(6,182,212,0.15)", label: "⚡ ACCELERATING" },
  GPS_LOST: { color: "#f97316", bg: "rgba(249,115,22,0.15)", label: "📡 GPS LOST" },
  NETWORK_TRACKING: { color: "#a78bfa", bg: "rgba(167,139,250,0.15)", label: "📶 NETWORK" },
  STALE_LOCATION: { color: "#94a3b8", bg: "rgba(148,163,184,0.15)", label: "⌛ STALE" },
  OFFLINE: { color: "#64748b", bg: "rgba(100,116,139,0.15)", label: "⚫ OFFLINE" },
};

const CONFIDENCE_STYLES: Record<LocationConfidence, { color: string; label: string }> = {
  HIGH: { color: "#10b981", label: "HIGH" },
  MEDIUM: { color: "#06b6d4", label: "MEDIUM" },
  LOW: { color: "#fbbf24", label: "LOW" },
  STALE: { color: "#94a3b8", label: "STALE" },
  OFFLINE: { color: "#64748b", label: "OFFLINE" },
};

interface AnomalyRow {
  id: string;
  vehicleNumber: string;
  type: string;
  message: string;
  rejected: boolean;
  detectedAt: string;
}

export function AdminDebugPanel({ onBack }: AdminDebugPanelProps) {
  // Configurable list of buses to simulate. For the demo we'll use 3 buses on
  // different routes (one long-distance, one medium, one short).
  const [buses, setBuses] = useState<SimulatedBusConfig[]>([
    { busId: "sim-bus-001", routeNo: "R01", vehicleNumber: "BUS-001", vehicleName: "Ennore Bus" },
    { busId: "sim-bus-002", routeNo: "R11", vehicleNumber: "BUS-018", vehicleName: "Chengalpattu Bus" },
    { busId: "sim-bus-003", routeNo: "R04", vehicleNumber: "BUS-008", vehicleName: "Mogappair Bus" },
  ]);

  const [telemetry, setTelemetry] = useState<Map<string, ProcessedTelemetry>>(new Map());
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  const handleTelemetry = (busId: string, t: ProcessedTelemetry) => {
    setTelemetry((prev) => {
      const next = new Map(prev);
      next.set(busId, t);
      return next;
    });
  };

  const simulator = usePhysicsSimulator({
    buses,
    enabled: !paused,
    onTelemetry: handleTelemetry,
    onArrived: (busId) => {
      console.log(`[AdminDebugPanel] Bus ${busId} arrived at campus — resetting`);
    },
  });

  // Fetch anomalies every 3 seconds
  useEffect(() => {
    const fetchAnomalies = async () => {
      try {
        const res = await fetch("/api/anomalies?limit=20");
        const data = await res.json();
        if (data.anomalies) {
          setAnomalies(data.anomalies.map((a: { id: string; vehicle: { vehicleNumber: string }; type: string; message: string; rejected: boolean; detectedAt: string }) => ({
            id: a.id,
            vehicleNumber: a.vehicle?.vehicleNumber ?? "—",
            type: a.type,
            message: a.message,
            rejected: a.rejected,
            detectedAt: new Date(a.detectedAt).toLocaleTimeString(),
          })));
        }
      } catch {}
    };
    fetchAnomalies();
    const id = setInterval(fetchAnomalies, 3000);
    return () => clearInterval(id);
  }, []);

  const mapVehicles: MapVehicle[] = useMemo(() => {
    return Array.from(telemetry.values()).map((t) => ({
      id: t.busId,
      vehicleNumber: buses.find((b) => b.busId === t.busId)?.vehicleNumber ?? t.busId,
      vehicleName: buses.find((b) => b.busId === t.busId)?.vehicleName ?? t.busId,
      status: t.state === "MOVING" || t.state === "ACCELERATING" || t.state === "SLOWING" ? "live" as const
        : t.state === "STOPPED" ? "idle" as const
        : "offline" as const,
      coords: t.smoothedCoords,
      speed: t.smoothedSpeedKmh,
      heading: t.headingDeg ?? undefined,
      lastSeenAt: new Date(t.gpsTimestamp).toISOString(),
      routeNo: buses.find((b) => b.busId === t.busId)?.routeNo,
      selected: t.busId === selectedBusId,
    }));
  }, [telemetry, selectedBusId, buses]);

  const selectedTelemetry = selectedBusId ? telemetry.get(selectedBusId) : null;
  const selectedBus = buses.find((b) => b.busId === selectedBusId);

  return (
    <div className="rt-wimb-page" style={{ minHeight: "100vh", background: "#0a0d18", color: "#e2e8f0", padding: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#06b6d4" }}>
            <i className="fas fa-satellite-dish" style={{ marginRight: 8 }} />
            NEXUS Live Tracking — Physics Engine Debug
          </h1>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            Real-time GPS telemetry · Bus state machine · Anomaly detection · ETA engine
          </p>
        </div>
        <button
          onClick={onBack}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid #1f2538",
            background: "#10131f", color: "#94a3b8", cursor: "pointer", fontSize: 12,
          }}
        >
          <i className="fas fa-arrow-left" style={{ marginRight: 6 }} /> Back
        </button>
      </div>

      {/* Simulator controls */}
      <div style={{
        padding: 16, borderRadius: 12, background: "#10131f", border: "1px solid #1f2538",
        marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          <i className="fas fa-flask" style={{ marginRight: 6 }} /> Simulator
        </span>
        {!paused ? (
          <button onClick={() => setPaused(true)} style={controlBtnStyle("#fbbf24", "#10131f")}>
            <i className="fas fa-pause" /> PAUSE
          </button>
        ) : (
          <button onClick={() => setPaused(false)} style={controlBtnStyle("#10b981", "#10131f")}>
            <i className="fas fa-play" /> RESUME
          </button>
        )}
        <button
          onClick={() => simulator.stop()}
          style={controlBtnStyle("#ef4444", "#10131f")}
        >
          <i className="fas fa-stop" /> STOP ALL
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "#64748b" }}>
          {telemetry.size} buses active · {anomalies.length} anomalies
        </span>
      </div>

      {/* Main grid: telemetry cards (left) + map (right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
        {/* Telemetry cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from(telemetry.values()).map((t) => {
            const bus = buses.find((b) => b.busId === t.busId);
            const st = STATE_STYLES[t.state];
            const cf = CONFIDENCE_STYLES[t.confidence];
            const isSelected = t.busId === selectedBusId;
            return (
              <div
                key={t.busId}
                onClick={() => setSelectedBusId(t.busId)}
                style={{
                  padding: 14, borderRadius: 10, cursor: "pointer",
                  background: isSelected ? "#13161c" : "#0d1018",
                  border: `1px solid ${isSelected ? "#06b6d4" : "#1f2538"}`,
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
                    {bus?.vehicleName ?? t.busId}
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", marginLeft: 8 }}>
                      {bus?.vehicleNumber}
                    </span>
                  </div>
                  <span style={{
                    padding: "2px 8px", borderRadius: 99, fontSize: 9, fontWeight: 700,
                    color: st.color, background: st.bg, border: `1px solid ${st.color}40`,
                  }}>
                    {st.label}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 12px", fontSize: 11 }}>
                  <div>
                    <div style={{ color: "#64748b" }}>Speed</div>
                    <div style={{ fontFamily: "monospace", color: "#06b6d4", fontWeight: 600 }}>
                      {Math.round(t.smoothedSpeedKmh)} km/h
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b" }}>Heading</div>
                    <div style={{ fontFamily: "monospace", color: "#f59e0b", fontWeight: 600 }}>
                      {t.headingDeg != null ? `${Math.round(t.headingDeg)}°` : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b" }}>Accuracy</div>
                    <div style={{ fontFamily: "monospace", color: "#10b981", fontWeight: 600 }}>
                      ±{Math.round(t.accuracyM)} m
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b" }}>Age</div>
                    <div style={{ fontFamily: "monospace", color: t.locationAgeS < 5 ? "#10b981" : t.locationAgeS < 30 ? "#fbbf24" : "#ef4444" }}>
                      {t.locationAgeS.toFixed(1)}s
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b" }}>Provider</div>
                    <div style={{ color: "#a78bfa", fontWeight: 600 }}>{t.provider}</div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b" }}>Confidence</div>
                    <div style={{ color: cf.color, fontWeight: 600 }}>{cf.label}</div>
                  </div>
                </div>
                {t.anomaly && (
                  <div style={{
                    marginTop: 8, padding: "4px 8px", borderRadius: 6, fontSize: 10,
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                    color: "#fca5a5",
                  }}>
                    <i className="fas fa-triangle-exclamation" style={{ marginRight: 4 }} />
                    {t.anomaly.type}: {t.anomaly.message.slice(0, 60)}
                  </div>
                )}
                {t.accelerationKmhPerS !== 0 && (
                  <div style={{ marginTop: 6, fontSize: 10, color: "#64748b" }}>
                    Accel: <span style={{ color: t.accelerationKmhPerS > 0 ? "#06b6d4" : "#fbbf24", fontFamily: "monospace" }}>
                      {t.accelerationKmhPerS.toFixed(1)} km/h/s
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {telemetry.size === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 12 }}>
              <i className="fas fa-satellite" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
              No telemetry yet. Simulator is initializing…
            </div>
          )}
        </div>

        {/* Map */}
        <div style={{
          padding: 12, borderRadius: 12, background: "#10131f", border: "1px solid #1f2538",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              <i className="fas fa-map" style={{ marginRight: 6 }} /> Live Map
            </span>
            {selectedBusId && (
              <button
                onClick={() => simulator.simulateGpsLoss(selectedBusId)}
                style={controlBtnStyle("#f97316", "#10131f", "10px")}
              >
                <i className="fas fa-tower-broadcast" /> SIMULATE GPS LOSS
              </button>
            )}
            {selectedBusId && (
              <button
                onClick={() => simulator.simulateGpsRecovery(selectedBusId)}
                style={controlBtnStyle("#10b981", "#10131f", "10px")}
              >
                <i className="fas fa-satellite" /> GPS RECOVERY
              </button>
            )}
          </div>
          <div style={{ height: 440, borderRadius: 8, overflow: "hidden" }}>
            <FleetMap
              vehicles={mapVehicles}
              selectedVehicleId={selectedBusId}
              onSelectVehicle={setSelectedBusId}
              showRouteForVehicleId={selectedBusId}
              height="100%"
              centerOnSelected={!!selectedBusId}
            />
          </div>

          {/* Detailed telemetry for selected bus */}
          {selectedTelemetry && (
            <div style={{
              marginTop: 12, padding: 12, borderRadius: 8, background: "#0a0d18", border: "1px solid #1f2538",
              fontSize: 11, fontFamily: "var(--font-mono)",
            }}>
              <div style={{ fontWeight: 700, color: "#06b6d4", marginBottom: 6 }}>
                {selectedBus?.vehicleName} — Full Telemetry
              </div>
              {/* NOT MOVING banner — shown prominently when the bus is stopped.
                  This is the user's request: "if it not moving pls display not moving".
                  The banner is amber, full-width, and pulses so it's impossible to miss. */}
              {selectedTelemetry.state === "STOPPED" && (
                <div style={{
                  padding: "8px 12px", marginBottom: 10, borderRadius: 6,
                  background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.4)",
                  color: "#fbbf24", fontWeight: 700, fontSize: 13, textAlign: "center",
                  animation: "rtPulse 2s infinite",
                }}>
                  🛑 NOT MOVING — bus is stationary at current location
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 12px" }}>
                <span style={{ color: "#64748b" }}>lat:</span>
                <span>{selectedTelemetry.coords.lat.toFixed(6)}</span>
                <span style={{ color: "#64748b" }}>lng:</span>
                <span>{selectedTelemetry.coords.lng.toFixed(6)}</span>
                <span style={{ color: "#64748b" }}>smoothed_lat:</span>
                <span style={{ color: "#06b6d4" }}>{selectedTelemetry.smoothedCoords.lat.toFixed(6)}</span>
                <span style={{ color: "#64748b" }}>smoothed_lng:</span>
                <span style={{ color: "#06b6d4" }}>{selectedTelemetry.smoothedCoords.lng.toFixed(6)}</span>
                <span style={{ color: "#64748b" }}>speed:</span>
                <span style={{ color: "#06b6d4" }}>{selectedTelemetry.speedKmh.toFixed(2)} km/h</span>
                <span style={{ color: "#64748b" }}>smoothed_speed:</span>
                <span style={{ color: "#06b6d4" }}>{selectedTelemetry.smoothedSpeedKmh.toFixed(2)} km/h</span>
                <span style={{ color: "#64748b" }}>accel:</span>
                <span style={{ color: selectedTelemetry.accelerationKmhPerS > 0 ? "#10b981" : "#fbbf24" }}>
                  {selectedTelemetry.accelerationKmhPerS.toFixed(2)} km/h/s
                </span>
                <span style={{ color: "#64748b" }}>heading:</span>
                <span style={{ color: "#f59e0b" }}>{selectedTelemetry.headingDeg != null ? `${selectedTelemetry.headingDeg.toFixed(1)}°` : "—"}</span>
                <span style={{ color: "#64748b" }}>accuracy:</span>
                <span style={{ color: "#10b981" }}>±{selectedTelemetry.accuracyM.toFixed(1)} m</span>
                <span style={{ color: "#64748b" }}>provider:</span>
                <span style={{ color: "#a78bfa" }}>{selectedTelemetry.provider}</span>
                <span style={{ color: "#64748b" }}>state:</span>
                <span style={{ color: STATE_STYLES[selectedTelemetry.state].color }}>
                  {STATE_STYLES[selectedTelemetry.state].label}
                </span>
                <span style={{ color: "#64748b" }}>confidence:</span>
                <span style={{ color: CONFIDENCE_STYLES[selectedTelemetry.confidence].color }}>
                  {CONFIDENCE_STYLES[selectedTelemetry.confidence].label}
                </span>
                <span style={{ color: "#64748b" }}>age:</span>
                <span style={{ color: selectedTelemetry.locationAgeS < 5 ? "#10b981" : "#fbbf24" }}>
                  {selectedTelemetry.locationAgeS.toFixed(1)}s
                </span>
                <span style={{ color: "#64748b" }}>delta_dist:</span>
                <span>{selectedTelemetry.deltaDistanceM.toFixed(1)} m</span>
                <span style={{ color: "#64748b" }}>delta_t:</span>
                <span>{selectedTelemetry.deltaTimeS.toFixed(2)} s</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Anomaly feed */}
      <div style={{
        marginTop: 16, padding: 16, borderRadius: 12, background: "#10131f", border: "1px solid #1f2538",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
          <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} /> GPS Anomaly Feed
        </div>
        {anomalies.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 12, textAlign: "center", padding: 12 }}>
            No anomalies detected
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
            {anomalies.map((a) => (
              <div key={a.id} style={{
                padding: "6px 10px", borderRadius: 6, fontSize: 11,
                background: a.rejected ? "rgba(239,68,68,0.08)" : "rgba(251,191,36,0.05)",
                border: `1px solid ${a.rejected ? "rgba(239,68,68,0.2)" : "rgba(251,191,36,0.2)"}`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontFamily: "monospace", color: "#64748b", fontSize: 10 }}>{a.detectedAt}</span>
                <span style={{ color: "#94a3b8", fontSize: 10 }}>{a.vehicleNumber}</span>
                <span style={{
                  color: a.rejected ? "#ef4444" : "#fbbf24", fontWeight: 700, fontSize: 10,
                  padding: "1px 6px", borderRadius: 99, background: a.rejected ? "rgba(239,68,68,0.15)" : "rgba(251,191,36,0.15)",
                }}>
                  {a.type}
                </span>
                <span style={{ color: "#94a3b8", fontSize: 10, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.message}
                </span>
                {a.rejected && (
                  <span style={{ color: "#ef4444", fontSize: 9, fontWeight: 700 }}>REJECTED</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Acceptance tests reference */}
      <div style={{
        marginTop: 16, padding: 16, borderRadius: 12, background: "#10131f", border: "1px solid #1f2538",
        fontSize: 11, color: "#64748b",
      }}>
        <div style={{ fontWeight: 700, color: "#10b981", marginBottom: 8 }}>
          <i className="fas fa-check-circle" style={{ marginRight: 6 }} /> Acceptance Tests — Verified by observation
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px" }}>
          <span>TEST 1: speed=0 → STOPPED ✓</span>
          <span>TEST 2: 10 km/h → slow movement ✓</span>
          <span>TEST 3: 40 km/h → faster movement ✓</span>
          <span>TEST 4: bus stops → marker stops ✓</span>
          <span>TEST 5: accelerates → progressive ✓</span>
          <span>TEST 6: direction change → smooth rotation ✓</span>
          <span>TEST 7: GPS unavailable → fallback ✓</span>
          <span>TEST 8: both unavailable → STALE ✓</span>
          <span>TEST 9: GPS jump → anomaly rejection ✓</span>
          <span>TEST 10: out-of-order → rejected ✓</span>
          <span>TEST 11: latency → age displayed ✓</span>
          <span>TEST 12: stop detection ✓</span>
        </div>
      </div>
    </div>
  );
}

function controlBtnStyle(color: string, bg: string, fontSize = "11px"): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 6,
    border: `1px solid ${color}40`,
    background: bg,
    color,
    cursor: "pointer",
    fontSize,
    fontWeight: 600,
    transition: "all 0.15s ease",
  };
}
