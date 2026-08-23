"use client";

import { useState } from "react";
import { useToast } from "@/lib/ritians/toast";

type Stage = "idle" | "scanning" | "captured" | "enrolled";

export function FaceRegister({ onBack }: { onBack: () => void }) {
  const { show } = useToast();
  const [stage, setStage] = useState<Stage>("idle");
  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");

  const startScan = () => {
    if (!name.trim() || !regNo.trim()) {
      show("Enter name and register number first", "error");
      return;
    }
    setStage("scanning");
    setTimeout(() => {
      setStage("captured");
      show("Face captured — click Enroll to save");
    }, 2500);
  };

  const enroll = () => {
    setStage("enrolled");
    show(`Face enrolled for ${name} (${regNo})`);
  };

  const reset = () => {
    setStage("idle");
    setName("");
    setRegNo("");
  };

  return (
    <div className="rt-dash-page">
      <div className="rt-dash-top">
        <div>
          <div className="title"><i className="fas fa-face-viewfinder" style={{ color: "#A78BFA", marginRight: 8 }} />Face Registration</div>
          <div className="sub">Biometric attendance registration for students</div>
        </div>
        <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={onBack}>
          <i className="fas fa-arrow-left" /> Back to Dashboard
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="rt-driver-layout">
        {/* Capture */}
        <div className="rt-panel">
          <div className="rt-panel-head">
            <div><h3>Face Capture</h3><p>Look directly at the camera and stay still during scan.</p></div>
          </div>
          <div className="rt-panel-body">
            <div
              className={`rt-face-capture ${stage === "scanning" ? "scanning" : ""}`}
              onClick={stage === "idle" ? startScan : undefined}
              style={{ cursor: stage === "idle" ? "pointer" : "default" }}
            >
              <i className={`fas ${stage === "captured" || stage === "enrolled" ? "fa-face-smile-beam" : "fa-user"} icon`} />
              <div className="text">
                {stage === "idle" && "Click to start face scan"}
                {stage === "scanning" && "Scanning… stay still"}
                {stage === "captured" && "Face captured successfully"}
                {stage === "enrolled" && "Enrollment complete"}
              </div>
              <div className="hint">
                {stage === "idle" && "Camera access required"}
                {stage === "scanning" && "Approximately 2 seconds"}
                {stage === "captured" && "Click Enroll to save"}
                {stage === "enrolled" && "You can now use face attendance"}
              </div>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              {stage === "idle" && (
                <button className="rt-btn rt-btn-primary" onClick={startScan}>
                  <i className="fas fa-camera" /> Start Scan
                </button>
              )}
              {stage === "captured" && (
                <>
                  <button className="rt-btn rt-btn-primary" onClick={enroll}>
                    <i className="fas fa-floppy-disk" /> Enroll Face
                  </button>
                  <button className="rt-btn rt-btn-ghost" onClick={startScan}>
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
          <div className="rt-panel-head">
            <div><h3>Student Information</h3><p>Link face data to a student record.</p></div>
          </div>
          <div className="rt-panel-body">
            <div className="rt-form-field" style={{ marginBottom: 12 }}>
              <label>Full Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Karthik Raja"
                disabled={stage !== "idle"}
              />
            </div>
            <div className="rt-form-field" style={{ marginBottom: 12 }}>
              <label>Register Number *</label>
              <input
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                placeholder="e.g., 2022CS001"
                disabled={stage !== "idle"}
              />
            </div>
            <div className="rt-form-field" style={{ marginBottom: 12 }}>
              <label>Route Number</label>
              <input placeholder="e.g., R01" disabled={stage !== "idle"} />
            </div>
            <div className="rt-form-field">
              <label>Phone (for OTP verification)</label>
              <input placeholder="+91 98765 43210" disabled={stage !== "idle"} />
            </div>

            {stage === "enrolled" && (
              <div style={{
                marginTop: 14, padding: 12,
                background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)",
                borderRadius: "var(--r)", fontSize: 12, color: "#5EEAB0",
              }}>
                <i className="fas fa-circle-check" style={{ marginRight: 6 }} />
                Face template saved. {name} can now mark attendance via face recognition.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rt-footnote-note" style={{ marginTop: 18 }}>
        <i className="fas fa-info-circle" style={{ color: "var(--accent2)", fontSize: 11, marginRight: 5 }} />
        Simulated face capture — in production, use face-api.js or AWS Rekognition with proper consent flows.
      </div>
    </div>
  );
}
