"use client";

import { useCallback, useEffect, useState } from "react";
import { Navbar, type ViewMode } from "./Navbar";
import { Hero } from "./Hero";
import { StudentView, type ParkingInfo } from "./StudentView";
import { AdminView } from "./AdminView";
import { DriverView } from "./DriverView";
import { ReturnTripView } from "./ReturnTripView";
import { StopsModal } from "./StopsModal";
import { LoginModals } from "./LoginModals";
import { LiveTrackingPage } from "./LiveTrackingPage";
import { DriverGpsPortal } from "./DriverGpsPortal";
import { AttendanceDashboard } from "./AttendanceDashboard";
import { NotificationDashboard } from "./NotificationDashboard";
import { FeedbackDashboard } from "./FeedbackDashboard";
import { FaceRegister } from "./FaceRegister";
import { Chatbot } from "./Chatbot";
import { AdminDebugPanel } from "../fleet/AdminDebugPanel";
import { routes as initialRoutes, parseTime } from "@/lib/ritians/data";
import type { Route } from "@/lib/ritians/data";
import { useAuth } from "@/lib/ritians/auth";

type Tab = "student" | "admin" | "driver" | "return";
type ModalWhich = "admin" | "driver" | null;
type FullPage =
  | "tracking"
  | "driverGps"
  | "faceRegister"
  | "attendance"
  | "notification"
  | "feedback"
  | "physicsDebug"
  | null;

const PARKING_KEY = "ritians_driver_parking_v1";

