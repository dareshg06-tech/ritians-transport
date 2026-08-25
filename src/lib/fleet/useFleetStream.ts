"use client";

import { useEffect, useRef, useState } from "react";

export interface VehicleLocationUpdate {
  vehicleId: string;
  vehicleNumber?: string;
  vehicleName?: string;
  routeNo?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  isSimulated?: boolean;
  timestamp?: string;
  lastCrossedStop?: { name: string; sequence: number; crossedAt: number } | null;
  nextStop?: { name: string; sequence: number; etaMinutes: number; distanceMeters: number } | null;
  progressPercent?: number;
}

export interface StopCrossedNotification {
  vehicleId: string;
  vehicleName?: string;
  routeNo: string;
  stopName: string;
  sequence: number;
  crossedAt: number;
  nextStop?: { name: string; sequence: number; etaMinutes: number } | null;
}

export interface ArrivedAtCollegeNotification {
  vehicleId: string;
  vehicleName?: string;
  arrivedAt: number;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface FleetEvent {
  type: "vehicle_location_updated" | "stop_crossed_notification" | "arrived_at_college_notification" | "vehicle_offline" | "initial_state";
  data: unknown;
}

export function useFleetStream(opts: {
  onLocationUpdate?: (u: VehicleLocationUpdate) => void;
  onInitialState?: (list: VehicleLocationUpdate[]) => void;
  onStopCrossed?: (n: StopCrossedNotification) => void;
  onArrivedAtCollege?: (n: ArrivedAtCollegeNotification) => void;
  onVehicleOffline?: (vehicleId: string) => void;
}) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const cbRef = useRef(opts);
  useEffect(() => { cbRef.current = opts; }, [opts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("connecting");
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      es = new EventSource("/api/live");

      es.onopen = () => setStatus("connected");

      es.onmessage = (e) => {
        try {
          const event: FleetEvent = JSON.parse(e.data);
          if (event.type === "initial_state") {
            cbRef.current.onInitialState?.(event.data as VehicleLocationUpdate[]);
          } else if (event.type === "vehicle_location_updated") {
            cbRef.current.onLocationUpdate?.(event.data as VehicleLocationUpdate);
          } else if (event.type === "stop_crossed_notification") {
            cbRef.current.onStopCrossed?.(event.data as StopCrossedNotification);
          } else if (event.type === "arrived_at_college_notification") {
            cbRef.current.onArrivedAtCollege?.(event.data as ArrivedAtCollegeNotification);
          } else if (event.type === "vehicle_offline") {
            cbRef.current.onVehicleOffline?.((event.data as { vehicleId: string }).vehicleId);
          }
        } catch (_) {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        setStatus("disconnected");
        es?.close();
        // Reconnect after 3s
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return { status };
}
