"use client";

import { useState } from "react";
import { useAuth } from "@/lib/ritians/auth";
import { useToast } from "@/lib/ritians/toast";

interface LoginModalsProps {
  which: "admin" | "driver" | null;
  onClose: () => void;
  onSuccess: (which: "admin" | "driver") => void;
}

export function LoginModals({ which, onClose, onSuccess }: LoginModalsProps) {
  if (!which) return null;

  return (
    <>
      {which === "admin" && <AdminLoginModal onClose={onClose} onSuccess={() => onSuccess("admin")} />}
      {which === "driver" && <DriverLoginModal onClose={onClose} onSuccess={() => onSuccess("driver")} />}
    </>
  );
}

function AdminLoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { unlockAdmin } = useAuth();
  const { show } = useToast();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const r = unlockAdmin(email, pass);
    if (r.ok) {
      show("Admin login successful");
      onClose();
      onSuccess();
    } else {
      setError(r.error || "Login failed");
    }
  };

  return (
    <div className="rt-modal-overlay" onClick={onClose}>
      <div className="rt-modal-box" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <button className="rt-modal-close" onClick={onClose} aria-label="Close">
          <i className="fas fa-xmark" />
        </button>
        <div className="rt-modal-header">
          <div className="rt-modal-icon-ring"><i className="fas fa-user-shield" /></div>
          <h2>Admin Login</h2>
          <p>Only authorized staff may update the official schedule.</p>
        </div>
        <div className="rt-modal-body">
          <form onSubmit={submit}>
            <div className="rt-form-field" style={{ marginBottom: 10 }}>
              <label>Email</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@college.edu"
                required
                autoFocus
              />
            </div>
            <div className="rt-form-field" style={{ marginBottom: 14 }}>
              <label>Password</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Enter admin password"
                required
              />
            </div>
            <button type="submit" className="rt-btn rt-btn-primary rt-btn-full">
              <i className="fas fa-right-to-bracket" /> Sign in as Admin
            </button>
            {error && (
              <p style={{ fontSize: 11, color: "#FCA5A5", marginTop: 10, textAlign: "center" }}>{error}</p>
            )}
            <p className="rt-muted" style={{ fontSize: 11, marginTop: 10, textAlign: "center" }}>
              Demo: <code className="rt-code">admin@college.edu</code> / <code className="rt-code">admin123</code> &nbsp;or&nbsp;
              <code className="rt-code">123456</code> / <code className="rt-code">123456</code>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function DriverLoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { unlockDriver } = useAuth();
  const { show } = useToast();
  const [id, setId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const r = unlockDriver(id, pin);
    if (r.ok) {
      show("Driver login successful");
      onClose();
      onSuccess();
    } else {
      setError(r.error || "Login failed");
    }
  };

  return (
    <div className="rt-modal-overlay" onClick={onClose}>
      <div className="rt-modal-box" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <button className="rt-modal-close" onClick={onClose} aria-label="Close">
          <i className="fas fa-xmark" />
        </button>
        <div className="rt-modal-header">
          <div className="rt-modal-icon-ring driver-ring"><i className="fas fa-id-badge" /></div>
          <h2>Driver Login</h2>
          <p>Dedicated portal to mark your parking after entering campus.</p>
        </div>
        <div className="rt-modal-body">
          <form onSubmit={submit}>
            <div className="rt-form-field" style={{ marginBottom: 10 }}>
              <label>Driver ID</label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="e.g., driver01"
                required
                autoFocus
              />
            </div>
            <div className="rt-form-field" style={{ marginBottom: 14 }}>
              <label>Secure PIN</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter driver PIN"
                required
              />
            </div>
            <button type="submit" className="rt-btn rt-btn-primary rt-btn-full">
              <i className="fas fa-truck-front" /> Sign in as Driver
            </button>
            {error && (
              <p style={{ fontSize: 11, color: "#FCA5A5", marginTop: 10, textAlign: "center" }}>{error}</p>
            )}
            <p className="rt-muted" style={{ fontSize: 11, marginTop: 10, textAlign: "center" }}>
              Demo: <code className="rt-code">driver01</code> / <code className="rt-code">driver123</code> &nbsp;or&nbsp;
              <code className="rt-code">123456</code> / <code className="rt-code">123456</code>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
