"use client";

import { useState } from "react";
import { useAuth } from "@/lib/ritians/auth";

export function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");

  // Login state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Registration state
  const [regNumber, setRegNumber] = useState("");
  const [regName, setRegName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [showRegPwd, setShowRegPwd] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setTimeout(() => {
      const r = login(identifier, password);
      if (!r.ok) setError(r.error || "Login failed");
      setLoading(false);
    }, 250);
  };

  const onRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (regPassword !== regConfirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const r = register(regNumber, regPassword, regName);
      if (!r.ok) setError(r.error || "Registration failed");
      setLoading(false);
    }, 250);
  };

  const switchMode = (m: "login" | "register") => {
    setMode(m);
    setError(null);
    setIdentifier("");
    setPassword("");
    setRegNumber("");
    setRegName("");
    setRegPassword("");
    setRegConfirm("");
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

        {mode === "login" ? (
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
        ) : (
          <div className="rt-login-body">
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <span className="rt-login-badge" style={{ background: "rgba(167,139,250,0.12)", borderColor: "rgba(167,139,250,0.3)", color: "#D8CCFF" }}>
                <i className="fas fa-user-plus" /> CREATE ACCOUNT
              </span>
            </div>

            <div style={{ fontFamily: "var(--font-head)", fontSize: 19, fontWeight: 700, textAlign: "center", marginBottom: 4 }}>
              Create your account
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text3)", textAlign: "center", marginBottom: 18 }}>
              Sign up to track your college bus in real-time
            </div>

            <div className="rt-login-info">
              <i className="fas fa-circle-info" />
              <span>Choose a <strong style={{ color: "var(--text)" }}>Register Number</strong> and password — you'll use them to log in next time.</span>
            </div>

            <form onSubmit={onRegister} className="rt-login-form">
              <div className="rt-form-field">
                <label>FULL NAME</label>
                <div className="rt-login-input-wrap">
                  <i className="fas fa-user prefix" />
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Eg. Karthik Raja"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="rt-form-field">
                <label>REGISTER NUMBER</label>
                <div className="rt-login-input-wrap">
                  <i className="fas fa-id-card prefix" />
                  <input
                    type="text"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    placeholder="Eg. 2022CS001"
                    required
                  />
                </div>
              </div>

              <div className="rt-form-field">
                <label>PASSWORD</label>
                <div className="rt-login-input-wrap">
                  <i className="fas fa-lock prefix" />
                  <input
                    type={showRegPwd ? "text" : "password"}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="At least 4 characters"
                    required
                    minLength={4}
                  />
                  <button
                    type="button"
                    className="toggle-pwd"
                    onClick={() => setShowRegPwd((s) => !s)}
                    aria-label={showRegPwd ? "Hide password" : "Show password"}
                  >
                    <i className={showRegPwd ? "fas fa-eye-slash" : "fas fa-eye"} />
                  </button>
                </div>
              </div>

              <div className="rt-form-field">
                <label>CONFIRM PASSWORD</label>
                <div className="rt-login-input-wrap">
                  <i className="fas fa-lock prefix" />
                  <input
                    type={showRegPwd ? "text" : "password"}
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    minLength={4}
                  />
                </div>
              </div>

              <button type="submit" className="rt-login-cta" style={{ background: "linear-gradient(135deg, #A78BFA, #7C3AED)", color: "#fff", boxShadow: "0 10px 28px rgba(167,139,250,0.32), 0 0 0 1px rgba(255,255,255,0.16) inset" }} disabled={loading}>
                {loading ? (
                  <><i className="fas fa-circle-notch fa-spin" /> Creating account…</>
                ) : (
                  <><i className="fas fa-user-plus" /> Create Account <i className="fas fa-arrow-right" /></>
                )}
              </button>

              {error && <div className="rt-login-error">{error}</div>}
            </form>
          </div>
        )}

        <div className="rt-login-footer">
          {mode === "login" ? (
            <>
              New here?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                style={{ background: "none", border: "none", color: "var(--accent2)", cursor: "pointer", fontWeight: 600, fontSize: 12, padding: 0 }}
              >
                Create an account
              </button>
              <br />
              <span style={{ opacity: 0.6 }}>Demo login: <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>123456</code> / <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>123456</code></span>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                style={{ background: "none", border: "none", color: "var(--accent2)", cursor: "pointer", fontWeight: 600, fontSize: 12, padding: 0 }}
              >
                Log in
              </button>
              <br />
              <span style={{ opacity: 0.6 }}>Demo login: <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>123456</code> / <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>123456</code></span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
