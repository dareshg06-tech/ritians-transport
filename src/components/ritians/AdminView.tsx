"use client";

import { useMemo, useState } from "react";
import { Route, parseTime } from "@/lib/ritians/data";
import { useToast } from "@/lib/ritians/toast";

interface AdminViewProps {
  routes: Route[];
  onAddRoute: (r: Route) => void;
  onUpdateRoute: (idx: number, r: Route) => void;
  onDeleteRoute: (idx: number) => void;
  onBack: () => void;
  onOpenQuickLink: (key: "attendance" | "sos" | "notification") => void;
}

export function AdminView({
  routes, onAddRoute, onUpdateRoute, onDeleteRoute, onBack, onOpenQuickLink,
}: AdminViewProps) {
  const { show } = useToast();
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [routeNo, setRouteNo] = useState("");
  const [routeName, setRouteName] = useState("");
  const [timing, setTiming] = useState("Boarding Points");
  const [start, setStart] = useState("");

  const stats = useMemo(() => {
    if (!routes.length) return { total: 0, earliest: "–", latest: "–" };
    const sorted = [...routes].sort((a, b) => parseTime(a.start) - parseTime(b.start));
    return {
      total: routes.length,
      earliest: sorted[0].start,
      latest: sorted[sorted.length - 1].start,
    };
  }, [routes]);

  const resetForm = () => {
    setEditIdx(null);
    setRouteNo("");
    setRouteName("");
    setTiming("Boarding Points");
    setStart("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeNo || !routeName || !timing || !start) {
      show("Fill all fields", "error");
      return;
    }
    if (editIdx !== null) {
      onUpdateRoute(editIdx, { no: routes[editIdx].no, routeNo, routeName, timing, start });
      show("Route updated");
    } else {
      onAddRoute({ no: routes.length + 1, routeNo, routeName, timing, start });
      show("Route added");
    }
    resetForm();
  };

  const edit = (i: number) => {
    const r = routes[i];
    setEditIdx(i);
    setRouteNo(r.routeNo);
    setRouteName(r.routeName);
    setTiming(r.timing);
    setStart(r.start);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const del = (i: number) => {
    if (!confirm("Delete this route?")) return;
    onDeleteRoute(i);
    show("Route deleted");
  };

  return (
    <div className="rt-page-content">
      <div className="rt-admin-wrap">
        <div className="rt-admin-top">
          <div>
            <div style={{ fontFamily: "var(--font-head)", fontSize: 15, fontWeight: 600 }}>
              Admin Control Center
            </div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
              Manage bus routes &amp; timings. Changes are immediate.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div className="rt-admin-status-chip">
              <i className="fas fa-circle" style={{ fontSize: 8 }} /> Admin access: unlocked
            </div>
            <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onBack}>
              <i className="fas fa-arrow-left" /> Back
            </button>
          </div>
        </div>

        {/* Attendance Dashboard quick-access */}
        <div style={{ marginBottom: 16 }}>
          <button className="rt-admin-quick-link" onClick={() => onOpenQuickLink("attendance")} style={{ width: "100%", border: "none", padding: 0, background: "transparent" }}>
            <div className="rt-admin-quick-link__icon"><i className="fas fa-chart-bar" /></div>
            <div className="rt-admin-quick-link__body">
              <div className="rt-admin-quick-link__title">Attendance Dashboard</div>
              <div className="rt-admin-quick-link__sub">View, filter &amp; export student attendance records</div>
            </div>
            <i className="fas fa-arrow-right rt-admin-quick-link__arrow" />
          </button>
        </div>

        {/* SOS Dashboard quick-access */}
        <div style={{ marginBottom: 16 }}>
          <button
            className="rt-admin-quick-link"
            onClick={() => onOpenQuickLink("sos")}
            style={{
              width: "100%", border: "none", padding: 0, background: "transparent",
            }}
          >
            <div className="rt-admin-quick-link__icon" style={{ background: "rgba(255,31,31,0.15)", color: "#FF1F1F", borderColor: "rgba(255,31,31,0.3)" }}>
              <i className="fas fa-bell" />
            </div>
            <div className="rt-admin-quick-link__body">
              <div className="rt-admin-quick-link__title" style={{ color: "#FF1F1F" }}>SOS Dashboard</div>
              <div className="rt-admin-quick-link__sub">Monitor &amp; respond to emergency alerts in real-time</div>
            </div>
            <i className="fas fa-arrow-right rt-admin-quick-link__arrow" />
          </button>
        </div>

        {/* Notification Dashboard quick-access */}
        <div style={{ marginBottom: 16 }}>
          <button
            className="rt-admin-quick-link"
            onClick={() => onOpenQuickLink("notification")}
            style={{ width: "100%", border: "none", padding: 0, background: "transparent" }}
          >
            <div className="rt-admin-quick-link__icon" style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", borderColor: "rgba(251,191,36,0.3)" }}>
              <i className="fas fa-bullhorn" />
            </div>
            <div className="rt-admin-quick-link__body">
              <div className="rt-admin-quick-link__title" style={{ color: "#FBBF24" }}>Notification Dashboard</div>
              <div className="rt-admin-quick-link__sub">Send bus-specific alerts to students instantly</div>
            </div>
            <i className="fas fa-arrow-right rt-admin-quick-link__arrow" />
          </button>
        </div>

        <div className="rt-admin-layout">
          {/* Form */}
          <div className="rt-panel">
            <div className="rt-panel-head">
              <div>
                <h3>{editIdx !== null ? "Edit Route" : "Add New Route"}</h3>
                <p>Fill details and save to update the master list.</p>
              </div>
            </div>
            <div className="rt-panel-body">
              <form onSubmit={submit}>
                <div className="rt-form-grid">
                  <div className="rt-form-field">
                    <label>Route No *</label>
                    <input value={routeNo} onChange={(e) => setRouteNo(e.target.value)} placeholder="e.g., R01, R16A" required />
                  </div>
                  <div className="rt-form-field">
                    <label>Route Name *</label>
                    <input value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="e.g., Ennore, Velachery" required />
                  </div>
                  <div className="rt-form-field">
                    <label>Timing Label *</label>
                    <input value={timing} onChange={(e) => setTiming(e.target.value)} placeholder="e.g., Boarding Points" required />
                  </div>
                  <div className="rt-form-field">
                    <label>Starting Time *</label>
                    <input value={start} onChange={(e) => setStart(e.target.value)} placeholder="e.g., 6.10 am" required />
                    <span className="rt-hint">Format: <code className="rt-code">6.10 am</code>, <code className="rt-code">5.50 am</code></span>
                  </div>
                </div>
                <div className="rt-form-actions">
                  <button type="button" className="rt-btn rt-btn-ghost rt-btn-sm" onClick={resetForm}>
                    <i className="fas fa-rotate-left" /> Clear
                  </button>
                  <button type="submit" className="rt-btn rt-btn-primary rt-btn-sm">
                    <i className="fas fa-floppy-disk" /> {editIdx !== null ? "Update Route" : "Save Route"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="rt-summary-cards">
              <div className="rt-sum-card">
                <div className="rt-sum-label">Total Routes</div>
                <div className="rt-sum-val">{stats.total}</div>
                <div className="rt-sum-note">Live from schedule</div>
              </div>
              <div className="rt-sum-card">
                <div className="rt-sum-label">Earliest Departure</div>
                <div className="rt-sum-val" style={{ color: "var(--accent2)" }}>{stats.earliest}</div>
                <div className="rt-sum-note">First bus start time</div>
              </div>
              <div className="rt-sum-card">
                <div className="rt-sum-label">Latest Departure</div>
                <div className="rt-sum-val" style={{ color: "var(--text2)" }}>{stats.latest}</div>
                <div className="rt-sum-note">Last bus start time</div>
              </div>
            </div>
            <div className="rt-admin-help">
              <strong style={{ fontSize: 12, color: "var(--text2)" }}>Admin notes</strong>
              <ul style={{ marginTop: 6 }}>
                <li>Editing a route instantly updates the student dashboard.</li>
                <li>Keep time format consistent: <code className="rt-code">6.10 am</code></li>
              </ul>
              <div className="rt-cred-note">
                Default login: <code className="rt-code">admin@college.edu</code> / <code className="rt-code">admin123</code> &nbsp;or&nbsp;
                <code className="rt-code">123456</code> / <code className="rt-code">123456</code>
              </div>
            </div>
          </div>
        </div>

        {/* Admin table */}
        <div className="rt-panel">
          <div className="rt-panel-head">
            <div>
              <h3>Manage Routes</h3>
              <p>Edit or delete existing routes.</p>
            </div>
          </div>
          <div className="rt-panel-body" style={{ paddingTop: 0 }}>
            <div className="rt-table-wrap">
              <table className="rt-routes-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Route No</th>
                    <th>Route Name</th>
                    <th>Timing</th>
                    <th>Start</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((r, i) => (
                    <tr key={`${r.routeNo}-${i}`}>
                      <td>{r.no}</td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{r.routeNo}</td>
                      <td>{r.routeName}</td>
                      <td style={{ color: "var(--text3)" }}>{r.timing}</td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{r.start}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="rt-admin-table-action edit" onClick={() => edit(i)} aria-label="Edit">
                          <i className="fas fa-pen" />
                        </button>
                        <button className="rt-admin-table-action del" onClick={() => del(i)} aria-label="Delete">
                          <i className="fas fa-trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
