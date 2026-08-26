"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/lib/ritians/toast";
import { useAuth } from "@/lib/ritians/auth";

export function FaceRegister({ onBack }: { onBack: () => void }) {
  const { show } = useToast();
  const { session } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "scanning" | "captured" | "enrolled">("idle");
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from session profile
  const [name, setName] = useState(session?.profile?.fullName || session?.displayName || "");
  const [regNo, setRegNo] = useState(session?.profile?.registerNumber || session?.identifier || "");
  const [routeNo, setRouteNo] = useState(session?.profile?.routeNo || "");

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err: unknown) {
      const e = err as Error;
      if (e.name === "NotAllowedError") {
        setError("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (e.name === "NotFoundError") {
        setError("No camera found. Please connect a camera and try again.");
      } else {
        setError(e.message || "Failed to access camera.");
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  };

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror the image to match the video preview
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    setCaptured(dataUrl);
    setStage("captured");
    stopCamera();
  };

  const startScan = () => {
    setStage("scanning");
    setTimeout(() => {
      setStage("captured");
      capture();
      show("Face captured — click Enroll to save");
    }, 2000);
  };

  const enroll = async () => {
    if (!name.trim() || !regNo.trim()) {
      show("Name and register number are required", "error");
      return;
    }
    setStage("enrolled");
    try {
      const res = await fetch("/api/face-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName: name, registerNo: regNo, routeNo, imageData: captured || "" }),
      });
      if (res.ok) {
        show(`Face enrolled for ${name} (${regNo})`);
      } else {
        show("Failed to save face data", "error");
        setStage("captured");
      }
    } catch (_) {
      show("Network error", "error");
      setStage("captured");
    }
  };

  const reset = () => {
    setCaptured(null);
    setStage("idle");
    stopCamera();
  };

  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

  return (
    <div className="rt-dash-page">
      <div className="rt-dash-top">
        <div>
          <div className="title"><i className="fas fa-face-viewfinder" style={{ color: "#A78BFA", marginRight: 8 }} />Face Registration</div>
          <div className="sub">Biometric attendance — capture your face for AI-powered check-in</div>
        </div>
        <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onBack}><i className="fas fa-arrow-left" /> Back to Dashboard</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="rt-driver-layout">
        {/* Camera / capture area */}
        <div className="rt-panel">
          <div className="rt-panel-head"><div><h3>Camera Capture</h3><p>Look directly at the camera and click "Scan Face".</p></div></div>
          <div className="rt-panel-body">
            <div style={{ position: "relative", width: "100%", maxWidth: 360, margin: "0 auto", aspectRatio: "4/3", borderRadius: "var(--r)", overflow: "hidden", background: "#000", border: "2px solid var(--border)" }}>
              {stage === "enrolled" && captured ? (
                <img src={captured} alt="Enrolled face" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : captured && stage === "captured" ? (
                <img src={captured} alt="Captured face" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                  {!cameraOn && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "var(--text3)" }}>
                      <i className="fas fa-camera" style={{ fontSize: 36, marginBottom: 10 }} />
                      <div style={{ fontSize: 13 }}>Camera is off</div>
                    </div>
                  )}
                  {stage === "scanning" && (
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                      <div style={{
                        position: "absolute", left: 0, right: 0, height: 3,
                        background: "linear-gradient(90deg, transparent, var(--purple), transparent)",
                        boxShadow: "0 0 12px var(--purple)",
                        animation: "rtScan 2s linear infinite",
                      }} />
                    </div>
                  )}
                </>
              )}
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>

            {error && (
              <div className="rt-gps-error" style={{ marginTop: 14 }}>
                <i className="fas fa-triangle-exclamation" />
                <div>{error}</div>
              </div>
            )}

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {stage === "idle" && !cameraOn && (
                <button className="rt-btn rt-btn-primary" onClick={startCamera}>
                  <i className="fas fa-camera" /> Start Camera
                </button>
              )}
              {cameraOn && stage === "idle" && (
                <button className="rt-btn rt-btn-primary" onClick={startScan}>
                  <i className="fas fa-face-viewfinder" /> Scan Face
                </button>
              )}
              {stage === "captured" && (
                <>
                  <button className="rt-btn rt-btn-primary" onClick={enroll}>
                    <i className="fas fa-floppy-disk" /> Enroll Face
                  </button>
                  <button className="rt-btn rt-btn-ghost" onClick={() => { setCaptured(null); setStage("idle"); startCamera(); }}>
                    <i className="fas fa-rotate-left" /> Retake
                  </button>
                </>
              )}
              {stage === "enrolled" && (
                <button className="rt-btn rt-btn-ghost" onClick={reset}>
                  <i className="fas fa-plus" /> Register Another
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Student info */}
        <div className="rt-panel">
          <div className="rt-panel-head"><div><h3>Student Information</h3><p>Link face data to a student record.</p></div></div>
          <div className="rt-panel-body">
            <div className="rt-form-field" style={{ marginBottom: 12 }}>
              <label>Full Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Karthik Raja" disabled={stage === "enrolled"} />
            </div>
            <div className="rt-form-field" style={{ marginBottom: 12 }}>
              <label>Register Number *</label>
              <input value={regNo} onChange={(e) => setRegNo(e.target.value)} placeholder="e.g., 2022CS001" disabled={stage === "enrolled"} />
            </div>
            <div className="rt-form-field" style={{ marginBottom: 12 }}>
              <label>Route Number</label>
              <input value={routeNo} onChange={(e) => setRouteNo(e.target.value)} placeholder="e.g., R01" disabled={stage === "enrolled"} />
            </div>

            {stage === "enrolled" && (
              <div style={{
                marginTop: 14, padding: 12,
                background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)",
                borderRadius: "var(--r)", fontSize: 12, color: "#5EEAB0",
              }}>
                <i className="fas fa-circle-check" style={{ marginRight: 6 }} />
                Face enrolled successfully! {name} can now use AI camera check-in on the bus.
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes rtScan { 0% { top: 0; } 100% { top: 100%; } }`}</style>
    </div>
  );
}
