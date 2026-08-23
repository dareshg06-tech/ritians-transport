"use client";

import { useState } from "react";
import { useAuth } from "@/lib/ritians/auth";

export function LoginScreen() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // tiny delay so the loading state is visible (feels more real)
    setTimeout(() => {
      const r = login(identifier, password);
      if (!r.ok) setError(r.error || "Login failed");
      setLoading(false);
    }, 250);
  };

  return (
    <div className="rt-login-screen">
      <div className="rt-login-card">
        <div className="rt-login-header">
          <div className="rt-login-logo">
            <i className="fas fa-bus" />
          </div>
          <h1>Ritians <span className="accent">Transport</span></h1>
          <p>RIT Chennai — Route Management Portal</p>
        </div>

        <div className="rt-login-body">
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <span className="rt-login-badge">
              <i className="fas fa-user-graduate" /> STUDENT LOGIN
            </span>
          </div>

          <div style={{ fontFamily: "var(--font-head)", fontSize: 19, fontWeight: 700, textAlign: "center", marginBottom: 4 }}>
            Welcome back
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text3)", textAlign: "center", marginBottom: 18 }}>
            Log in to track your college bus in real-time
          </div>

          <div className="rt-login-info">
            <i className="fas fa-circle-info" />
            <span>Use the <strong style={{ color: "var(--text)" }}>Register Number</strong> and password you created during sign-up.</span>
          </div>

          <form onSubmit={onSubmit} className="rt-login-form">
            <div className="rt-form-field">
              <label>REGISTER NUMBER</label>
              <div className="rt-login-input-wrap">
                <i className="fas fa-id-card prefix" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Eg. 2022CS001"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="rt-form-field">
              <label>PASSWORD</label>
              <div className="rt-login-input-wrap">
                <i className="fas fa-lock prefix" />
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                />
                <button
                  type="button"
                  className="toggle-pwd"
                  onClick={() => setShowPwd((s) => !s)}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  <i className={showPwd ? "fas fa-eye-slash" : "fas fa-eye"} />
                </button>
              </div>
            </div>

            <button type="submit" className="rt-login-cta" disabled={loading}>
              {loading ? (
                <><i className="fas fa-circle-notch fa-spin" /> Signing in…</>
              ) : (
                <>Log In <i className="fas fa-arrow-right" /></>
              )}
            </button>

            {error && <div className="rt-login-error">{error}</div>}
          </form>
        </div>

        <div className="rt-login-footer">
          New here? <strong style={{ color: "var(--accent2)" }}>Create an account</strong>
          <br />
          <span style={{ opacity: 0.6 }}>Demo login: <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>123456</code> / <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>123456</code></span>
        </div>
      </div>
    </div>
  );
}
