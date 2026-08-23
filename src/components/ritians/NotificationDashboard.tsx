"use client";

import { useMemo, useState } from "react";
import { routes } from "@/lib/ritians/data";
import { useToast } from "@/lib/ritians/toast";

interface SentNotification {
  id: number;
  title: string;
  body: string;
  routeNo: string | "all";
  timestamp: number;
  recipients: number;
}

export function NotificationDashboard({ onBack }: { onBack: () => void }) {
  const { show } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [routeNo, setRouteNo] = useState<string | "all">("all");
  const [sent, setSent] = useState<SentNotification[]>([
    {
      id: 1,
      title: "Bus R24 Arcot delayed by 15 minutes",
      body: "Due to traffic near Kaveripakkam. Please plan accordingly.",
      routeNo: "R24",
      timestamp: Date.now() - 1000 * 60 * 25,
      recipients: 42,
    },
    {
      id: 2,
      title: "All buses will depart at 3.40 pm today",
      body: "Regular afternoon schedule. Please be at the boarding point on time.",
      routeNo: "all",
      timestamp: Date.now() - 1000 * 60 * 180,
      recipients: 1240,
    },
  ]);

  const stats = useMemo(() => ({
    sent24h: sent.length,
    recipients: sent.reduce((a, b) => a + b.recipients, 0),
    routes: new Set(sent.map((s) => s.routeNo)).size,
  }), [sent]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      show("Title and body are required", "error");
      return;
    }
    const recipients = routeNo === "all" ? 1240 : Math.floor(30 + Math.random() * 80);
    const newNotif: SentNotification = {
      id: Date.now(),
      title: title.trim(),
      body: body.trim(),
      routeNo,
      timestamp: Date.now(),
      recipients,
    };
    setSent((prev) => [newNotif, ...prev]);
    show(`Notification sent to ${recipients} students`);
    setTitle("");
    setBody("");
    setRouteNo("all");
  };

  return (
    <div className="rt-dash-page">
      <div className="rt-dash-top">
        <div>
          <div className="title"><i className="fas fa-bullhorn" style={{ color: "#FBBF24", marginRight: 8 }} />Notification Dashboard</div>
          <div className="sub">Send bus-specific alerts to students instantly</div>
        </div>
        <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onBack}>
          <i className="fas fa-arrow-left" /> Back to Admin
        </button>
      </div>

      <div className="rt-dash-stats">
        <div className="rt-sum-card">
          <div className="rt-sum-label">Sent (24h)</div>
          <div className="rt-sum-val">{stats.sent24h}</div>
          <div className="rt-sum-note">All notifications</div>
        </div>
        <div className="rt-sum-card">
          <div className="rt-sum-label">Total Recipients</div>
          <div className="rt-sum-val" style={{ color: "var(--accent2)" }}>{stats.recipients}</div>
          <div className="rt-sum-note">Students reached</div>
        </div>
        <div className="rt-sum-card">
          <div className="rt-sum-label">Routes Targeted</div>
          <div className="rt-sum-val">{stats.routes}</div>
          <div className="rt-sum-note">Including "all"</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="rt-driver-layout">
        {/* Compose */}
        <div className="rt-panel">
          <div className="rt-panel-head">
            <div><h3>Compose Notification</h3><p>Target a specific route or broadcast to all students.</p></div>
          </div>
          <div className="rt-panel-body">
            <form onSubmit={send} className="rt-notif-compose">
              <div className="rt-form-field">
                <label>Target Audience</label>
                <select value={routeNo} onChange={(e) => setRouteNo(e.target.value as string | "all")}>
                  <option value="all">📢 All Students (Broadcast)</option>
                  {routes.map((r) => (
                    <option key={r.routeNo} value={r.routeNo}>
                      Bus {r.no} · {r.routeNo} · {r.routeName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rt-form-field">
                <label>Title *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Bus R01 delayed by 20 minutes"
                  required
                />
              </div>
              <div className="rt-form-field">
                <label>Message *</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  placeholder="Detailed message for students…"
                  required
                />
              </div>
              <div className="rt-form-actions">
                <button type="submit" className="rt-btn rt-btn-primary">
                  <i className="fas fa-paper-plane" /> Send Notification
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Recent notifications */}
        <div className="rt-panel">
          <div className="rt-panel-head">
            <div><h3>Recent Notifications</h3><p>Last 24 hours</p></div>
          </div>
          <div className="rt-panel-body">
            <div className="rt-notif-list">
              {sent.map((n) => (
                <div key={n.id} className="rt-notif-item">
                  <div className="head">
                    <div className="title">{n.title}</div>
                    <div className="time">{timeAgo(n.timestamp)}</div>
                  </div>
                  <div className="body">{n.body}</div>
                  <div className="meta">
                    <span><i className="fas fa-route" style={{ marginRight: 4, color: "var(--accent2)" }} /> {n.routeNo === "all" ? "All Routes" : n.routeNo}</span>
                    <span><i className="fas fa-users" style={{ marginRight: 4, color: "var(--accent2)" }} /> {n.recipients} students</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rt-footnote-note" style={{ marginTop: 18 }}>
        <i className="fas fa-info-circle" style={{ color: "var(--accent2)", fontSize: 11, marginRight: 5 }} />
        Mock send — wire up Firebase Cloud Messaging to push real notifications to student devices.
      </div>
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
