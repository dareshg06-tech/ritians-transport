"use client";

import { useMemo, useState } from "react";
import { routes } from "@/lib/ritians/data";

interface AttendanceRow {
  regNo: string;
  name: string;
  routeNo: string;
  boardingTime: string;
  status: "present" | "absent" | "late";
}

// Generate mock attendance data deterministically
function genAttendance(): AttendanceRow[] {
  const firstNames = ["Aarav", "Diya", "Arjun", "Ananya", "Karthik", "Priya", "Vignesh", "Lakshmi", "Surya", "Divya", "Rahul", "Sneha", "Vikram", "Aishwarya", "Manoj", "Kavya", "Santhosh", "Bhavana", "Gokul", "Meera"];
  const lastInitials = ["K", "R", "S", "M", "P", "V", "N", "A", "C", "T"];

  const rows: AttendanceRow[] = [];
  for (let i = 0; i < 60; i++) {
    const fn = firstNames[i % firstNames.length];
    const li = lastInitials[i % lastInitials.length];
    const route = routes[i % routes.length];
    const yr = 2022 + (i % 3);
    const dept = ["CS", "IT", "EC", "ME", "EE", "CE"][i % 6];
    const num = (i + 1).toString().padStart(3, "0");
    const regNo = `${yr}${dept}${num}`;
    // Deterministic status: ~70% present, 20% late, 10% absent
    const r = (i * 7) % 10;
    const status: AttendanceRow["status"] = r < 7 ? "present" : r < 9 ? "late" : "absent";
    rows.push({
      regNo,
      name: `${fn} ${li}`,
      routeNo: route.routeNo,
      boardingTime: route.start,
      status,
    });
  }
  return rows;
}

export function AttendanceDashboard({ onBack }: { onBack: () => void }) {
  const [data] = useState<AttendanceRow[]>(() => genAttendance());
  const [filter, setFilter] = useState<"all" | "present" | "absent" | "late">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return `${r.regNo} ${r.name} ${r.routeNo}`.toLowerCase().includes(q);
    });
  }, [data, filter, query]);

  const stats = useMemo(() => {
    const present = data.filter((r) => r.status === "present").length;
    const late = data.filter((r) => r.status === "late").length;
    const absent = data.filter((r) => r.status === "absent").length;
    return { total: data.length, present, late, absent, rate: Math.round((present / data.length) * 100) };
  }, [data]);

  return (
    <div className="rt-dash-page">
      <div className="rt-dash-top">
        <div>
          <div className="title"><i className="fas fa-chart-bar" style={{ color: "var(--accent2)", marginRight: 8 }} />Attendance Dashboard</div>
          <div className="sub">View, filter &amp; export student attendance records</div>
        </div>
        <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onBack}>
          <i className="fas fa-arrow-left" /> Back to Admin
        </button>
      </div>

      {/* Stats */}
      <div className="rt-dash-stats">
        <div className="rt-sum-card">
          <div className="rt-sum-label">Total Students</div>
          <div className="rt-sum-val">{stats.total}</div>
          <div className="rt-sum-note">Across all routes</div>
        </div>
        <div className="rt-sum-card">
          <div className="rt-sum-label">Present</div>
          <div className="rt-sum-val" style={{ color: "#5EEAB0" }}>{stats.present}</div>
          <div className="rt-sum-note">{stats.rate}% attendance rate</div>
        </div>
        <div className="rt-sum-card">
          <div className="rt-sum-label">Late</div>
          <div className="rt-sum-val" style={{ color: "#FDE68A" }}>{stats.late}</div>
          <div className="rt-sum-note">Boarded after schedule</div>
        </div>
        <div className="rt-sum-card">
          <div className="rt-sum-label">Absent</div>
          <div className="rt-sum-val" style={{ color: "#FCA5A5" }}>{stats.absent}</div>
          <div className="rt-sum-note">Not boarded today</div>
        </div>
      </div>

      {/* Filter + search */}
      <div className="rt-panel" style={{ marginBottom: 16 }}>
        <div className="rt-panel-body" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="rt-report-type-row" style={{ margin: 0 }}>
            <label className="rt-rtype">
              <input type="radio" name="afilter" checked={filter === "all"} onChange={() => setFilter("all")} /> All
            </label>
            <label className="rt-rtype">
              <input type="radio" name="afilter" checked={filter === "present"} onChange={() => setFilter("present")} /> Present
            </label>
            <label className="rt-rtype">
              <input type="radio" name="afilter" checked={filter === "late"} onChange={() => setFilter("late")} /> Late
            </label>
            <label className="rt-rtype">
              <input type="radio" name="afilter" checked={filter === "absent"} onChange={() => setFilter("absent")} /> Absent
            </label>
          </div>
          <div className="rt-search-box" style={{ flex: 1, minWidth: 200 }}>
            <i className="fas fa-search" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by register no, name, route…"
            />
          </div>
          <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={() => alert("Exporting CSV… (mock)")}>
            <i className="fas fa-file-csv" /> Export CSV
          </button>
        </div>
      </div>

      {/* List */}
      <div>
        {filtered.map((r, i) => (
          <div key={i} className="rt-attendance-row">
            <div className="reg-no">{r.regNo}</div>
            <div className="name">{r.name}</div>
            <div className="route">{r.routeNo}</div>
            <div className="time">{r.boardingTime}</div>
            <div className={`status ${r.status}`}>{r.status}</div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="rt-no-results">
            <i className="fas fa-users-slash" />
            <p>No students match your filter.</p>
          </div>
        )}
      </div>

      <div className="rt-footnote-note" style={{ marginTop: 18 }}>
        <i className="fas fa-info-circle" style={{ color: "var(--accent2)", fontSize: 11, marginRight: 5 }} />
        Mock data shown — connect Firebase or your SIS for live attendance records.
      </div>
    </div>
  );
}
