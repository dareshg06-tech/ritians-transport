"use client";

import { useState } from "react";
import { Route, parkingLocations, isToday } from "@/lib/ritians/data";
import { useToast } from "@/lib/ritians/toast";
import type { ParkingInfo } from "./StudentView";

interface DriverViewProps {
  routes: Route[];
  parking: Record<string, ParkingInfo>;
  onPublish: (routeNo: string, info: ParkingInfo) => void;
  onBack: () => void;
  onOpenDriverGps: () => void;
}

export function DriverView({ routes, parking, onPublish, onBack, onOpenDriverGps }: DriverViewProps) {
  const { show } = useToast();
  const [routeNo, setRouteNo] = useState("");
  const [locSel, setLocSel] = useState("");
  const [customLoc, setCustomLoc] = useState("");
  const [note, setNote] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeNo || !locSel) {
      show("Select route and location", "error");
      return;
    }
    const location = locSel === "Other" ? (customLoc || "Custom location") : locSel;
    onPublish(routeNo, { location, note: note || undefined, updatedAt: Date.now() });
    show("Parking location published");
    // reset
    setRouteNo("");
    setLocSel("");
    setCustomLoc("");
    setNote("");
  };

  const todayParking = Object.entries(parking).filter(([, p]) => isToday(p.updatedAt));

  return (
    <div className="rt-page-content">
      <div className="rt-admin-top" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "var(--font-head)", fontSize: 15, fontWeight: 600 }}>
            Driver Parking Portal
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
            Update your exact parking location inside campus for students.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="rt-driver-status-chip">
            <i className="fas fa-circle" style={{ fontSize: 8 }} /> Driver access: unlocked
          </div>
          <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onBack}>
            <i className="fas fa-arrow-left" /> Back
          </button>
        </div>
      </div>

      <div className="rt-driver-layout">
        {/* Form */}
        <div className="rt-panel">
          <div className="rt-panel-head">
            <div>
              <h3>Update Parking Location</h3>
              <p>Select route and current spot inside campus.</p>
            </div>
          </div>
          <div className="rt-panel-body">
            <form onSubmit={submit}>
              <div className="rt-form-grid">
                <div className="rt-form-field">
                  <label>Your Route No *</label>
                  <select value={routeNo} onChange={(e) => setRouteNo(e.target.value)} required>
                    <option value="">Select route…</option>
                    {routes.map((r) => (
                      <option key={r.routeNo} value={r.routeNo}>
                        Bus {r.no} · {r.routeNo} · {r.routeName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rt-form-field">
                  <label>Parking Location *</label>
                  <select
                    value={locSel}
                    onChange={(e) => setLocSel(e.target.value)}
                    required
                  >
                    <option value="">Select a location…</option>
                    {parkingLocations.map((loc, i) => (
                      <option key={loc} value={loc}>{i + 1}. {loc === "Other" ? "Custom (enter your own)" : loc}</option>
                    ))}
                  </select>
                </div>
                {locSel === "Other" && (
                  <div className="rt-form-field">
                    <label>Custom Location</label>
                    <input
                      value={customLoc}
                      onChange={(e) => setCustomLoc(e.target.value)}
                      placeholder="e.g., Near canteen gate, workshop corner…"
                    />
                  </div>
                )}
                <div className="rt-form-field">
                  <label>Extra Note (Optional)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="e.g., Facing main gate, second row from fence…"
                  />
                </div>
              </div>
              <div className="rt-form-actions">
                <button
                  type="button"
                  className="rt-btn rt-btn-ghost rt-btn-sm"
                  onClick={() => { setRouteNo(""); setLocSel(""); setCustomLoc(""); setNote(""); }}
                >
                  <i className="fas fa-rotate-left" /> Clear
                </button>
                <button type="submit" className="rt-btn rt-btn-primary">
                  <i className="fas fa-location-arrow" /> Publish Location
                </button>
              </div>
              <div className="rt-footnote-note">
                <i className="fas fa-info-circle" style={{ color: "var(--accent2)", fontSize: 11, marginRight: 5 }} />
                Parking stored in <code className="rt-code">localStorage</code>. Connect to Firebase for production use.
              </div>
              <button
                type="button"
                className="rt-btn rt-btn-ghost rt-btn-full"
                onClick={onOpenDriverGps}
                style={{ marginTop: 10, textDecoration: "none" }}
              >
                <i className="fas fa-location-dot" /> Open Driver GPS Portal
              </button>
            </form>
          </div>
        </div>

        {/* Live board */}
        <div className="rt-panel">
          <div className="rt-panel-head">
            <div>
              <h3>Live Parking Board</h3>
              <p>Students see these instantly in their table.</p>
            </div>
          </div>
          <div className="rt-panel-body">
            <div className="rt-driver-cards-grid">
              {todayParking.length === 0 ? (
                <div style={{ textAlign: "center", padding: 24, color: "var(--text3)", fontSize: 13 }}>
                  <i className="fas fa-location-dot" style={{ fontSize: 24, display: "block", marginBottom: 8, color: "var(--accent)" }} />
                  No parking updates yet.<br />
                  Waiting for drivers to check in.
                </div>
              ) : (
                todayParking.map(([rno, info]) => {
                  const r = routes.find((x) => x.routeNo === rno);
                  const title = r ? `Bus ${r.no} · ${r.routeNo} · ${r.routeName}` : rno;
                  const t = new Date(info.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={rno} className="rt-driver-card">
                      <div className="rt-driver-card-title">{title}</div>
                      <div className="rt-driver-card-meta">
                        <i className="fas fa-clock" style={{ fontSize: 10, color: "var(--text3)", marginRight: 4 }} />
                        Updated at {t}
                      </div>
                      <div className="rt-driver-card-loc">
                        <i className="fas fa-location-dot" />{info.location}
                      </div>
                      {info.note && (
                        <div className="rt-driver-card-loc" style={{ color: "var(--text2)" }}>
                          <i className="fas fa-note-sticky" />{info.note}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
