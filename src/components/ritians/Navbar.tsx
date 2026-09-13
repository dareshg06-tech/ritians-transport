"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/ritians/auth";

export type ViewMode = "desktop" | "mobile";

interface NavbarProps {
  activeTab: "student" | "admin" | "driver" | "return";
  onTabClick: (tab: "student" | "admin" | "driver" | "return") => void;
  onOpenTracking?: () => void;
  onOpenDriverGps: () => void;
  onOpenPhysicsDebug?: () => void;
  viewMode: ViewMode;
  onToggleView: () => void;
}

export function Navbar({
  activeTab, onTabClick, onOpenTracking, onOpenDriverGps, onOpenPhysicsDebug, viewMode, onToggleView,
}: NavbarProps) {
  const { session, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [clock, setClock] = useState("--:--:--");

  useEffect(() => {
    setMounted(true);
    const tick = () => {
      const n = new Date();
      setClock(
        n.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Use mounted flag to avoid hydration mismatch — the clock and session
  // are only available on the client, so we render a placeholder on SSR.
  const avatarInitial = mounted ? (session?.displayName || "S").charAt(0).toUpperCase() : "S";
  const displayName = mounted ? (session?.displayName || "Student") : "Student";
  const clockDisplay = mounted ? clock : "--:--:--";

  return (
    <>
      <header className="rt-nav">
        <div className="rt-nav-brand">
          <div className="rt-nav-logo"><i className="fas fa-bus" /></div>
          <div>
            <div className="rt-nav-title">RITIANS TRANSPORT</div>
            <div className="rt-nav-sub">RIT Chennai — Route Management Portal</div>
          </div>
        </div>
        <div className="rt-nav-right">
          <div className="rt-tab-bar">
            <button
              className={`rt-tab-btn ${activeTab === "student" ? "active" : ""}`}
              onClick={() => onTabClick("student")}
            >
              <i className="fas fa-user-graduate" /><span>Student</span>
            </button>
            <button
              className={`rt-tab-btn ${activeTab === "return" ? "active" : ""}`}
              onClick={() => onTabClick("return")}
              style={activeTab === "return" ? { background: "linear-gradient(135deg, var(--purple), #7C3AED)", boxShadow: "0 4px 18px rgba(167,139,250,0.32)" } : {}}
            >
              <i className="fas fa-arrow-right-from-bracket" /><span>Return Trip</span>
            </button>
            <button
              className={`rt-tab-btn ${activeTab === "admin" ? "active" : ""}`}
              onClick={() => onTabClick("admin")}
            >
              <i className="fas fa-user-shield" /><span>Admin</span>
            </button>
            <button
              className={`rt-tab-btn ${activeTab === "driver" ? "active" : ""}`}
              onClick={() => onTabClick("driver")}
            >
              <i className="fas fa-id-card" /><span>Driver</span>
            </button>
            {onOpenTracking && (
              <button className="rt-tab-btn" onClick={onOpenTracking} title="Live Tracking — see active buses">
                <i className="fas fa-satellite-dish" /><span>Live Tracking</span>
              </button>
            )}
            <button className="rt-tab-btn driver-ext" onClick={onOpenDriverGps} title="Open Driver GPS Portal — Live Tracking">
              <i className="fas fa-location-arrow" /><span>Driver GPS</span>
            </button>
            {onOpenPhysicsDebug && (
              <button className="rt-tab-btn driver-ext" onClick={onOpenPhysicsDebug} title="Physics Engine Debug Panel">
                <i className="fas fa-microchip" /><span>Physics Debug</span>
              </button>
            )}
          </div>
          <div className="rt-clock">{clockDisplay}</div>
          <div className="rt-auth-chip">
            <div className="avatar">{avatarInitial}</div>
            <span>{displayName}</span>
            <button onClick={logout} title="Logout" aria-label="Logout">
              <i className="fas fa-right-from-bracket" />
            </button>
          </div>
        </div>
      </header>

      {/* Floating view-mode badge — fixed bottom-left of the viewport.
          Rendered OUTSIDE <header> so its `position: fixed` is relative
          to the viewport, not the sticky header's containing block. */}
      <div className="rt-view-mode-badge" onClick={onToggleView} title="Toggle desktop / mobile view">
        <i className={viewMode === "mobile" ? "fas fa-mobile-screen" : "fas fa-desktop"} />
        View: {viewMode === "mobile" ? "Mobile" : "Desktop"}
        <span className="switch-btn">Switch View</span>
      </div>
    </>
  );
}
