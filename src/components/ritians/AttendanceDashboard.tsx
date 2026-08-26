"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { routes } from "@/lib/ritians/data";

interface AttendanceRecord {
  id: string;
  studentName: string;
  registerNo: string;
  routeNo: string;
  boardingPoint: string | null;
  status: string;
  markedAt: string;
  markedBy: string;
}

export function AttendanceDashboard({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filter, setFilter] = useState<"all" | "present" | "absent" | "late">("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance");
      const data = await res.json();
      setRecords(data.records || []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRecords();
    const id = setInterval(fetchRecords, 10000);
    return () => clearInterval(id);
  }, [fetchRecords]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return `${r.studentName} ${r.registerNo} ${r.routeNo}`.toLowerCase().includes(q);
    });
  }, [records, filter, query]);

  const stats = useMemo(() => ({
    total: records.length,
    present: records.filter((r) => r.status === "present").length,
    late: records.filter((r) => r.status === "late").length,
    absent: records.filter((r) => r.status === "absent").length,
  }), [records]);

  return (
    <div className="rt-dash-page">
      <div className="rt-dash-top">
        <div>
          <div className="title"><i className="fas fa-chart-bar" style={{ color: "var(--accent2)", marginRight: 8 }} />Attendance Dashboard</div>
          <div className="sub">View, filter &amp; export student attendance records (including AI camera check-in)</div>
        </div>
        <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onBack}><i className="fas fa-arrow-left" /> Back to Admin</button>
      </div>

      <div className="rt-dash-stats">
        <div className="rt-sum-card"><div className="rt-sum-label">Total Marked</div><div className="rt-sum-val">{stats.total}</div><div className="rt-sum-note">All records</div></div>
        <div className="rt-sum-card"><div className="rt-sum-label">Present</div><div className="rt-sum-val" style={{ color: "#5EEAB0" }}>{stats.present}</div><div className="rt-sum-note">On time</div></div>
        <div className="rt-sum-card"><div className="rt-sum-label">Late</div><div className="rt-sum-val" style={{ color: "#FDE68A" }}>{stats.late}</div><div className="rt-sum-note">Boarded late</div></div>
        <div className="rt-sum-card"><div className="rt-sum-label">Absent</div><div className="rt-sum-val" style={{ color: "#FCA5A5" }}>{stats.absent}</div><div className="rt-sum-note">Not boarded</div></div>
      </div>

      <div className="rt-panel" style={{ marginBottom: 16 }}>
        <div className="rt-panel-body" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="rt-report-type-row" style={{ margin: 0 }}>
            <label className="rt-rtype"><input type="radio" name="afilter" checked={filter === "all"} onChange={() => setFilter("all")} /> All</label>
            <label className="rt-rtype"><input type="radio" name="afilter" checked={filter === "present"} onChange={() => setFilter("present")} /> Present</label>
            <label className="rt-rtype"><input type="radio" name="afilter" checked={filter === "late"} onChange={() => setFilter("late")} /> Late</label>
            <label className="rt-rtype"><input type="radio" name="afilter" checked={filter === "absent"} onChange={() => setFilter("absent")} /> Absent</label>
          </div>
          <div className="rt-search-box" style={{ flex: 1, minWidth: 200 }}>
            <i className="fas fa-search" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, register no, route…" />
          </div>
          <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={() => showCSV(records)}>
            <i className="fas fa-file-csv" /> Export CSV
          </button>
        </div>
      </div>

      <div>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text3)" }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 24, marginBottom: 10 }} />
            <div>Loading attendance…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text3)" }}>
            <i className="fas fa-users-slash" style={{ fontSize: 28, display: "block", marginBottom: 10 }} />
            <div style={{ fontSize: 14 }}>No attendance records yet.</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>When drivers mark attendance via the AI Camera in the Driver Portal, records will appear here.</div>
          </div>
        ) : (
          filtered.map((r) => (
            <div key={r.id} className="rt-attendance-row">
              <div className="reg-no">{r.registerNo}</div>
              <div className="name">{r.studentName}</div>
              <div className="route">{r.routeNo}</div>
              <div className="time">{new Date(r.markedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
              <div className={`status ${r.status}`}>
                {r.status === "present" && "✓ "}
                {r.status === "late" && "⏰ "}
                {r.status === "absent" && "✗ "}
                {r.status}
                {r.markedBy === "ai-camera" && " 📷"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function showCSV(records: AttendanceRecord[]) {
  const csv = [
    "Register No,Name,Route,Status,Marked At,Marked By",
    ...records.map((r) => `${r.registerNo},"${r.studentName}",${r.routeNo},${r.status},${new Date(r.markedAt).toISOString()},${r.markedBy}`),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "attendance.csv";
  a.click();
  URL.revokeObjectURL(url);
}
