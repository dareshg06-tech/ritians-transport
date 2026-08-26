"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { routes } from "@/lib/ritians/data";
import { useToast } from "@/lib/ritians/toast";

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

const DEPARTMENTS_LIST = ["CSE", "IT", "ECE", "MECH", "EEE", "CIVIL", "AI&DS", "BME"];

export function AttendanceDashboard({ onBack }: { onBack: () => void }) {
  const { show } = useToast();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filter, setFilter] = useState<"all" | "present" | "absent" | "late">("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Add/Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    studentName: "",
    registerNo: "",
    routeNo: "",
    boardingPoint: "",
    status: "present" as "present" | "absent" | "late",
  });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  // ── CREATE / UPDATE ──
  const openAdd = () => {
    setEditId(null);
    setForm({ studentName: "", registerNo: "", routeNo: "", boardingPoint: "", status: "present" });
    setModalOpen(true);
  };

  const openEdit = (r: AttendanceRecord) => {
    setEditId(r.id);
    setForm({
      studentName: r.studentName,
      registerNo: r.registerNo,
      routeNo: r.routeNo,
      boardingPoint: r.boardingPoint || "",
      status: r.status as "present" | "absent" | "late",
    });
    setModalOpen(true);
  };

  const saveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentName.trim() || !form.registerNo.trim() || !form.routeNo) {
      show("Name, register number, and route are required", "error");
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        // UPDATE
        const res = await fetch(`/api/attendance/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, boardingPoint: form.boardingPoint || null }),
        });
        if (res.ok) { show("Attendance record updated"); }
        else { show("Failed to update", "error"); }
      } else {
        // CREATE
        const res = await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, boardingPoint: form.boardingPoint || null, markedBy: "manual" }),
        });
        if (res.ok) { show("Student added to attendance"); }
        else { show("Failed to add", "error"); }
      }
      setModalOpen(false);
      fetchRecords();
    } catch (_) { show("Network error", "error"); }
    setSaving(false);
  };

  // ── DELETE ──
  const confirmDelete = (id: string) => setDeleteId(id);

  const doDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/attendance/${deleteId}`, { method: "DELETE" });
      if (res.ok) { show("Record deleted"); fetchRecords(); }
      else { show("Failed to delete", "error"); }
    } catch (_) { show("Network error", "error"); }
    setDeleteId(null);
  };

  return (
    <div className="rt-dash-page">
      <div className="rt-dash-top">
        <div>
          <div className="title"><i className="fas fa-chart-bar" style={{ color: "var(--accent2)", marginRight: 8 }} />Attendance Dashboard</div>
          <div className="sub">Add, edit, delete &amp; export student attendance records</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={openAdd}>
            <i className="fas fa-plus" /> Add Student
          </button>
          <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onBack}>
            <i className="fas fa-arrow-left" /> Back to Admin
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="rt-dash-stats">
        <div className="rt-sum-card"><div className="rt-sum-label">Total</div><div className="rt-sum-val">{stats.total}</div><div className="rt-sum-note">All records</div></div>
        <div className="rt-sum-card"><div className="rt-sum-label">Present</div><div className="rt-sum-val" style={{ color: "#5EEAB0" }}>{stats.present}</div><div className="rt-sum-note">On time</div></div>
        <div className="rt-sum-card"><div className="rt-sum-label">Late</div><div className="rt-sum-val" style={{ color: "#FDE68A" }}>{stats.late}</div><div className="rt-sum-note">Boarded late</div></div>
        <div className="rt-sum-card"><div className="rt-sum-label">Absent</div><div className="rt-sum-val" style={{ color: "#FCA5A5" }}>{stats.absent}</div><div className="rt-sum-note">Not boarded</div></div>
      </div>

      {/* Filter + search + export */}
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
          <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => showCSV(records)}>
            <i className="fas fa-file-csv" /> Export CSV
          </button>
        </div>
      </div>

      {/* Records table */}
      <div className="rt-panel">
        <div className="rt-panel-head">
          <div><h3>Attendance Records</h3><p>{filtered.length} record{filtered.length === 1 ? "" : "s"} · Click edit or delete to manage</p></div>
        </div>
        <div className="rt-panel-body" style={{ paddingTop: 0 }}>
          <div className="rt-table-wrap">
            <table className="rt-routes-table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Register No</th>
                  <th>Student Name</th>
                  <th>Route</th>
                  <th>Boarding Point</th>
                  <th>Marked At</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{ cursor: "default" }}>
                    <td>{i + 1}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{r.registerNo}</td>
                    <td>{r.studentName} {r.markedBy === "ai-camera" && <span title="AI Camera" style={{ marginLeft: 4 }}>📷</span>}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{r.routeNo}</td>
                    <td style={{ color: "var(--text3)", fontSize: 12 }}>{r.boardingPoint || "—"}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text3)" }}>
                      {new Date(r.markedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td>
                      <span className={`rt-badge ${r.status === "present" ? "rt-badge-normal" : r.status === "late" ? "rt-badge-late" : "rt-badge-parking-off"}`}>
                        {r.status === "present" && "✓ "}
                        {r.status === "late" && "⏰ "}
                        {r.status === "absent" && "✗ "}
                        {r.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="rt-admin-table-action edit" onClick={() => openEdit(r)} title="Edit">
                        <i className="fas fa-pen" />
                      </button>
                      <button className="rt-admin-table-action del" onClick={() => confirmDelete(r.id)} title="Delete">
                        <i className="fas fa-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading ? (
              <div style={{ padding: 48, textAlign: "center", color: "var(--text3)" }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: 24, marginBottom: 10 }} />
                <div>Loading attendance…</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "var(--text3)" }}>
                <i className="fas fa-users-slash" style={{ fontSize: 28, display: "block", marginBottom: 10 }} />
                <div style={{ fontSize: 14 }}>No attendance records found.</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Click "Add Student" to create one, or mark attendance via the Driver Portal AI Camera.</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="rt-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="rt-modal-box" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <button className="rt-modal-close" onClick={() => setModalOpen(false)} aria-label="Close">
              <i className="fas fa-xmark" />
            </button>
            <div className="rt-modal-header">
              <div className="rt-modal-icon-ring stops-ring"><i className="fas fa-user-edit" /></div>
              <h2>{editId ? "Edit Attendance Record" : "Add Attendance Record"}</h2>
              <p>{editId ? "Update student attendance details" : "Manually add a student to attendance"}</p>
            </div>
            <div className="rt-modal-body">
              <form onSubmit={saveRecord}>
                <div className="rt-form-grid">
                  <div className="rt-form-field">
                    <label>Student Name *</label>
                    <input value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} placeholder="e.g., Arun Kumar" required autoFocus />
                  </div>
                  <div className="rt-form-field">
                    <label>Register Number *</label>
                    <input value={form.registerNo} onChange={(e) => setForm({ ...form, registerNo: e.target.value })} placeholder="e.g., 2022CS001" required />
                  </div>
                  <div className="rt-form-field">
                    <label>Route *</label>
                    <select value={form.routeNo} onChange={(e) => setForm({ ...form, routeNo: e.target.value })} required>
                      <option value="">Select route…</option>
                      {routes.map((r) => (
                        <option key={r.routeNo} value={r.routeNo}>{r.routeNo} · {r.routeName} (Bus {r.no})</option>
                      ))}
                    </select>
                  </div>
                  <div className="rt-form-field">
                    <label>Boarding Point</label>
                    <input value={form.boardingPoint} onChange={(e) => setForm({ ...form, boardingPoint: e.target.value })} placeholder="e.g., Lift Gate" />
                  </div>
                  <div className="rt-form-field">
                    <label>Status *</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "present" | "absent" | "late" })} required>
                      <option value="present">✓ Present</option>
                      <option value="late">⏰ Late</option>
                      <option value="absent">✗ Absent</option>
                    </select>
                  </div>
                </div>
                <div className="rt-form-actions">
                  <button type="button" className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setModalOpen(false)}>
                    <i className="fas fa-xmark" /> Cancel
                  </button>
                  <button type="submit" className="rt-btn rt-btn-primary rt-btn-sm" disabled={saving}>
                    <i className={saving ? "fas fa-spinner fa-spin" : "fas fa-floppy-disk"} /> {editId ? "Update" : "Add"} Record
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="rt-modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="rt-modal-box" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="rt-modal-header">
              <div className="rt-modal-icon-ring" style={{ background: "linear-gradient(135deg, #EF4444, #DC2626)" }}>
                <i className="fas fa-trash" />
              </div>
              <h2>Delete Record?</h2>
              <p>This action cannot be undone.</p>
            </div>
            <div className="rt-modal-body">
              <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16, textAlign: "center" }}>
                Are you sure you want to delete this attendance record?
                This will permanently remove it from the database.
              </div>
              <div className="rt-form-actions" style={{ justifyContent: "center" }}>
                <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setDeleteId(null)}>
                  <i className="fas fa-xmark" /> Cancel
                </button>
                <button className="rt-btn rt-btn-sm" style={{ background: "linear-gradient(135deg, #EF4444, #DC2626)", color: "#fff" }} onClick={doDelete}>
                  <i className="fas fa-trash" /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function showCSV(records: AttendanceRecord[]) {
  const csv = [
    "Register No,Name,Route,Boarding Point,Status,Marked At,Marked By",
    ...records.map((r) => `${r.registerNo},"${r.studentName}",${r.routeNo},"${r.boardingPoint || ""}",${r.status},${new Date(r.markedAt).toISOString()},${r.markedBy}`),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "attendance.csv";
  a.click();
  URL.revokeObjectURL(url);
}
