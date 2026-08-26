"use client";

import { useMemo, useState } from "react";
import { useAuth, type StudentProfile } from "@/lib/ritians/auth";
import { routes, routeStops } from "@/lib/ritians/data";

const DEPARTMENTS = [
  "Computer Science (CSE)",
  "Information Technology (IT)",
  "Electronics & Communication (ECE)",
  "Mechanical Engineering (MECH)",
  "Electrical & Electronics (EEE)",
  "Civil Engineering (CIVIL)",
  "Artificial Intelligence & Data Science (AI&DS)",
  "Biomedical Engineering (BME)",
];

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

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
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [section, setSection] = useState("");
  const [routeNo, setRouteNo] = useState("");
  const [boardingPoint, setBoardingPoint] = useState("");

  // Available boarding points for the selected route
  const availableBoardingPoints = useMemo(() => {
    if (!routeNo) return [];
    return (routeStops[routeNo] || []).map((s) => s.stop);
  }, [routeNo]);

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
    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (phone && !/^\d{10}$/.test(phone.replace(/\D/g, ""))) {
      setError("Phone number must be 10 digits.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const profile: StudentProfile = {
        fullName,
        phone,
        registerNumber: regNumber,
        department,
        year,
        section,
        routeNo,
        boardingPoint,
      };
      const r = register(profile, regPassword);
      if (!r.ok) setError(r.error || "Registration failed");
      setLoading(false);
    }, 250);
  };

  const switchMode = (m: "login" | "register") => {
    setMode(m);
    setError(null);
    setIdentifier("");
    setPassword("");
    setFullName("");
    setPhone("");
    setRegNumber("");
    setRegPassword("");
    setDepartment("");
    setYear("");
    setSection("");
    setRouteNo("");
    setBoardingPoint("");
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
          <div className="rt-login-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
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

            <form onSubmit={onRegister}>
              {/* PERSONAL section */}
              <div className="rt-reg-section">
                <div className="rt-reg-section-title">
                  <i className="fas fa-user" /> PERSONAL
                </div>
                <div className="rt-reg-field">
                  <label>FULL NAME</label>
                  <div className="rt-reg-input-wrap">
                    <i className="fas fa-user prefix" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Arun Kumar"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div className="rt-reg-field">
                  <label>PHONE NUMBER</label>
                  <div className="rt-reg-input-wrap">
                    <i className="fas fa-phone prefix" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      required
                    />
                  </div>
                </div>
                <div className="rt-reg-row">
                  <div className="rt-reg-field">
                    <label>REGISTER NO.</label>
                    <div className="rt-reg-input-wrap">
                      <i className="fas fa-id-card prefix" />
                      <input
                        type="text"
                        value={regNumber}
                        onChange={(e) => setRegNumber(e.target.value)}
                        placeholder="E.G. 2022CS001"
                        required
                      />
                    </div>
                  </div>
                  <div className="rt-reg-field">
                    <label>PASSWORD</label>
                    <div className="rt-reg-input-wrap">
                      <i className="fas fa-lock prefix" />
                      <input
                        type={showRegPwd ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        required
                        minLength={6}
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
                </div>
              </div>

              {/* ACADEMIC section */}
              <div className="rt-reg-section">
                <div className="rt-reg-section-title">
                  <i className="fas fa-graduation-cap" /> ACADEMIC
                </div>
                <div className="rt-reg-row">
                  <div className="rt-reg-field">
                    <label>DEPARTMENT</label>
                    <div className="rt-reg-input-wrap">
                      <i className="fas fa-building prefix" />
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        required
                      >
                        <option value="">Select dept.</option>
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <i className="fas fa-chevron-down suffix" />
                    </div>
                  </div>
                  <div className="rt-reg-field">
                    <label>YEAR</label>
                    <div className="rt-reg-input-wrap">
                      <i className="fas fa-layer-group prefix" />
                      <select
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        required
                      >
                        <option value="">Select year</option>
                        {YEARS.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                      <i className="fas fa-chevron-down suffix" />
                    </div>
                  </div>
                </div>
                <div className="rt-reg-field">
                  <label>CLASS / SECTION</label>
                  <div className="rt-reg-input-wrap">
                    <i className="fas fa-chalkboard prefix" />
                    <input
                      type="text"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      placeholder="e.g. CSE-A"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* TRANSPORT section */}
              <div className="rt-reg-section">
                <div className="rt-reg-section-title">
                  <i className="fas fa-bus" /> TRANSPORT
                </div>
                <div className="rt-reg-field">
                  <label>ROUTE / BUS</label>
                  <div className="rt-reg-input-wrap">
                    <i className="fas fa-bus prefix" />
                    <select
                      value={routeNo}
                      onChange={(e) => {
                        setRouteNo(e.target.value);
                        setBoardingPoint("");
                      }}
                      required
                    >
                      <option value="">Select your route...</option>
                      {routes.map((r) => (
                        <option key={r.routeNo} value={r.routeNo}>
                          {r.routeNo} · {r.routeName} (Bus {r.no})
                        </option>
                      ))}
                    </select>
                    <i className="fas fa-chevron-down suffix" />
                  </div>
                </div>
                <div className="rt-reg-field">
                  <label>BOARDING POINT</label>
                  <div className="rt-reg-input-wrap">
                    <i className="fas fa-map-marker-alt prefix" />
                    <select
                      value={boardingPoint}
                      onChange={(e) => setBoardingPoint(e.target.value)}
                      disabled={!routeNo}
                      required
                    >
                      <option value="">
                        {routeNo ? "Select your boarding point..." : "Select a route first"}
                      </option>
                      {availableBoardingPoints.map((stop, i) => (
                        <option key={i} value={stop}>{stop}</option>
                      ))}
                    </select>
                    <i className="fas fa-chevron-down suffix" />
                  </div>
                </div>
              </div>

              <button type="submit" className="rt-reg-cta" disabled={loading}>
                {loading ? (
                  <><i className="fas fa-circle-notch fa-spin" /> Creating account…</>
                ) : (
                  <>Create Account <i className="fas fa-arrow-right" /></>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
