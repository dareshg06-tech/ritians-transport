"use client";

import { useEffect, useMemo, useState } from "react";
import { Route, parseTime } from "@/lib/ritians/data";
import { useToast } from "@/lib/ritians/toast";
import { useAuth } from "@/lib/ritians/auth";

interface AdminViewProps {
  routes: Route[];
  onAddRoute: (r: Route) => void;
  onUpdateRoute: (idx: number, r: Route) => void;
  onDeleteRoute: (idx: number) => void;
  onBack: () => void;
  onOpenQuickLink: (key: "attendance" | "notification" | "feedback") => void;
}

export function AdminView({
  routes, onAddRoute, onUpdateRoute, onDeleteRoute, onBack, onOpenQuickLink,
}: AdminViewProps) {
  const { show } = useToast();
  const { resetRoleUnlocks } = useAuth();
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
      onUpdateRoute(editIdx, { no: routes[editIdx].no, routeNo, routeName, timing, start, coords: routes[editIdx].coords });
      show("Route updated");
    } else {
      onAddRoute({ no: routes.length + 1, routeNo, routeName, timing, start, coords: { lat: 13.0827, lng: 80.2707 } });
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
            <button
              className="rt-btn rt-btn-sm"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5" }}
              onClick={() => { resetRoleUnlocks(); onBack(); show("Admin logged out"); }}
            >
              <i className="fas fa-right-from-bracket" /> Logout
            </button>
          </div>
        </div>

        {/* ═══ RECORDED STUDENT COUNT ═══
            Shows how many students have been recorded by bus drivers at
            their boarding points. Updated in real-time by polling the
            attendance API. */}
        <RecordedStudentCount />

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

        {/* Feedback Dashboard quick-access */}
        <div style={{ marginBottom: 16 }}>
          <button
            className="rt-admin-quick-link"
            onClick={() => onOpenQuickLink("feedback")}
            style={{ width: "100%", border: "none", padding: 0, background: "transparent" }}
          >
            <div className="rt-admin-quick-link__icon" style={{ background: "rgba(34,211,238,0.15)", color: "var(--accent2)", borderColor: "rgba(34,211,238,0.3)" }}>
              <i className="fas fa-comments" />
            </div>
            <div className="rt-admin-quick-link__body">
              <div className="rt-admin-quick-link__title" style={{ color: "var(--accent2)" }}>Feedback Dashboard</div>
              <div className="rt-admin-quick-link__sub">View &amp; analyze student feedback and complaints</div>
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

// ============================================================================
// RecordedStudentCount — shows how many students have been recorded by bus
// drivers at their boarding points. Polls /api/attendance every 10 seconds.
// ============================================================================
interface AttendanceRec {
  id: string;
  studentName: string;
  registerNo: string;
  routeNo: string;
  boardingPoint: string | null;
  status: string;
  markedAt: string;
  markedBy: string;
}

function RecordedStudentCount() {
  const [records, setRecords] = useState<AttendanceRec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res = await fetch("/api/attendance");
        const data = await res.json();
        setRecords(data.records || []);
      } catch (_) {}
      setLoading(false);
    };
    fetchRecords();
    const id = setInterval(fetchRecords, 10000);
    return () => clearInterval(id);
  }, []);

  // Group by route to show per-route counts
  const byRoute = useMemo(() => {
    const map: Record<string, AttendanceRec[]> = {};
    for (const r of records) {
      const key = r.routeNo || "Unknown";
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [records]);

  const total = records.length;
  const present = records.filter((r) => r.status === "present").length;
  const today = records.filter((r) => {
    const d = new Date(r.markedAt);
    const n = new Date();
    return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  return (
    <div className="rt-panel" style={{ marginBottom: 16 }}>
      <div className="rt-panel-header">
        <div className="rt-panel-icon" style={{ background: "rgba(16,185,129,0.15)", color: "#5EEAB0" }}>
          <i className="fas fa-users" />
        </div>
        <div>
          <h3 className="rt-panel-title" style={{ color: "#5EEAB0" }}>Recorded Students</h3>
          <p className="rt-panel-sub">Students recorded by bus drivers at boarding points</p>
        </div>
      </div>
      <div className="rt-panel-body">
        {loading ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text3)" }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 20 }} />
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
              <div style={{ textAlign: "center", padding: "10px 0", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{total}</div>
                <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>Total Records</div>
              </div>
              <div style={{ textAlign: "center", padding: "10px 0", borderRadius: 10, background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#5EEAB0" }}>{today}</div>
                <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>Recorded Today</div>
              </div>
              <div style={{ textAlign: "center", padding: "10px 0", borderRadius: 10, background: "rgba(94,234,176,0.05)", border: "1px solid rgba(94,234,176,0.2)" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#5EEAB0" }}>{present}</div>
                <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>Present</div>
              </div>
            </div>

            {/* Per-route breakdown */}
            {byRoute.length > 0 ? (
              <div>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", fontWeight: 700, marginBottom: 8 }}>
                  Students per route
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {byRoute.slice(0, 10).map(([routeNo, recs]) => (
                    <div key={routeNo} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "6px 10px", borderRadius: 8,
                      background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 99,
                          background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontFamily: "var(--font-mono)",
                        }}>
                          {routeNo}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text3)" }}>
                          {recs[0].boardingPoint || "—"}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 13, fontWeight: 700, color: "#5EEAB0",
                      }}>
                        {recs.length} {recs.length === 1 ? "student" : "students"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text3)" }}>
                <i className="fas fa-user-slash" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                <div style={{ fontSize: 12 }}>No students recorded yet</div>
                <div style={{ fontSize: 10, marginTop: 4 }}>Drivers record students via the Driver GPS portal</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
