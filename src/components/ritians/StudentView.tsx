"use client";

import { useMemo, useState } from "react";
import { Route, parseTime, timeCat, isToday, routeStops } from "@/lib/ritians/data";
import { useToast } from "@/lib/ritians/toast";
import { useAuth } from "@/lib/ritians/auth";

export interface ParkingInfo {
  location: string;
  note?: string;
  updatedAt: number;
}

interface StudentViewProps {
  routes: Route[];
  parking: Record<string, ParkingInfo>;
  onOpenStops: (routeNo: string) => void;
}

export function StudentView({ routes, parking, onOpenStops }: StudentViewProps) {
  const { show } = useToast();
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("time-asc");
  const [sosSending, setSosSending] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [weekDays] = useState<Date[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(d);
    }
    return days;
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = routes.filter((r) => {
      // Build searchable text: route number, name, start time, timing label
      let txt = `${r.no} ${r.routeNo} ${r.routeName} ${r.start} ${r.timing}`;
      // Include boarding stop names + their times so searching
      // "Kasimedu" or "Kalmandapam" returns every bus that passes via that stop.
      const stops = routeStops[r.routeNo];
      if (stops && stops.length > 0) {
        txt += " " + stops.map((s) => `${s.stop} ${s.time}`).join(" ");
      }
      return txt.toLowerCase().includes(q);
    });
    if (sort === "time-asc") arr = [...arr].sort((a, b) => parseTime(a.start) - parseTime(b.start));
    else if (sort === "time-desc") arr = [...arr].sort((a, b) => parseTime(b.start) - parseTime(a.start));
    else if (sort === "route-asc") arr = [...arr].sort((a, b) => a.routeNo.localeCompare(b.routeNo));
    else if (sort === "route-desc") arr = [...arr].sort((a, b) => b.routeNo.localeCompare(a.routeNo));
    return arr;
  }, [routes, query, sort]);

  const todayParkingCount = useMemo(
    () => Object.values(parking).filter((p) => isToday(p.updatedAt)).length,
    [parking]
  );

  const dateLabel = selectedDate.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const highlights = useMemo(() => {
    const sorted = [...routes].sort((a, b) => parseTime(a.start) - parseTime(b.start));
    return [
      {
        title: "Earliest Departures",
        badge: "Start first",
        items: sorted.slice(0, 3),
      },
      {
        title: "IT Corridor",
        badge: "South Chennai",
        items: routes
          .filter((r) => /(Sholinganallur|Velachery|Neelangkarai|Pallikaranai|Guindy)/i.test(r.routeName))
          .slice(0, 3),
      },
      {
        title: "Far Distance",
        badge: "Long haul",
        items: routes
          .filter((r) => /(Kancheepuram|Thiruthani|Arcot|Chengalpattu)/i.test(r.routeName))
          .slice(0, 3),
      },
    ];
  }, [routes]);

  const sendSOS = async () => {
    if (sosSending) return;
    if (!confirm("Send an SOS emergency alert to the admin? Use only in real emergencies.")) return;
    setSosSending(true);
    try {
      const res = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: session?.profile?.fullName || session?.displayName || "Student",
          registerNo: session?.profile?.registerNumber || session?.identifier || "unknown",
          routeNo: session?.profile?.routeNo || null,
          message: "Emergency alert — student needs assistance",
          location: "Student Dashboard",
        }),
      });
      if (res.ok) {
        show("🚨 SOS alert sent to admin — help is on the way", "info");
      } else {
        show("Failed to send SOS", "error");
      }
    } catch (_) {
      show("Network error — please try again", "error");
    }
    setSosSending(false);
  };

  return (
    <div className="rt-page-content">
      {/* SOS floating button */}
      <button
        onClick={sendSOS}
        disabled={sosSending}
        style={{
          position: "fixed", bottom: 90, right: 80, zIndex: 95,
          width: 56, height: 56, borderRadius: "50%",
          background: sosSending ? "rgba(239,68,68,0.5)" : "linear-gradient(135deg, #EF4444, #DC2626)",
          border: "2px solid rgba(255,255,255,0.15)",
          color: "#fff", fontSize: 20, cursor: sosSending ? "not-allowed" : "pointer",
          boxShadow: "0 8px 28px rgba(239,68,68,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s ease",
        }}
        title="Send SOS emergency alert"
        aria-label="Send SOS"
      >
        {sosSending ? (
          <i className="fas fa-spinner fa-spin" />
        ) : (
          <>
            <i className="fas fa-bell" />
            <span style={{ position: "absolute", top: -2, right: -2, width: 14, height: 14, borderRadius: "50%", background: "#fff", border: "2px solid #EF4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#EF4444", fontWeight: 700 }}>!</span>
          </>
        )}
      </button>

      {/* Week strip */}
      <div className="rt-week-strip">
        <div className="rt-week-label">
          Buses for <span>{dateLabel}</span>
        </div>
        <div className="rt-week-days">
          {weekDays.map((d, i) => {
            const lbl =
              d.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase() + " " + d.getDate();
            const active = selectedDate.toDateString() === d.toDateString();
            return (
              <button
                key={i}
                className={`rt-wday ${active ? "active" : ""}`}
                onClick={() => setSelectedDate(d)}
              >
                {lbl}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rt-main-grid">
        {/* Left: routes table */}
        <div className="rt-panel">
          <div className="rt-panel-head">
            <div>
              <h3>All Bus Routes</h3>
              <p>Click any row to view detailed boarding stops.</p>
            </div>
            <div className="rt-search-row">
              <div className="rt-search-box">
                <i className="fas fa-search" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by route, boarding point, area, stop, time…"
                />
              </div>
              <select
                className="rt-styled-select"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="time-asc">Earliest First</option>
                <option value="time-desc">Latest First</option>
                <option value="route-asc">Route A → Z</option>
                <option value="route-desc">Route Z → A</option>
              </select>
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
                    <th>Starting Time</th>
                    <th>Campus Parking</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const min = parseTime(r.start);
                    const cat = timeCat(min);
                    const bClass =
                      cat === "early" ? "rt-badge-early" :
                      cat === "late" ? "rt-badge-late" : "rt-badge-normal";
                    const bLabel = cat === "early" ? "Early" : cat === "late" ? "Late" : "Regular";
                    const pk = parking[r.routeNo];
                    const pkIsToday = pk && isToday(pk.updatedAt);
                    return (
                      <tr
                        key={r.routeNo}
                        onClick={() => onOpenStops(r.routeNo)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>{r.no}</td>
                        <td>{r.routeNo}</td>
                        <td>{r.routeName}</td>
                        <td style={{ color: "var(--text3)" }}>{r.timing}</td>
                        <td>
                          <span className={`rt-badge ${bClass}`}>
                            <i className="fas fa-clock" style={{ fontSize: 10 }} />
                            {r.start} · {bLabel}
                          </span>
                        </td>
                        <td>
                          {pkIsToday ? (
                            <span className="rt-badge rt-badge-parking-on">
                              <i className="fas fa-location-dot" style={{ fontSize: 10 }} />
                              {pk!.location.length > 28 ? pk!.location.slice(0, 28) + "…" : pk!.location}
                            </span>
                          ) : (
                            <span className="rt-badge rt-badge-parking-off">
                              <i className="fas fa-circle" style={{ fontSize: 7 }} />
                              Not updated
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="rt-no-results">
                  <i className="fas fa-bus-simple" />
                  <p>No routes match your search.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: sidebar */}
        <aside>
          <div className="rt-panel">
            <div className="rt-panel-head">
              <div>
                <h3>Highlights</h3>
                <p>Key route clusters</p>
              </div>
            </div>
            <div className="rt-panel-body">
              {highlights.map((g) => (
                <div key={g.title} className="rt-hl-card">
                  <div className="rt-hl-title">
                    {g.title}
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--text3)",
                      fontWeight: 400,
                      float: "right",
                    }}>
                      {g.badge}
                    </span>
                  </div>
                  {g.items.map((r) => (
                    <div key={r.routeNo} className="rt-hl-row">
                      <span><i className="fas fa-route" />{r.routeNo} · {r.routeName}</span>
                      <span>{r.start}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="rt-panel" style={{ marginTop: 14 }}>
            <div className="rt-panel-body">
              <div className="rt-legend-section" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
                <div className="rt-legend-title">Timing Legend</div>
                <div className="rt-legend-item"><span className="rt-dot rt-dot-early" /> Before 6:00 am — Early</div>
                <div className="rt-legend-item"><span className="rt-dot rt-dot-normal" /> 6:00 – 6:30 am — Regular</div>
                <div className="rt-legend-item"><span className="rt-dot rt-dot-late" /> After 6:30 am — Late start</div>
              </div>
              <div className="rt-legend-section">
                <div className="rt-legend-title">Parking Legend</div>
                <div className="rt-legend-item"><span className="rt-dot rt-dot-on" /> Parking updated by driver</div>
                <div className="rt-legend-item"><span className="rt-dot rt-dot-off" /> Not yet updated</div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* About + Report */}
      <AboutReport onSubmit={submitFeedback} />
    </div>
  );
}

function submitFeedback(data: { type: string; message: string; tags: string[] }) {
  fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).catch(() => {});
}

function AboutReport({ onSubmit }: { onSubmit: (data: { type: string; message: string; tags: string[] }) => void }) {
  const [type, setType] = useState<"complaint" | "feedback">("complaint");
  const [message, setMessage] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const { show } = useToast();

  const toggleTag = (tag: string) => {
    setTags((t) => t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) { show("Please enter a message", "error"); return; }
    onSubmit({ type, message: message.trim(), tags });
    show("Thank you for your feedback! It has been sent to the admin.");
    setMessage("");
    setTags([]);
  };

  return (
    <div className="rt-about-section">
      <div className="rt-about-grid">
        <div className="rt-about-info">
          <h3>About Ritians Transport</h3>
          <p className="rt-muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.7 }}>
            <strong style={{ color: "var(--text)" }}>Rajalakshmi Institute of Technology</strong><br />
            Bangalore Highway Road, Kuthambakkam,<br />
            Chennai, Tamil Nadu – 600124<br /><br />
            <i className="fas fa-phone" style={{ color: "var(--accent2)", fontSize: 11, marginRight: 5 }} />
            91446718 1600 / 61
          </p>
        </div>
        <div className="rt-about-report">
          <h3>Report / Feedback</h3>
          <p>Help us improve your transport experience. All feedback is stored and reviewed by admin.</p>
          <form onSubmit={submit}>
            <div className="rt-report-type-row">
              <label className={`rt-rtype ${type === "complaint" ? "rt-rtype-active" : ""}`} style={type === "complaint" ? { background: "linear-gradient(135deg, var(--accent), #E8501E)", color: "#fff" } : {}}>
                <input type="radio" name="rType" value="complaint" checked={type === "complaint"} onChange={() => setType("complaint")} /> Complaint
              </label>
              <label className={`rt-rtype ${type === "feedback" ? "rt-rtype-active" : ""}`} style={type === "feedback" ? { background: "linear-gradient(135deg, var(--accent), #E8501E)", color: "#fff" } : {}}>
                <input type="radio" name="rType" value="feedback" checked={type === "feedback"} onChange={() => setType("feedback")} /> Feedback
              </label>
            </div>
            <div className="rt-report-tags">
              {["good-driving", "comfortable", "on-time", "clean", "more-buses"].map((tag) => (
                <label key={tag} className={`rt-rtag ${tags.includes(tag) ? "rt-rtag-active" : ""}`} style={tags.includes(tag) ? { background: "rgba(34,211,238,0.14)", borderColor: "var(--accent2)", color: "var(--accent2)" } : {}}>
                  <input type="checkbox" value={tag} checked={tags.includes(tag)} onChange={() => toggleTag(tag)} />
                  {tag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </label>
              ))}
            </div>
            <div className="rt-form-field" style={{ marginBottom: 10 }}>
              <textarea rows={2} placeholder="Additional comments…" value={message} onChange={(e) => setMessage(e.target.value)} required />
            </div>
            <button type="submit" className="rt-btn rt-btn-primary rt-btn-sm">
              <i className="fas fa-paper-plane" /> Submit Feedback
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
