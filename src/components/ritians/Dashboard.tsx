"use client";

import { useCallback, useState } from "react";
import { Navbar } from "./Navbar";
import { Hero } from "./Hero";
import { StudentView, type ParkingInfo } from "./StudentView";
import { AdminView } from "./AdminView";
import { DriverView } from "./DriverView";
import { StopsModal } from "./StopsModal";
import { LoginModals } from "./LoginModals";
import { InfoModal, ComingSoonContent } from "./InfoModal";
import { routes as initialRoutes, parseTime } from "@/lib/ritians/data";
import type { Route } from "@/lib/ritians/data";
import { useAuth } from "@/lib/ritians/auth";
import { useToast } from "@/lib/ritians/toast";

type Tab = "student" | "admin" | "driver";
type ModalWhich = "admin" | "driver" | null;
type InfoModalKind = "tracking" | "driverGps" | "faceRegister" | "attendance" | "sos" | "notification" | null;

const PARKING_KEY = "ritians_driver_parking_v1";

export function Dashboard() {
  const { adminUnlocked, driverUnlocked } = useAuth();
  const { show } = useToast();

  const [tab, setTab] = useState<Tab>("student");
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
  const [modalWhich, setModalWhich] = useState<ModalWhich>(null);
  const [infoKind, setInfoKind] = useState<InfoModalKind>(null);

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
      // re-number
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

  return (
    <>
      <Navbar
        activeTab={tab}
        onTabClick={onTabClick}
        onOpenTracking={() => setInfoKind("tracking")}
        onOpenDriverGps={() => setInfoKind("driverGps")}
      />

      <Hero
        total={stats.total}
        earliest={stats.earliest}
        latest={stats.latest}
        parkingCount={parkingCount}
        onLiveTracking={() => setInfoKind("tracking")}
        onDriverLogin={() => onTabClick("driver")}
        onFaceRegister={() => setInfoKind("faceRegister")}
      />

      {tab === "student" && (
        <StudentView
          routes={routes}
          parking={parking}
          onOpenStops={(rno) => setStopsRouteNo(rno)}
        />
      )}

      {tab === "admin" && adminUnlocked && (
        <AdminView
          routes={routes}
          onAddRoute={onAddRoute}
          onUpdateRoute={onUpdateRoute}
          onDeleteRoute={onDeleteRoute}
          onBack={() => setTab("student")}
          onOpenQuickLink={(k) => setInfoKind(k)}
        />
      )}

      {tab === "driver" && driverUnlocked && (
        <DriverView
          routes={routes}
          parking={parking}
          onPublish={onPublishParking}
          onBack={() => setTab("student")}
          onOpenDriverGps={() => setInfoKind("driverGps")}
        />
      )}

      {/* Stops modal */}
      <StopsModal
        routeNo={stopsRouteNo}
        routes={routes}
        onClose={() => setStopsRouteNo(null)}
      />

      {/* Login modals (admin/driver) */}
      <LoginModals
        which={modalWhich}
        onClose={() => setModalWhich(null)}
        onSuccess={onModalSuccess}
      />

      {/* Info / coming-soon modals */}
      <InfoModal
        open={infoKind === "tracking"}
        title="Live Tracking"
        icon="fas fa-satellite-dish"
        subtitle="Real-time GPS tracking of college buses"
        onClose={() => setInfoKind(null)}
        body={<ComingSoonContent feature="Live GPS Tracking" />}
      />
      <InfoModal
        open={infoKind === "driverGps"}
        title="Driver GPS Portal"
        icon="fas fa-location-arrow"
        iconColor="#F59E0B"
        subtitle="Share your live location with students on campus"
        onClose={() => setInfoKind(null)}
        body={<ComingSoonContent feature="Driver GPS Portal" />}
      />
      <InfoModal
        open={infoKind === "faceRegister"}
        title="Face Registration"
        icon="fas fa-face-viewfinder"
        iconColor="#A78BFA"
        subtitle="Biometric attendance registration"
        onClose={() => setInfoKind(null)}
        body={<ComingSoonContent feature="Face Registration" />}
      />
      <InfoModal
        open={infoKind === "attendance"}
        title="Attendance Dashboard"
        icon="fas fa-chart-bar"
        iconColor="#22D3EE"
        subtitle="View, filter &amp; export student attendance records"
        onClose={() => setInfoKind(null)}
        body={<ComingSoonContent feature="Attendance Dashboard" />}
      />
      <InfoModal
        open={infoKind === "sos"}
        title="SOS Dashboard"
        icon="fas fa-bell"
        iconColor="#FF1F1F"
        subtitle="Monitor &amp; respond to emergency alerts in real-time"
        onClose={() => setInfoKind(null)}
        body={<ComingSoonContent feature="SOS Dashboard" />}
      />
      <InfoModal
        open={infoKind === "notification"}
        title="Notification Dashboard"
        icon="fas fa-bullhorn"
        iconColor="#FBBF24"
        subtitle="Send bus-specific alerts to students instantly"
        onClose={() => setInfoKind(null)}
        body={<ComingSoonContent feature="Notification Dashboard" />}
      />
    </>
  );
}
