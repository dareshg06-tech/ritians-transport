"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import type { StopCrossedNotification, ArrivedAtCollegeNotification } from "@/lib/fleet/useFleetSocket";

type ToastType = "success" | "error" | "info" | "stop_crossed" | "arrived_college";

interface Toast {
  id: number;
  msg?: string;
  type: ToastType;
  data?: StopCrossedNotification | ArrivedAtCollegeNotification | { vehicleName?: string };
}

interface ToastCtx {
  show: (msg: string, type?: ToastType) => void;
  showStopCrossed: (n: StopCrossedNotification) => void;
  showArrived: (n: ArrivedAtCollegeNotification) => void;
  toasts: Toast[];
  remove: (id: number) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback((msg: string, type: ToastType = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const showStopCrossed = useCallback((n: StopCrossedNotification) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type: "stop_crossed", data: n }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const showArrived = useCallback((n: ArrivedAtCollegeNotification) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type: "arrived_college", data: n }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 8000);
  }, []);

  return (
    <Ctx.Provider value={{ show, showStopCrossed, showArrived, toasts, remove }}>
      {children}
      <div className="rt-toast-container">
        {toasts.map((t) => {
          if (t.type === "stop_crossed" && t.data) {
            const n = t.data as StopCrossedNotification;
            return (
              <div key={t.id} className="rt-toast stop-crossed" onClick={() => remove(t.id)} style={{ cursor: "pointer" }}>
                <div className="icon"><i className="fas fa-map-marker-alt" /></div>
                <div className="body">
                  <div className="title">{n.vehicleName || n.vehicleId} crossed {n.stopName}</div>
                  <div className="desc">
                    {n.nextStop ? `Next: ${n.nextStop.name} · ETA ${n.nextStop.etaMinutes} min` : "Approaching destination"}
                  </div>
                </div>
              </div>
            );
          }
          if (t.type === "arrived_college" && t.data) {
            const n = t.data as ArrivedAtCollegeNotification;
            return (
              <div key={t.id} className="rt-toast stop-crossed" onClick={() => remove(t.id)} style={{ cursor: "pointer", borderColor: "rgba(52,211,153,0.5)" }}>
                <div className="icon" style={{ background: "rgba(52,211,153,0.18)", color: "#5EEAB0" }}>
                  <i className="fas fa-school" />
                </div>
                <div className="body">
                  <div className="title">{n.vehicleName || n.vehicleId} arrived at RIT Campus</div>
                  <div className="desc">Tracking session completed — data saved.</div>
                </div>
              </div>
            );
          }
          return (
            <div key={t.id} className={`rt-toast ${t.type === "info" ? "info" : t.type === "error" ? "error" : "success"}`}>
              <i className={
                t.type === "success" ? "fas fa-circle-check" :
                t.type === "error" ? "fas fa-circle-exclamation" :
                "fas fa-circle-info"
              } />
              <span>{t.msg}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
