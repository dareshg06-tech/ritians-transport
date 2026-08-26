"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/lib/ritians/toast";

interface SOSAlert {
  id: string;
  studentName: string;
  registerNo: string;
  routeNo: string | null;
  message: string;
  location: string | null;
  status: string;
  createdAt: string;
}

export function SOSDashboard({ onBack }: { onBack: () => void }) {
  const { show } = useToast();
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/sos");
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAlerts();
    const id = setInterval(fetchAlerts, 5000);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  const resolve = async (id: string) => {
    try {
      await fetch("/api/sos/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      show("SOS alert resolved");
      fetchAlerts();
    } catch (_) { show("Failed to resolve", "error"); }
  };

  const stats = {
    active: alerts.filter((a) => a.status === "active").length,
    resolved: alerts.filter((a) => a.status === "resolved").length,
    total: alerts.length,
  };

  return (
    <div className="rt-dash-page">
      <div className="rt-dash-top">
        <div>
          <div className="title"><i className="fas fa-bell" style={{ color: "#FF1F1F", marginRight: 8 }} />SOS Dashboard</div>
          <div className="sub">Monitor &amp; respond to emergency alerts in real-time</div>
        </div>
        <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onBack}><i className="fas fa-arrow-left" /> Back to Admin</button>
      </div>

      <div className="rt-dash-stats">
        <div className="rt-sum-card" style={{ borderLeft: "3px solid #FF1F1F" }}>
          <div className="rt-sum-label">Active Alerts</div>
          <div className="rt-sum-val" style={{ color: "#FF1F1F" }}>{stats.active}</div>
          <div className="rt-sum-note">Needs immediate action</div>
        </div>
        <div className="rt-sum-card">
          <div className="rt-sum-label">Resolved</div>
          <div className="rt-sum-val" style={{ color: "#5EEAB0" }}>{stats.resolved}</div>
          <div className="rt-sum-note">Past alerts</div>
        </div>
        <div className="rt-sum-card">
          <div className="rt-sum-label">Total</div>
          <div className="rt-sum-val">{stats.total}</div>
          <div className="rt-sum-note">All alerts received</div>
        </div>
      </div>

      <div>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text3)" }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 24, marginBottom: 10 }} />
            <div>Loading alerts…</div>
          </div>
        ) : alerts.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text3)" }}>
            <i className="fas fa-bell-slash" style={{ fontSize: 28, display: "block", marginBottom: 10 }} />
            <div style={{ fontSize: 14 }}>No SOS alerts received.</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>When a student presses the SOS button, it will appear here instantly.</div>
          </div>
        ) : (
          alerts.map((a) => (
            <div key={a.id} className={`rt-sos-card ${a.status === "resolved" ? "resolved" : ""}`}>
              <div className="icon"><i className={a.status === "active" ? "fas fa-bell" : "fas fa-check"} /></div>
              <div className="body">
                <div className="title">{a.studentName} · {a.registerNo} {a.routeNo && `· Route ${a.routeNo}`}</div>
                <div className="meta">
                  <i className="fas fa-clock" style={{ marginRight: 4 }} />
                  {new Date(a.createdAt).toLocaleString("en-IN")}
                  {a.location && <><span style={{ margin: "0 8px" }}>·</span><i className="fas fa-location-dot" style={{ marginRight: 4 }} />{a.location}</>}
                </div>
                <div style={{ fontSize: 13, marginTop: 8, color: "var(--text)" }}>{a.message}</div>
                {a.status === "active" ? (
                  <div className="actions">
                    <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={() => resolve(a.id)}><i className="fas fa-check" /> Mark Resolved</button>
                    <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => show(`Calling ${a.studentName}…`)}><i className="fas fa-phone" /> Call Student</button>
                  </div>
                ) : (
                  <span className="rt-badge rt-badge-parking-on"><i className="fas fa-check-circle" /> Resolved</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
