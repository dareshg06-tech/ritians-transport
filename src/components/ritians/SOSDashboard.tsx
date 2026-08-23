"use client";

import { useMemo, useState } from "react";
import { routes } from "@/lib/ritians/data";
import { useToast } from "@/lib/ritians/toast";

interface SOSAlert {
  id: number;
  studentName: string;
  regNo: string;
  routeNo: string;
  message: string;
  timestamp: number;
  status: "active" | "resolved";
  location: string;
}

function genSOS(): SOSAlert[] {
  const names = ["Aarav K", "Diya R", "Arjun S", "Ananya M", "Karthik P", "Priya V"];
  const messages = [
    "Bus breakdown near Tambaram",
    "Feeling unwell, need assistance",
    "Missed the bus at boarding point",
    "Bus delayed by 30+ minutes",
    "Unsafe driving behaviour",
  ];
  const locations = ["Tambaram", "Guindy", "Velachery", "Poonamallee", "Avadi"];
  return names.slice(0, 4).map((n, i) => ({
    id: i + 1,
    studentName: n,
    regNo: `2022${["CS", "IT", "EC", "ME"][i % 4]}${(i + 1).toString().padStart(3, "0")}`,
    routeNo: routes[i * 5].routeNo,
    message: messages[i],
    timestamp: Date.now() - i * 1000 * 60 * 8,
    status: i === 0 ? "active" : "resolved",
    location: locations[i],
  }));
}

export function SOSDashboard({ onBack }: { onBack: () => void }) {
  const { show } = useToast();
  const [alerts, setAlerts] = useState<SOSAlert[]>(() => genSOS());

  const stats = useMemo(() => ({
    active: alerts.filter((a) => a.status === "active").length,
    resolved: alerts.filter((a) => a.status === "resolved").length,
    total: alerts.length,
  }), [alerts]);

  const resolve = (id: number) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: "resolved" } : a)));
    show("SOS alert resolved");
  };

  return (
    <div className="rt-dash-page">
      <div className="rt-dash-top">
        <div>
          <div className="title"><i className="fas fa-bell" style={{ color: "#FF1F1F", marginRight: 8 }} />SOS Dashboard</div>
          <div className="sub">Monitor &amp; respond to emergency alerts in real-time</div>
        </div>
        <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onBack}>
          <i className="fas fa-arrow-left" /> Back to Admin
        </button>
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
          <div className="rt-sum-note">Past 24 hours</div>
        </div>
        <div className="rt-sum-card">
          <div className="rt-sum-label">Total Today</div>
          <div className="rt-sum-val">{stats.total}</div>
          <div className="rt-sum-note">All alerts received</div>
        </div>
        <div className="rt-sum-card">
          <div className="rt-sum-label">Avg Response</div>
          <div className="rt-sum-val" style={{ color: "var(--accent2)" }}>4m</div>
          <div className="rt-sum-note">Time to resolve</div>
        </div>
      </div>

      <div>
        <div style={{ fontFamily: "var(--font-head)", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Active Alerts ({alerts.filter((a) => a.status === "active").length})
        </div>
        {alerts.map((a) => (
          <div key={a.id} className={`rt-sos-card ${a.status === "resolved" ? "resolved" : ""}`}>
            <div className="icon">
              <i className={a.status === "active" ? "fas fa-bell" : "fas fa-check"} />
            </div>
            <div className="body">
              <div className="title">
                {a.studentName} · {a.regNo} · Route {a.routeNo}
              </div>
              <div className="meta">
                <i className="fas fa-clock" style={{ marginRight: 4 }} />
                {new Date(a.timestamp).toLocaleString("en-IN")}
                <span style={{ margin: "0 8px" }}>·</span>
                <i className="fas fa-location-dot" style={{ marginRight: 4 }} />
                {a.location}
              </div>
              <div style={{ fontSize: 13, marginTop: 8, color: "var(--text)" }}>{a.message}</div>
              <div className="actions">
                {a.status === "active" ? (
                  <>
                    <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={() => resolve(a.id)}>
                      <i className="fas fa-check" /> Mark Resolved
                    </button>
                    <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => show(`Calling ${a.studentName}…`)}>
                      <i className="fas fa-phone" /> Call Student
                    </button>
                    <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => show("Driver notified")}>
                      <i className="fas fa-bus" /> Notify Driver
                    </button>
                  </>
                ) : (
                  <span className="rt-badge rt-badge-parking-on">
                    <i className="fas fa-check-circle" /> Resolved
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rt-footnote-note" style={{ marginTop: 18 }}>
        <i className="fas fa-info-circle" style={{ color: "var(--accent2)", fontSize: 11, marginRight: 5 }} />
        Mock alerts shown — connect Firebase Cloud Messaging for real-time student SOS pushes.
      </div>
    </div>
  );
}
