"use client";

import { useCallback, useEffect, useState } from "react";
import { routes } from "@/lib/ritians/data";
import { useToast } from "@/lib/ritians/toast";
import { useAuth } from "@/lib/ritians/auth";

interface SentNotification {
  id: string;
  title: string;
  body: string;
  routeNo: string | null;
  recipients: number;
  createdAt: string;
}

export function NotificationDashboard({ onBack }: { onBack: () => void }) {
  const { show } = useToast();
  const { session } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [routeNo, setRouteNo] = useState<string>("all");
  const [sent, setSent] = useState<SentNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setSent(data.notifications || []);
    } catch (_) {}
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
  }, [fetchNotifications]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) { show("Title and body are required", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), routeNo: routeNo === "all" ? null : routeNo }),
      });
      if (res.ok) {
        const data = await res.json();
        show(`Notification sent to ${data.notification.recipients} students`);
        setTitle(""); setBody(""); setRouteNo("all");
        fetchNotifications();
      } else { show("Failed to send notification", "error"); }
    } catch (_) { show("Network error", "error"); }
    setLoading(false);
  };

  return (
    <div className="rt-dash-page">
      <div className="rt-dash-top">
        <div>
          <div className="title"><i className="fas fa-bullhorn" style={{ color: "#FBBF24", marginRight: 8 }} />Notification Dashboard</div>
          <div className="sub">Send bus-specific alerts to students instantly</div>
        </div>
        <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onBack}><i className="fas fa-arrow-left" /> Back to Admin</button>
      </div>

      <div className="rt-driver-layout">
        <div className="rt-panel">
          <div className="rt-panel-head"><div><h3>Compose Notification</h3><p>Target a specific route or broadcast to all students.</p></div></div>
          <div className="rt-panel-body">
            <form onSubmit={send} className="rt-notif-compose">
              <div className="rt-form-field">
                <label>Target Audience</label>
                <select value={routeNo} onChange={(e) => setRouteNo(e.target.value)}>
                  <option value="all">📢 All Students (Broadcast)</option>
                  {routes.map((r) => (<option key={r.routeNo} value={r.routeNo}>Bus {r.no} · {r.routeNo} · {r.routeName}</option>))}
                </select>
              </div>
              <div className="rt-form-field"><label>Title *</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Bus R01 delayed by 20 minutes" required /></div>
              <div className="rt-form-field"><label>Message *</label><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Detailed message for students…" required /></div>
              <div className="rt-form-actions">
                <button type="submit" className="rt-btn rt-btn-primary" disabled={loading}>
                  <i className="fas fa-paper-plane" /> {loading ? "Sending…" : "Send Notification"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="rt-panel">
          <div className="rt-panel-head"><div><h3>Recent Notifications</h3><p>Last 24 hours</p></div></div>
          <div className="rt-panel-body">
            <div className="rt-notif-list">
              {sent.length === 0 ? (
                <div style={{ textAlign: "center", padding: 24, color: "var(--text3)", fontSize: 13 }}>
                  <i className="fas fa-bullhorn" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                  No notifications sent yet.
                </div>
              ) : sent.map((n) => (
                <div key={n.id} className="rt-notif-item">
                  <div className="head">
                    <div className="title">{n.title}</div>
                    <div className="time">{new Date(n.createdAt).toLocaleString("en-IN")}</div>
                  </div>
                  <div className="body">{n.body}</div>
                  <div className="meta">
                    <span><i className="fas fa-route" style={{ marginRight: 4, color: "var(--accent2)" }} />{n.routeNo || "All Routes"}</span>
                    <span><i className="fas fa-users" style={{ marginRight: 4, color: "var(--accent2)" }} />{n.recipients} students</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
