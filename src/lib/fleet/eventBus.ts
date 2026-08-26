// In-memory event bus — shared across all route handlers in the same Node.js process.
// This bypasses the need for a separate WebSocket service.
// Drivers POST to /api/locations → bus publishes "location_update" → admin SSE clients receive it.

export type FleetEvent =
  | { type: "vehicle_location_updated"; data: VehicleLocationUpdate }
  | { type: "stop_crossed_notification"; data: StopCrossedNotification }
  | { type: "arrived_at_college_notification"; data: ArrivedAtCollegeNotification }
  | { type: "vehicle_offline"; data: { vehicleId: string } };

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

type Subscriber = (event: FleetEvent) => void;

class FleetEventBus {
  private subscribers = new Set<Subscriber>();
  private latestPositions = new Map<string, VehicleLocationUpdate>();

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  publish(event: FleetEvent) {
    if (event.type === "vehicle_location_updated") {
      this.latestPositions.set(event.data.vehicleId, event.data);
    } else if (event.type === "vehicle_offline") {
      this.latestPositions.delete(event.data.vehicleId);
    }
    // Notify all subscribers (synchronously — SSE streams will pick it up)
    for (const sub of this.subscribers) {
      try {
        sub(event);
      } catch (_) {
        // ignore
      }
    }
  }

  getLatestPositions(): VehicleLocationUpdate[] {
    return Array.from(this.latestPositions.values());
  }
}

// Singleton — survives across hot reloads in dev
const globalForBus = globalThis as unknown as { __fleetEventBus?: FleetEventBus };
export const fleetBus = globalForBus.__fleetEventBus ?? new FleetEventBus();
if (process.env.NODE_ENV !== "production") globalForBus.__fleetEventBus = fleetBus;
