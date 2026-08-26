"use client";

import { useEffect, useRef, useState } from "react";
import { Route, parkingLocations, isToday } from "@/lib/ritians/data";
import { useToast } from "@/lib/ritians/toast";
import type { ParkingInfo } from "./StudentView";

interface DriverViewProps {
  routes: Route[];
  parking: Record<string, ParkingInfo>;
  onPublish: (routeNo: string, info: ParkingInfo) => void;
  onBack: () => void;
  onOpenDriverGps: () => void;
}

// AI Camera Attendance component for driver portal
function AiCameraAttendance({ routes }: { routes: Route[] }) {
  const { show } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [checkedIn, setCheckedIn] = useState<{ name: string; regNo: string; time: string }[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualRegNo, setManualRegNo] = useState("");
  const [selectedRoute, setSelectedRoute] = useState("");

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraOn(true);
    } catch (e) {
      show("Camera access denied or unavailable", "error");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setCameraOn(false);
  };

  const scanAndCheckIn = () => {
    if (!cameraOn) { show("Start camera first", "error"); return; }
    setScanning(true);
    setTimeout(async () => {
      setScanning(false);
      // Simulate face recognition — generate a random student from the route
      const names = ["Aarav", "Diya", "Arjun", "Ananya", "Karthik", "Priya", "Vignesh", "Lakshmi", "Surya", "Divya"];
      const name = names[Math.floor(Math.random() * names.length)];
      const regNo = `2022${["CS", "IT", "EC", "ME"][Math.floor(Math.random() * 4)]}${String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")}`;
      const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

      // Save to API
      try {
        await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentName: name, registerNo: regNo, routeNo: selectedRoute || "R01", status: "present", markedBy: "ai-camera" }),
        });
      } catch (_) {}

      setCheckedIn((prev) => [{ name, regNo, time }, ...prev].slice(0, 15));
      show(`✓ ${name} (${regNo}) checked in via AI camera`);
    }, 1500);
  };

  const manualCheckIn = async () => {
    if (!manualName.trim() || !manualRegNo.trim()) { show("Enter name and register number", "error"); return; }
    const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    try {
      await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName: manualName, registerNo: manualRegNo, routeNo: selectedRoute || "R01", status: "present", markedBy: "manual" }),
      });
    } catch (_) {}
    setCheckedIn((prev) => [{ name: manualName, regNo: manualRegNo, time }, ...prev].slice(0, 15));
    show(`${manualName} checked in`);
    setManualName(""); setManualRegNo("");
  };

  useEffect(() => { return () => { stopCamera(); }; }, []);

  return (
    <div className="rt-panel" style={{ marginTop: 18 }}>
      <div className="rt-panel-head">
        <div><h3>AI Camera Attendance</h3><p>Check in students as they board the bus using face recognition</p></div>
      </div>
      <div className="rt-panel-body">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="rt-driver-layout">
          {/* Camera side */}
          <div>
            <div className="rt-form-field" style={{ marginBottom: 10 }}>
              <label>Route</label>
              <select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)}>
                <option value="">Select route…</option>
                {routes.map((r) => (<option key={r.routeNo} value={r.routeNo}>Bus {r.no} · {r.routeNo} · {r.routeName}</option>))}
              </select>
            </div>
            <div style={{ position: "relative", width: "100%", maxWidth: 320, aspectRatio: "4/3", borderRadius: "var(--r)", overflow: "hidden", background: "#000", border: "2px solid var(--border)", marginBottom: 10 }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
              {!cameraOn && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "var(--text3)" }}>
                  <i className="fas fa-camera-retro" style={{ fontSize: 36, marginBottom: 8 }} />
                  <div style={{ fontSize: 12 }}>Camera is off</div>
                </div>
              )}
              {scanning && (
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", border: "3px solid var(--accent2)", borderRadius: "var(--r)" }}>
                  <div style={{ position: "absolute", left: 0, right: 0, height: 3, background: "linear-gradient(90deg, transparent, var(--accent2), transparent)", boxShadow: "0 0 12px var(--accent2)", animation: "rtScan 1.5s linear infinite" }} />
                  <div style={{ position: "absolute", top: 8, left: 8, fontSize: 10, color: "var(--accent2)", fontWeight: 700, background: "rgba(0,0,0,0.7)", padding: "2px 8px", borderRadius: 99 }}>SCANNING…</div>
                </div>
              )}
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!cameraOn ? (
                <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={startCamera}><i className="fas fa-camera" /> Start Camera</button>
              ) : (
                <>
                  <button className="rt-btn rt-btn-primary rt-btn-sm" onClick={scanAndCheckIn} disabled={scanning || !selectedRoute}>
                    <i className="fas fa-face-viewfinder" /> {scanning ? "Scanning…" : "Scan & Check In"}
                  </button>
                  <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={stopCamera}><i className="fas fa-stop" /> Stop Camera</button>
                </>
              )}
            </div>
          </div>

          {/* Manual + checked-in list */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", marginBottom: 8 }}>Manual Check-in</div>
            <div className="rt-form-field" style={{ marginBottom: 8 }}>
              <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Student name" style={{ fontSize: 12, padding: "8px 10px" }} />
            </div>
            <div className="rt-form-field" style={{ marginBottom: 8 }}>
              <input value={manualRegNo} onChange={(e) => setManualRegNo(e.target.value)} placeholder="Register number" style={{ fontSize: 12, padding: "8px 10px" }} />
            </div>
            <button className="rt-btn rt-btn-ghost rt-btn-sm rt-btn-full" onClick={manualCheckIn} style={{ marginBottom: 12 }}>
              <i className="fas fa-user-check" /> Manual Check-in
            </button>

            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", marginBottom: 8 }}>
              Checked In Today ({checkedIn.length})
            </div>
            <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {checkedIn.length === 0 ? (
                <div style={{ padding: 16, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
                  No students checked in yet.
                </div>
              ) : checkedIn.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: "var(--r)", background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <i className="fas fa-circle-check" style={{ color: "#5EEAB0", fontSize: 12 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>{c.regNo}</div>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>{c.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes rtScan { 0% { top: 0; } 100% { top: 100%; } }`}</style>
    </div>
  );
}

export function DriverView({ routes, parking, onPublish, onBack, onOpenDriverGps }: DriverViewProps) {
  const { show } = useToast();
  const [routeNo, setRouteNo] = useState("");
  const [locSel, setLocSel] = useState("");
  const [customLoc, setCustomLoc] = useState("");
  const [note, setNote] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeNo || !locSel) {
      show("Select route and location", "error");
      return;
    }
    const location = locSel === "Other" ? (customLoc || "Custom location") : locSel;
    onPublish(routeNo, { location, note: note || undefined, updatedAt: Date.now() });
    show("Parking location published");
    // reset
    setRouteNo("");
    setLocSel("");
    setCustomLoc("");
    setNote("");
  };

  const todayParking = Object.entries(parking).filter(([, p]) => isToday(p.updatedAt));

  return (
    <div className="rt-page-content">
      <div className="rt-admin-top" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "var(--font-head)", fontSize: 15, fontWeight: 600 }}>
            Driver Parking Portal
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
            Update your exact parking location inside campus for students.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="rt-driver-status-chip">
            <i className="fas fa-circle" style={{ fontSize: 8 }} /> Driver access: unlocked
          </div>
          <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onBack}>
            <i className="fas fa-arrow-left" /> Back
          </button>
        </div>
      </div>

      <div className="rt-driver-layout">
        {/* Form */}
        <div className="rt-panel">
          <div className="rt-panel-head">
            <div>
              <h3>Update Parking Location</h3>
              <p>Select route and current spot inside campus.</p>
            </div>
          </div>
          <div className="rt-panel-body">
            <form onSubmit={submit}>
              <div className="rt-form-grid">
                <div className="rt-form-field">
                  <label>Your Route No *</label>
                  <select value={routeNo} onChange={(e) => setRouteNo(e.target.value)} required>
                    <option value="">Select route…</option>
                    {routes.map((r) => (
                      <option key={r.routeNo} value={r.routeNo}>
                        Bus {r.no} · {r.routeNo} · {r.routeName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rt-form-field">
                  <label>Parking Location *</label>
                  <select
                    value={locSel}
                    onChange={(e) => setLocSel(e.target.value)}
                    required
                  >
                    <option value="">Select a location…</option>
                    {parkingLocations.map((loc, i) => (
                      <option key={loc} value={loc}>{i + 1}. {loc === "Other" ? "Custom (enter your own)" : loc}</option>
                    ))}
                  </select>
                </div>
                {locSel === "Other" && (
                  <div className="rt-form-field">
                    <label>Custom Location</label>
                    <input
                      value={customLoc}
                      onChange={(e) => setCustomLoc(e.target.value)}
                      placeholder="e.g., Near canteen gate, workshop corner…"
                    />
                  </div>
                )}
                <div className="rt-form-field">
                  <label>Extra Note (Optional)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="e.g., Facing main gate, second row from fence…"
                  />
                </div>
              </div>
              <div className="rt-form-actions">
                <button
                  type="button"
                  className="rt-btn rt-btn-ghost rt-btn-sm"
                  onClick={() => { setRouteNo(""); setLocSel(""); setCustomLoc(""); setNote(""); }}
                >
                  <i className="fas fa-rotate-left" /> Clear
                </button>
                <button type="submit" className="rt-btn rt-btn-primary">
                  <i className="fas fa-location-arrow" /> Publish Location
                </button>
              </div>
              <div className="rt-footnote-note">
                <i className="fas fa-info-circle" style={{ color: "var(--accent2)", fontSize: 11, marginRight: 5 }} />
                Parking stored in <code className="rt-code">localStorage</code>. Connect to Firebase for production use.
              </div>
              <button
                type="button"
                className="rt-btn rt-btn-ghost rt-btn-full"
                onClick={onOpenDriverGps}
                style={{ marginTop: 10, textDecoration: "none" }}
              >
                <i className="fas fa-location-dot" /> Open Driver GPS Portal
              </button>
            </form>
          </div>
        </div>

        {/* Live board */}
        <div className="rt-panel">
          <div className="rt-panel-head">
            <div>
              <h3>Live Parking Board</h3>
              <p>Students see these instantly in their table.</p>
            </div>
          </div>
          <div className="rt-panel-body">
            <div className="rt-driver-cards-grid">
              {todayParking.length === 0 ? (
                <div style={{ textAlign: "center", padding: 24, color: "var(--text3)", fontSize: 13 }}>
                  <i className="fas fa-location-dot" style={{ fontSize: 24, display: "block", marginBottom: 8, color: "var(--accent)" }} />
                  No parking updates yet.<br />
                  Waiting for drivers to check in.
                </div>
              ) : (
                todayParking.map(([rno, info]) => {
                  const r = routes.find((x) => x.routeNo === rno);
                  const title = r ? `Bus ${r.no} · ${r.routeNo} · ${r.routeName}` : rno;
                  const t = new Date(info.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={rno} className="rt-driver-card">
                      <div className="rt-driver-card-title">{title}</div>
                      <div className="rt-driver-card-meta">
                        <i className="fas fa-clock" style={{ fontSize: 10, color: "var(--text3)", marginRight: 4 }} />
                        Updated at {t}
                      </div>
                      <div className="rt-driver-card-loc">
                        <i className="fas fa-location-dot" />{info.location}
                      </div>
                      {info.note && (
                        <div className="rt-driver-card-loc" style={{ color: "var(--text2)" }}>
                          <i className="fas fa-note-sticky" />{info.note}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Camera Attendance */}
      <AiCameraAttendance routes={routes} />
    </div>
  );
}
