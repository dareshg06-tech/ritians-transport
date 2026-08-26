"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface Feedback {
  id: string;
  type: string;
  message: string;
  tags: string;
  studentName: string | null;
  routeNo: string | null;
  createdAt: string;
}

export function FeedbackDashboard({ onBack }: { onBack: () => void }) {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "complaint" | "feedback">("all");

  const fetchFeedback = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback");
      const data = await res.json();
      setFeedback(data.feedback || []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFeedback();
    const id = setInterval(fetchFeedback, 10000);
    return () => clearInterval(id);
  }, [fetchFeedback]);

  const filtered = useMemo(() => {
    if (filter === "all") return feedback;
    return feedback.filter((f) => f.type === filter);
  }, [feedback, filter]);

  // Analyze tags
  const tagStats = useMemo(() => {
    const counts: Record<string, number> = {};
    feedback.forEach((f) => {
      if (f.tags) {
        f.tags.split(",").filter(Boolean).forEach((t) => {
          counts[t] = (counts[t] || 0) + 1;
        });
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [feedback]);

  const stats = {
    total: feedback.length,
    complaints: feedback.filter((f) => f.type === "complaint").length,
    positive: feedback.filter((f) => f.type === "feedback").length,
  };

  return (
    <div className="rt-dash-page">
      <div className="rt-dash-top">
        <div>
          <div className="title"><i className="fas fa-comments" style={{ color: "var(--accent2)", marginRight: 8 }} />Feedback Dashboard</div>
          <div className="sub">View and analyze student feedback &amp; complaints</div>
        </div>
        <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onBack}><i className="fas fa-arrow-left" /> Back to Admin</button>
      </div>

      <div className="rt-dash-stats">
        <div className="rt-sum-card"><div className="rt-sum-label">Total Feedback</div><div className="rt-sum-val">{stats.total}</div><div className="rt-sum-note">All submissions</div></div>
        <div className="rt-sum-card"><div className="rt-sum-label">Complaints</div><div className="rt-sum-val" style={{ color: "#FCA5A5" }}>{stats.complaints}</div><div className="rt-sum-note">Issues reported</div></div>
        <div className="rt-sum-card"><div className="rt-sum-label">Positive Feedback</div><div className="rt-sum-val" style={{ color: "#5EEAB0" }}>{stats.positive}</div><div className="rt-sum-note">Appreciation</div></div>
        {tagStats[0] && (
          <div className="rt-sum-card"><div className="rt-sum-label">Top Tag</div><div className="rt-sum-val" style={{ color: "var(--accent2)", fontSize: 16 }}>{tagStats[0][0].replace(/-/g, " ")}</div><div className="rt-sum-note">{tagStats[0][1]} mentions</div></div>
        )}
      </div>

      {/* Tag analysis */}
      {tagStats.length > 0 && (
        <div className="rt-panel" style={{ marginBottom: 16 }}>
          <div className="rt-panel-head"><div><h3>Tag Analysis</h3><p>Most mentioned topics in feedback</p></div></div>
          <div className="rt-panel-body">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {tagStats.map(([tag, count]) => (
                <div key={tag} style={{
                  padding: "8px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600,
                  background: count > 2 ? "rgba(251,191,36,0.12)" : "rgba(34,211,238,0.1)",
                  border: `1px solid ${count > 2 ? "rgba(251,191,36,0.3)" : "rgba(34,211,238,0.25)"}`,
                  color: count > 2 ? "#FDE68A" : "var(--accent2)",
                }}>
                  {tag.replace(/-/g, " ")} · {count}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="rt-panel" style={{ marginBottom: 16 }}>
        <div className="rt-panel-body" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="rt-report-type-row" style={{ margin: 0 }}>
            <label className="rt-rtype"><input type="radio" name="ffilter" checked={filter === "all"} onChange={() => setFilter("all")} /> All ({feedback.length})</label>
            <label className="rt-rtype"><input type="radio" name="ffilter" checked={filter === "complaint"} onChange={() => setFilter("complaint")} /> Complaints ({stats.complaints})</label>
            <label className="rt-rtype"><input type="radio" name="ffilter" checked={filter === "feedback"} onChange={() => setFilter("feedback")} /> Feedback ({stats.positive})</label>
          </div>
        </div>
      </div>

      {/* Feedback list */}
      <div>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text3)" }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 24, marginBottom: 10 }} />
            <div>Loading feedback…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text3)" }}>
            <i className="fas fa-inbox" style={{ fontSize: 28, display: "block", marginBottom: 10 }} />
            <div style={{ fontSize: 14 }}>No feedback received yet.</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>When students submit feedback from their dashboard, it will appear here.</div>
          </div>
        ) : (
          filtered.map((f) => (
            <div key={f.id} className="rt-sos-card" style={f.type === "complaint" ? {} : { background: "rgba(52,211,153,0.06)", borderColor: "rgba(52,211,153,0.22)" }}>
              <div className="icon" style={f.type === "complaint" ? { background: "rgba(255,31,31,0.2)", color: "#FF1F1F" } : { background: "rgba(52,211,153,0.2)", color: "#34D399" }}>
                <i className={f.type === "complaint" ? "fas fa-triangle-exclamation" : "fas fa-thumbs-up"} />
              </div>
              <div className="body">
                <div className="title" style={f.type === "complaint" ? { color: "#FCA5A5" } : { color: "#5EEAB0" }}>
                  {f.type === "complaint" ? "Complaint" : "Positive Feedback"}
                  {f.studentName && ` · ${f.studentName}`}
                  {f.routeNo && ` · Route ${f.routeNo}`}
                </div>
                <div className="meta">
                  <i className="fas fa-clock" style={{ marginRight: 4 }} />
                  {new Date(f.createdAt).toLocaleString("en-IN")}
                </div>
                <div style={{ fontSize: 13, marginTop: 8, color: "var(--text)" }}>{f.message}</div>
                {f.tags && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {f.tags.split(",").filter(Boolean).map((tag) => (
                      <span key={tag} className="rt-badge rt-badge-normal" style={{ fontSize: 10 }}>
                        {tag.replace(/-/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
