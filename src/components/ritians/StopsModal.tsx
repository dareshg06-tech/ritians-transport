"use client";

import { useState } from "react";
import { Route, Stop, routeStops, getReturnTrip } from "@/lib/ritians/data";

interface StopsModalProps {
  routeNo: string | null;
  routes: Route[];
  onClose: () => void;
  /** Optional override for which trip to show first. Defaults to "morning". */
  initialTrip?: "morning" | "afternoon";
}

export function StopsModal({ routeNo, routes, onClose, initialTrip = "morning" }: StopsModalProps) {
  const [trip, setTrip] = useState<"morning" | "afternoon">(initialTrip);

  if (!routeNo) return null;
  const r = routes.find((x) => x.routeNo === routeNo);
  const morningStops: Stop[] | undefined = routeStops[routeNo];
  const afternoonStops = getReturnTrip(routeNo);
  const stops = trip === "morning" ? morningStops : afternoonStops;

  const title = r ? `Bus ${r.no} · ${routeNo} · ${r.routeName}` : routeNo;
  const sub = r
    ? trip === "morning"
      ? `Departs ${r.start} · Arrives RIT Campus 7.40 am`
      : `Departs RIT Campus 3.40 pm · Arrives ${r.routeName} ${afternoonStops[afternoonStops.length - 1]?.time || ""}`
    : routeNo;

  return (
    <div className="rt-modal-overlay" onClick={onClose}>
      <div className="rt-modal-box" style={{ maxWidth: 520, maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()}>
        <button className="rt-modal-close" onClick={onClose} aria-label="Close">
          <i className="fas fa-xmark" />
        </button>
        <div className="rt-modal-header">
          <div className="rt-modal-icon-ring stops-ring"><i className="fas fa-route" /></div>
          <h2>{title}</h2>
          <p>{sub}</p>
        </div>
        <div className="rt-modal-body">
          {/* Trip toggle */}
          <div className="rt-report-type-row" style={{ marginBottom: 14 }}>
            <label className="rt-rtype">
              <input
                type="radio"
                name="trip"
                checked={trip === "morning"}
                onChange={() => setTrip("morning")}
              />
              <i className="fas fa-sun" style={{ marginRight: 4 }} /> Morning (To Campus)
            </label>
            <label className="rt-rtype">
              <input
                type="radio"
                name="trip"
                checked={trip === "afternoon"}
                onChange={() => setTrip("afternoon")}
              />
              <i className="fas fa-moon" style={{ marginRight: 4 }} /> Afternoon (From Campus)
            </label>
          </div>

          {!stops || !stops.length ? (
            <p style={{ color: "var(--text3)", fontSize: 13 }}>
              Stop details not yet configured for this route.
            </p>
          ) : (
            <table className="rt-stops-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Stop</th>
                  <th>Time</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {stops.map((st, i) => (
                  <tr key={i} className={i === stops.length - 1 ? "rt-stop-last" : ""}>
                    <td className="rt-stop-num">{i + 1}</td>
                    <td>{st.stop}</td>
                    <td className="rt-stop-time">{st.time}</td>
                    <td>
                      {st.coords ? (
                        <span className="rt-coord-chip" title={`${st.coords.lat.toFixed(4)}, ${st.coords.lng.toFixed(4)}`}>
                          <i className="fas fa-location-dot" />
                          {st.coords.lat.toFixed(3)}, {st.coords.lng.toFixed(3)}
                        </span>
                      ) : st.stop === "RIT Campus" ? (
                        <span className="rt-coord-chip" title="RIT Campus (Kuthambakkam)">
                          <i className="fas fa-school" />
                          13.040, 80.074
                        </span>
                      ) : (
                        <span style={{ color: "var(--text3)", fontSize: 11 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Destination coords banner */}
          {r && (
            <div style={{ marginTop: 14, padding: 12, background: "rgba(255,255,255,0.035)", border: "1px solid var(--border)", borderRadius: "var(--r)", fontSize: 12 }}>
              <div style={{ fontFamily: "var(--font-head)", fontWeight: 600, marginBottom: 6 }}>
                <i className="fas fa-location-crosshairs" style={{ color: "var(--accent2)", marginRight: 6 }} />
                Route Coordinates
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: "var(--text2)" }}>
                <span className="rt-coord-chip">
                  <i className="fas fa-flag" /> Origin: {r.coords.lat.toFixed(4)}, {r.coords.lng.toFixed(4)}
                </span>
                <span className="rt-coord-chip">
                  <i className="fas fa-school" /> RIT Campus: 13.0397, 80.0740
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
