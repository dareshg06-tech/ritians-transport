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
  const [stage, setStage] = useState<"idle" | "scanning" | "captured" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Pre-fill from session profile
  const [name, setName] = useState(session?.profile?.fullName || session?.displayName || "");
  const [regNo, setRegNo] = useState(session?.profile?.registerNumber || session?.identifier || "");
  const [routeNo, setRouteNo] = useState(session?.profile?.routeNo || "");

  // Check if camera is available at all
  const cameraAvailable = typeof navigator !== "undefined" && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;

  const startCamera = async () => {
    setError(null);
    if (!cameraAvailable) {
      setError("Camera is not available in this environment. This can happen when the page is loaded in an iframe without camera permissions, or over an insecure (HTTP) connection. You can still save your face registration without a photo — just fill in your details and click Save.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err: unknown) {
      const e = err as Error;
      if (e.name === "NotAllowedError") {
        setError("Camera permission denied. Please allow camera access in your browser settings (look for the camera icon in the address bar), then try again. You can still save without a photo.");
      } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
        setError("No camera found on this device. You can still save your face registration without a photo — just fill in your details and click Save.");
      } else if (e.name === "NotReadableError") {
        setError("Camera is being used by another application. Please close other apps that might be using the camera and try again.");
      } else {
        setError("Camera is not available in this environment. You can still save your face registration without a photo.");
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
    if (!videoRef.current || !canvasRef.current) return false;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    // Mirror the image to match the video preview
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    setCaptured(dataUrl);
    setStage("captured");
    stopCamera();
    return true;
  };

  const startScan = () => {
    if (!cameraOn) {
      setError("Please start the camera first.");
      return;
    }
    setStage("scanning");
    setTimeout(() => {
      const ok = capture();
      if (ok) {
        show("Face captured — click Save to enroll");
      } else {
        setError("Failed to capture image. Please try again.");
        setStage("idle");
      }
    }, 2000);
  };

  // Upload image as file (alternative to base64)
  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCaptured(reader.result as string);
      setStage("captured");
      show("Photo uploaded — click Save to enroll");
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!name.trim() || !regNo.trim()) {
      show("Name and register number are required", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/face-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName: name, registerNo: regNo, routeNo, imageData: captured || "" }),
      });
      if (res.ok) {
        setStage("saved");
        show(`✓ Face registered for ${name} (${regNo})`);
      } else {
        show("Failed to save face data", "error");
      }
    } catch (_) {
      show("Network error", "error");
    }
    setSaving(false);
  };

  const reset = () => {
    setCaptured(null);
    setStage("idle");
    stopCamera();
    setError(null);
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
              {captured ? (
                <img src={captured} alt="Captured face" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                  {!cameraOn && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "var(--text3)" }}>
                      <i className="fas fa-camera" style={{ fontSize: 36, marginBottom: 10 }} />
                      <div style={{ fontSize: 13 }}>{cameraAvailable ? "Camera is off" : "Camera not available"}</div>
                      <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>{cameraAvailable ? "Click Start Camera" : "Use Upload Photo below"}</div>
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
                      <div style={{ position: "absolute", top: 8, left: 8, fontSize: 10, color: "var(--purple)", fontWeight: 700, background: "rgba(0,0,0,0.7)", padding: "2px 8px", borderRadius: 99 }}>SCANNING…</div>
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

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {stage === "idle" && !captured && (
                <>
                  {cameraAvailable && !cameraOn && (
                    <button className="rt-btn rt-btn-primary" onClick={startCamera}>
                      <i className="fas fa-camera" /> Start Camera
                    </button>
                  )}
                  {cameraOn && (
                    <button className="rt-btn rt-btn-primary" onClick={startScan}>
                      <i className="fas fa-face-viewfinder" /> Scan Face
                    </button>
                  )}
                  {/* Upload fallback */}
                  <label className="rt-btn rt-btn-ghost" style={{ cursor: "pointer" }}>
                    <i className="fas fa-upload" /> Upload Photo
                    <input type="file" accept="image/*" onChange={onFileUpload} style={{ display: "none" }} />
                  </label>
                </>
              )}
              {stage === "captured" && captured && (
                <>
                  <button className="rt-btn rt-btn-primary" onClick={save} disabled={saving}>
                    <i className={saving ? "fas fa-spinner fa-spin" : "fas fa-floppy-disk"} /> {saving ? "Saving…" : "Save"}
                  </button>
                  <button className="rt-btn rt-btn-ghost" onClick={() => { setCaptured(null); setStage("idle"); startCamera(); }}>
                    <i className="fas fa-rotate-left" /> Retake
                  </button>
                </>
              )}
              {stage === "saved" && (
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
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Karthik Raja" disabled={stage === "saved"} />
            </div>
            <div className="rt-form-field" style={{ marginBottom: 12 }}>
              <label>Register Number *</label>
              <input value={regNo} onChange={(e) => setRegNo(e.target.value)} placeholder="e.g., 2022CS001" disabled={stage === "saved"} />
            </div>
            <div className="rt-form-field" style={{ marginBottom: 12 }}>
              <label>Route Number</label>
              <input value={routeNo} onChange={(e) => setRouteNo(e.target.value)} placeholder="e.g., R01" disabled={stage === "saved"} />
            </div>

            {/* Save button also in the info panel for convenience */}
            {stage === "captured" && captured && (
              <button className="rt-btn rt-btn-primary rt-btn-full" onClick={save} disabled={saving || !name.trim() || !regNo.trim()}>
                <i className={saving ? "fas fa-spinner fa-spin" : "fas fa-floppy-disk"} /> {saving ? "Saving…" : "Save Face Registration"}
              </button>
            )}

            {stage === "saved" && (
              <div style={{
                marginTop: 14, padding: 12,
                background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)",
                borderRadius: "var(--r)", fontSize: 12, color: "#5EEAB0",
              }}>
                <i className="fas fa-circle-check" style={{ marginRight: 6 }} />
                Face registered successfully! {name} can now use AI camera check-in on the bus.
              </div>
            )}

            {/* Tips */}
            <div style={{ marginTop: 14, padding: 12, background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: "var(--r)", fontSize: 11, color: "var(--text2)" }}>
              <strong style={{ color: "var(--accent2)" }}><i className="fas fa-lightbulb" style={{ marginRight: 5 }} />Tips:</strong>
              <ul style={{ marginTop: 6, paddingLeft: 16 }}>
                <li>Ensure good lighting on your face</li>
                <li>Look directly at the camera</li>
                <li>Remove sunglasses, masks, or caps</li>
                <li>If camera doesn't work, use "Upload Photo" instead</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes rtScan { 0% { top: 0; } 100% { top: 100%; } }`}</style>
    </div>
  );
}