export function Dashboard() {
  const { adminUnlocked, driverUnlocked } = useAuth();

  const [tab, setTab] = useState<Tab>("student");
  const [viewMode, setViewMode] = useState<ViewMode>("desktop");
  const [routes, setRoutes] = useState<Route[]>(initialRoutes);
  const [parking, setParking] = useState<Record<string, ParkingInfo>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const s = localStorage.getItem(PARKING_KEY);
      return s ? JSON.parse(s) : {};
    } catch (_) {
      return {};
    }
  });
  const [stopsRouteNo, setStopsRouteNo] = useState<string | null>(null);
  const [stopsTrip, setStopsTrip] = useState<"morning" | "afternoon">("morning");
  const [modalWhich, setModalWhich] = useState<ModalWhich>(null);
  const [fullPage, setFullPage] = useState<FullPage>(null);

  // Apply mobile view class to body
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (viewMode === "mobile") {
      document.body.classList.add("rt-force-mobile");
    } else {
      document.body.classList.remove("rt-force-mobile");
    }
  }, [viewMode]);

  const persistParking = useCallback((p: Record<string, ParkingInfo>) => {
    setParking(p);
    try { localStorage.setItem(PARKING_KEY, JSON.stringify(p)); } catch (_) {}
  }, []);

  const onTabClick = (t: Tab) => {
    if (t === "admin" && !adminUnlocked) {
      setModalWhich("admin");
      return;
    }
    if (t === "driver" && !driverUnlocked) {
      setModalWhich("driver");
      return;
    }
    setTab(t);
    setFullPage(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onModalSuccess = (which: "admin" | "driver") => {
    setModalWhich(null);
    setTab(which);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onAddRoute = (r: Route) => setRoutes((rs) => [...rs, r]);
  const onUpdateRoute = (idx: number, r: Route) =>
    setRoutes((rs) => rs.map((x, i) => (i === idx ? r : x)));
  const onDeleteRoute = (idx: number) =>
    setRoutes((rs) => {
      const next = [...rs];
      next.splice(idx, 1);
      return next.map((r, i) => ({ ...r, no: i + 1 }));
    });

  const onPublishParking = (routeNo: string, info: ParkingInfo) => {
    persistParking({ ...parking, [routeNo]: info });
  };

  const stats = (() => {
    if (!routes.length) return { total: 0, earliest: "–", latest: "–" };
    const sorted = [...routes].sort((a, b) => parseTime(a.start) - parseTime(b.start));
    return {
      total: routes.length,
      earliest: sorted[0].start,
      latest: sorted[sorted.length - 1].start,
    };
  })();

  const parkingCount = Object.values(parking).filter((p) => {
    const d = new Date(p.updatedAt);
    const n = new Date();
    return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  const openStops = (routeNo: string, trip: "morning" | "afternoon" = "morning") => {
    setStopsRouteNo(routeNo);
    setStopsTrip(trip);
  };

  // Render full-page views if active
  if (fullPage === "tracking") {
    return (
      <>
        <LiveTrackingPage onBack={() => setFullPage(null)} />
        <Chatbot />
      </>
    );
  }
  if (fullPage === "driverGps") {
    return (
      <>
        <Navbar
          activeTab={tab}
          onTabClick={(t) => { setFullPage(null); setTab(t); }}
          onOpenDriverGps={() => setFullPage("driverGps")}
          viewMode={viewMode}
          onToggleView={() => setViewMode((v) => (v === "desktop" ? "mobile" : "desktop"))}
        />
        <DriverGpsPortal
          onBack={() => setFullPage(null)}
        />
        <Chatbot />
      </>
    );
  }
  if (fullPage === "attendance") {
    return (
      <>
        <Navbar
          activeTab={tab}
          onTabClick={(t) => { setFullPage(null); setTab(t); }}
          onOpenDriverGps={() => setFullPage("driverGps")}
          viewMode={viewMode}
          onToggleView={() => setViewMode((v) => (v === "desktop" ? "mobile" : "desktop"))}
        />
        <AttendanceDashboard onBack={() => setFullPage(null)} />
        <Chatbot />
      </>
    );
  }
  if (fullPage === "notification") {
    return (
      <>
        <Navbar
          activeTab={tab}
          onTabClick={(t) => { setFullPage(null); setTab(t); }}
          onOpenDriverGps={() => setFullPage("driverGps")}
          viewMode={viewMode}
          onToggleView={() => setViewMode((v) => (v === "desktop" ? "mobile" : "desktop"))}
        />
        <NotificationDashboard onBack={() => setFullPage(null)} />
        <Chatbot />
      </>
    );
  }
  if (fullPage === "feedback") {
    return (
      <>
        <Navbar
          activeTab={tab}
          onTabClick={(t) => { setFullPage(null); setTab(t); }}
          onOpenDriverGps={() => setFullPage("driverGps")}
          viewMode={viewMode}
          onToggleView={() => setViewMode((v) => (v === "desktop" ? "mobile" : "desktop"))}
        />
        <FeedbackDashboard onBack={() => setFullPage(null)} />
        <Chatbot />
      </>
    );
  }
  if (fullPage === "faceRegister") {
    return (
      <>
        <Navbar
          activeTab={tab}
          onTabClick={(t) => { setFullPage(null); setTab(t); }}
          onOpenDriverGps={() => setFullPage("driverGps")}
          viewMode={viewMode}
          onToggleView={() => setViewMode((v) => (v === "desktop" ? "mobile" : "desktop"))}
        />
        <FaceRegister onBack={() => setFullPage(null)} />
        <Chatbot />
      </>
    );
  }
  if (fullPage === "physicsDebug") {
    return (
      <>
        <AdminDebugPanel onBack={() => setFullPage(null)} />
        <Chatbot />
      </>
    );
  }

  return (
    <>
      <Navbar
        activeTab={tab}
        onTabClick={onTabClick}
        onOpenTracking={() => setFullPage("tracking")}
        onOpenDriverGps={() => setFullPage("driverGps")}
        onOpenPhysicsDebug={() => setFullPage("physicsDebug")}
        viewMode={viewMode}
        onToggleView={() => setViewMode((v) => (v === "desktop" ? "mobile" : "desktop"))}
      />

      <Hero
        total={stats.total}
        earliest={stats.earliest}
        latest={stats.latest}
        parkingCount={parkingCount}
        onLiveTracking={() => setFullPage("tracking")}
        onDriverLogin={() => onTabClick("driver")}
        onFaceRegister={() => setFullPage("faceRegister")}
      />

      {tab === "student" && (
        <StudentView
          routes={routes}
          parking={parking}
          onOpenStops={(rno) => openStops(rno, "morning")}
        />
      )}

      {tab === "return" && (
        <ReturnTripView onOpenRoute={(rno) => openStops(rno, "afternoon")} />
      )}

      {tab === "admin" && adminUnlocked && (
        <AdminView
          routes={routes}
          onAddRoute={onAddRoute}
          onUpdateRoute={onUpdateRoute}
          onDeleteRoute={onDeleteRoute}
          onBack={() => setTab("student")}
          onOpenQuickLink={(k) => {
            if (k === "attendance") setFullPage("attendance");
            else if (k === "notification") setFullPage("notification");
            else if (k === "feedback") setFullPage("feedback");
          }}
        />
      )}

      {tab === "driver" && driverUnlocked && (
        <DriverView
          routes={routes}
          parking={parking}
          onPublish={onPublishParking}
          onBack={() => setTab("student")}
          onOpenDriverGps={() => setFullPage("driverGps")}
        />
      )}

      <StopsModal
        routeNo={stopsRouteNo}
        routes={routes}
        onClose={() => setStopsRouteNo(null)}
        initialTrip={stopsTrip}
      />

      <LoginModals
        which={modalWhich}
        onClose={() => setModalWhich(null)}
        onSuccess={onModalSuccess}
      />

      <Chatbot />
    </>
  );
}
