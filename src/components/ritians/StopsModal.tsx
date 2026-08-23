"use client";

import { Route, Stop, routeStops } from "@/lib/ritians/data";

interface StopsModalProps {
  routeNo: string | null;
  routes: Route[];
  onClose: () => void;
}

export function StopsModal({ routeNo, routes, onClose }: StopsModalProps) {
  if (!routeNo) return null;
  const r = routes.find((x) => x.routeNo === routeNo);
  const stops: Stop[] | undefined = routeStops[routeNo];

  const title = r ? `Bus ${r.no} · ${routeNo} · ${r.routeName}` : routeNo;
  const sub = r ? `Departs ${r.start} · Arrives RIT Campus 7.40 am` : routeNo;

  return (
    <div className="rt-modal-overlay" onClick={onClose}>
      <div className="rt-modal-box" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <button className="rt-modal-close" onClick={onClose} aria-label="Close">
          <i className="fas fa-xmark" />
        </button>
        <div className="rt-modal-header">
          <div className="rt-modal-icon-ring stops-ring"><i className="fas fa-route" /></div>
          <h2>{title}</h2>
          <p>{sub}</p>
        </div>
        <div className="rt-modal-body">
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
                </tr>
              </thead>
              <tbody>
                {stops.map((st, i) => (
                  <tr key={i} className={i === stops.length - 1 ? "rt-stop-last" : ""}>
                    <td className="rt-stop-num">{i + 1}</td>
                    <td>{st.stop}</td>
                    <td className="rt-stop-time">{st.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
