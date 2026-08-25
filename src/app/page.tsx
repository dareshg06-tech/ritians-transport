"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/lib/ritians/auth";
import { ToastProvider } from "@/lib/ritians/toast";
import { Landing } from "@/components/fleet/Landing";
import { Dashboard, type Vehicle } from "@/components/fleet/Dashboard";
import { DriverPortal } from "@/components/fleet/DriverPortal";
import { VehicleDetails } from "@/components/fleet/VehicleDetails";
import { WhereIsMyBus } from "@/components/fleet/WhereIsMyBus";
import { Chatbot } from "@/components/fleet/Chatbot";
import type { Coord } from "@/lib/ritians/data";

type View =
  | { kind: "landing" }
  | { kind: "dashboard" }
  | { kind: "driver" }
  | { kind: "details"; vehicleId: string }
  | { kind: "where" };

interface LiveVehiclePos {
  coords: Coord;
  speed: number | null;
  lastCrossed?: { name: string; sequence: number } | null;
  nextStop?: { name: string; sequence: number; etaMinutes: number; distanceMeters: number } | null;
  progressPercent?: number;
}

function App() {
  const { isAuthed } = useAuth();
  const [view, setView] = useState<View>({ kind: "landing" });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [livePositions, setLivePositions] = useState<Map<string, LiveVehiclePos>>(new Map());

  // Fetch vehicles from API
  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch("/api/vehicles");
      const data = await res.json();
      setVehicles(data.vehicles || []);
    } catch {
      setVehicles([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVehicles();
    const id = setInterval(fetchVehicles, 10000);
    return () => clearInterval(id);
  }, [fetchVehicles]);

  // Listen for live updates from the dashboard (to share with Where Is My Bus view)
  const updateLivePosition = useCallback((vehicleId: string, pos: LiveVehiclePos) => {
    setLivePositions((prev) => {
      const next = new Map(prev);
      next.set(vehicleId, pos);
      return next;
    });
  }, []);

  // If not authed → show landing (we treat landing as the "logged out" view per spec)
  // but the spec also says landing should be the first page. We'll show landing
  // regardless of auth — and have buttons to navigate.
  if (view.kind === "landing") {
    return (
      <>
        <Landing
          onOpenDashboard={() => setView({ kind: "dashboard" })}
          onOpenDriver={() => setView({ kind: "driver" })}
        />
        <Chatbot />
      </>
    );
  }

  if (view.kind === "dashboard") {
    return (
      <>
        <Dashboard
          vehicles={vehicles}
          onSelectVehicleForDetails={(id) => setView({ kind: "details", vehicleId: id })}
          onOpenDriver={() => setView({ kind: "driver" })}
          onOpenWhereIsMyBus={() => setView({ kind: "where" })}
          onLiveUpdate={updateLivePosition}
        />
        <Chatbot />
      </>
    );
  }

  if (view.kind === "driver") {
    return (
      <>
        <DriverPortal vehicles={vehicles} onBack={() => setView({ kind: "dashboard" })} />
        <Chatbot />
      </>
    );
  }

  if (view.kind === "details") {
    const v = vehicles.find((x) => x.id === view.vehicleId);
    if (!v) {
      // Vehicle not found — go back to dashboard
      setView({ kind: "dashboard" });
      return null;
    }
    return (
      <>
        <VehicleDetails vehicle={v} onBack={() => setView({ kind: "dashboard" })} />
        <Chatbot />
      </>
    );
  }

  if (view.kind === "where") {
    return (
      <>
        <WhereIsMyBus
          vehicles={vehicles}
          onBack={() => setView({ kind: "dashboard" })}
          livePositions={livePositions}
        />
        <Chatbot />
      </>
    );
  }

  return null;
}

export default function Home() {
  return (
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  );
}
