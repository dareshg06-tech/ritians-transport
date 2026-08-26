"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

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

export function useFleetSocket(opts: {
  onLocationUpdate?: (u: VehicleLocationUpdate) => void;
  onInitialState?: (list: VehicleLocationUpdate[]) => void;
  onStopCrossed?: (n: StopCrossedNotification) => void;
  onArrivedAtCollege?: (n: ArrivedAtCollegeNotification) => void;
  onVehicleOffline?: (vehicleId: string) => void;
}) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const socketRef = useRef<Socket | null>(null);
  const cbRef = useRef(opts);
  useEffect(() => { cbRef.current = opts; }, [opts]);

  useEffect(() => {
    const socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));

    socket.on("initial_state", (list: VehicleLocationUpdate[]) => {
      cbRef.current.onInitialState?.(list);
    });
    socket.on("vehicle_location_updated", (u: VehicleLocationUpdate) => {
      cbRef.current.onLocationUpdate?.(u);
    });
    socket.on("stop_crossed_notification", (n: StopCrossedNotification) => {
      cbRef.current.onStopCrossed?.(n);
    });
    socket.on("arrived_at_college_notification", (n: ArrivedAtCollegeNotification) => {
      cbRef.current.onArrivedAtCollege?.(n);
    });
    socket.on("vehicle_offline", (data: { vehicleId: string }) => {
      cbRef.current.onVehicleOffline?.(data.vehicleId);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const emitLocation = (data: VehicleLocationUpdate) => {
    socketRef.current?.emit("location_update", data);
  };
  const emitStop = (data: StopCrossedNotification) => {
    socketRef.current?.emit("stop_crossed", data);
  };
  const emitArrived = (data: ArrivedAtCollegeNotification) => {
    socketRef.current?.emit("arrived_at_college", data);
  };
  const emitStopSharing = (vehicleId: string) => {
    socketRef.current?.emit("stop_sharing", { vehicleId });
  };

  return { status, emitLocation, emitStop, emitArrived, emitStopSharing };
}
