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
import { LiveTrackingModal } from "./LiveTrackingModal";
import { DriverGpsPortal } from "./DriverGpsPortal";
import { AttendanceDashboard } from "./AttendanceDashboard";
import { SOSDashboard } from "./SOSDashboard";
import { NotificationDashboard } from "./NotificationDashboard";
import { FaceRegister } from "./FaceRegister";
import { Chatbot } from "./Chatbot";
import { routes as initialRoutes, parseTime } from "@/lib/ritians/data";
import type { Route } from "@/lib/ritians/data";
import { useAuth } from "@/lib/ritians/auth";

type Tab = "student" | "admin" | "driver" | "return";
type ModalWhich = "admin" | "driver" | null;
type FullPage =
  | "tracking"      // live tracking (full page)
  | "driverGps"    // driver GPS portal (full page)
  | "faceRegister"
  | "attendance"
  | "sos"
  | "notification"
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
  const [trackingOpen, setTrackingOpen] = useState(false);
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
  if (fullPage === "driverGps") {
    return (
      <>
        <Navbar
          activeTab={tab}
          onTabClick={(t) => { setFullPage(null); setTab(t); }}
          onOpenTracking={() => setTrackingOpen(true)}
          onOpenDriverGps={() => setFullPage("driverGps")}
          viewMode={viewMode}
          onToggleView={() => setViewMode((v) => (v === "desktop" ? "mobile" : "desktop"))}
        />
        <DriverGpsPortal
          onBack={() => setFullPage(null)}
          onOpenTracking={() => { setFullPage(null); setTrackingOpen(true); }}
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
          onOpenTracking={() => setTrackingOpen(true)}
          onOpenDriverGps={() => setFullPage("driverGps")}
          viewMode={viewMode}
          onToggleView={() => setViewMode((v) => (v === "desktop" ? "mobile" : "desktop"))}
        />
        <AttendanceDashboard onBack={() => setFullPage(null)} />
        <Chatbot />
      </>
    );
  }
  if (fullPage === "sos") {
    return (
      <>
        <Navbar
          activeTab={tab}
          onTabClick={(t) => { setFullPage(null); setTab(t); }}
          onOpenTracking={() => setTrackingOpen(true)}
          onOpenDriverGps={() => setFullPage("driverGps")}
          viewMode={viewMode}
          onToggleView={() => setViewMode((v) => (v === "desktop" ? "mobile" : "desktop"))}
        />
        <SOSDashboard onBack={() => setFullPage(null)} />
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
          onOpenTracking={() => setTrackingOpen(true)}
          onOpenDriverGps={() => setFullPage("driverGps")}
          viewMode={viewMode}
          onToggleView={() => setViewMode((v) => (v === "desktop" ? "mobile" : "desktop"))}
        />
        <NotificationDashboard onBack={() => setFullPage(null)} />
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
          onOpenTracking={() => setTrackingOpen(true)}
          onOpenDriverGps={() => setFullPage("driverGps")}
          viewMode={viewMode}
          onToggleView={() => setViewMode((v) => (v === "desktop" ? "mobile" : "desktop"))}
        />
        <FaceRegister onBack={() => setFullPage(null)} />
        <Chatbot />
      </>
    );
  }

  return (
    <>
      <Navbar
        activeTab={tab}
        onTabClick={onTabClick}
        onOpenTracking={() => setTrackingOpen(true)}
        onOpenDriverGps={() => setFullPage("driverGps")}
        viewMode={viewMode}
        onToggleView={() => setViewMode((v) => (v === "desktop" ? "mobile" : "desktop"))}
      />

      <Hero
        total={stats.total}
        earliest={stats.earliest}
        latest={stats.latest}
        parkingCount={parkingCount}
        onLiveTracking={() => setTrackingOpen(true)}
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
          onOpenQuickLink={(k) =>
            setFullPage(k === "attendance" ? "attendance" : k === "sos" ? "sos" : "notification")
          }
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

      <LiveTrackingModal open={trackingOpen} onClose={() => setTrackingOpen(false)} />

      <Chatbot />
    </>
  );
}
