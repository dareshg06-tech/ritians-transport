"use client";

import React, { createContext, useContext, useCallback, useState } from "react";

// ── Auth ────────────────────────────────────────────────────────────────────
// User explicitly requested login "123456" and password "123456".
// We accept those exact credentials (any field accepts "123456").
// Other demo credentials from the original site (admin@college.edu/admin123,
// driver01/driver123) are also still accepted for the per-role modals.

export type Role = "student" | "admin" | "driver";

export interface Session {
  role: Role;
  identifier: string; // register number / email / driver id
  displayName: string;
  loggedInAt: number;
}

interface AuthContextValue {
  session: Session | null;
  isAuthed: boolean;
  login: (identifier: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  // role-specific logins from inside the dashboard
  adminUnlocked: boolean;
  driverUnlocked: boolean;
  unlockAdmin: (email: string, password: string) => { ok: boolean; error?: string };
  unlockDriver: (id: string, pin: string) => { ok: boolean; error?: string };
  resetRoleUnlocks: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "ritians_session_v1";
const ADMIN_KEY = "ritians_admin_unlocked_v1";
const DRIVER_KEY = "ritians_driver_unlocked_v1";

// Universal credentials (per user request)
const UNIVERSAL_LOGIN = "123456";
const UNIVERSAL_PASSWORD = "123456";

// Legacy demo creds (still work)
const ADMIN_EMAIL = "admin@college.edu";
const ADMIN_PASS = "admin123";
const DRIVER_ID = "driver01";
const DRIVER_PIN = "driver123";

function deriveDisplayName(role: Role, identifier: string): string {
  if (role === "admin") return "Admin";
  if (role === "driver") return identifier || "Driver";
  // student — use first part of register number or the identifier as-is
  return identifier || "Student";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Lazy-init from localStorage — avoids the set-state-in-effect lint error
  // and also avoids a flash of unauthed state on mount.
  const [session, setSession] = useState<Session | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : null;
    } catch (_) {
      return null;
    }
  });
  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(ADMIN_KEY) === "1";
  });
  const [driverUnlocked, setDriverUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(DRIVER_KEY) === "1";
  });

  const login = useCallback((identifier: string, password: string) => {
    const id = identifier.trim();
    const pw = password.trim();
    // Universal: 123456 / 123456 — accept for student role (default)
    if (id === UNIVERSAL_LOGIN && pw === UNIVERSAL_PASSWORD) {
      const s: Session = {
        role: "student",
        identifier: id,
        displayName: "Student",
        loggedInAt: Date.now(),
      };
      setSession(s);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) {}
      return { ok: true };
    }
    // Also accept admin demo creds at the front-door login (auto-route to admin)
    if (id === ADMIN_EMAIL && pw === ADMIN_PASS) {
      const s: Session = {
        role: "admin",
        identifier: id,
        displayName: "Admin",
        loggedInAt: Date.now(),
      };
      setSession(s);
      setAdminUnlocked(true);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        localStorage.setItem(ADMIN_KEY, "1");
      } catch (_) {}
      return { ok: true };
    }
    // Driver demo creds
    if (id === DRIVER_ID && pw === DRIVER_PIN) {
      const s: Session = {
        role: "driver",
        identifier: id,
        displayName: id,
        loggedInAt: Date.now(),
      };
      setSession(s);
      setDriverUnlocked(true);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        localStorage.setItem(DRIVER_KEY, "1");
      } catch (_) {}
      return { ok: true };
    }
    return { ok: false, error: "Invalid credentials. Try 123456 / 123456." };
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    setAdminUnlocked(false);
    setDriverUnlocked(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ADMIN_KEY);
      localStorage.removeItem(DRIVER_KEY);
    } catch (_) {}
  }, []);

  const unlockAdmin = useCallback((email: string, password: string) => {
    const e = email.trim();
    const p = password.trim();
    // Universal credentials OR legacy admin creds
    if ((e === UNIVERSAL_LOGIN && p === UNIVERSAL_PASSWORD) || (e === ADMIN_EMAIL && p === ADMIN_PASS)) {
      setAdminUnlocked(true);
      try { localStorage.setItem(ADMIN_KEY, "1"); } catch (_) {}
      return { ok: true };
    }
    return { ok: false, error: "Invalid admin credentials." };
  }, []);

  const unlockDriver = useCallback((id: string, pin: string) => {
    const i = id.trim();
    const p = pin.trim();
    if ((i === UNIVERSAL_LOGIN && p === UNIVERSAL_PASSWORD) || (i === DRIVER_ID && p === DRIVER_PIN)) {
      setDriverUnlocked(true);
      try { localStorage.setItem(DRIVER_KEY, "1"); } catch (_) {}
      return { ok: true };
    }
    return { ok: false, error: "Invalid driver credentials." };
  }, []);

  const resetRoleUnlocks = useCallback(() => {
    setAdminUnlocked(false);
    setDriverUnlocked(false);
    try {
      localStorage.removeItem(ADMIN_KEY);
      localStorage.removeItem(DRIVER_KEY);
    } catch (_) {}
  }, []);

  const value: AuthContextValue = {
    session,
    isAuthed: !!session,
    login,
    logout,
    adminUnlocked,
    driverUnlocked,
    unlockAdmin,
    unlockDriver,
    resetRoleUnlocks,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
