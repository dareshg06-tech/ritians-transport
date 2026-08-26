// Fleet Tracker WebSocket service — port 3003
// Receives driver location updates via socket.emit("location_update", {...})
// Broadcasts to all admin clients via socket.emit("vehicle_location_updated", {...})
//
// Frontend connects via:
//   io("/?XTransformPort=3003")
//
import { createServer } from "http";
import { Server } from "socket.io";

const PORT = 3003;

const httpServer = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "fleet-tracker-ws", port: PORT }));
});

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: "/socket.io/",
});

interface VehicleLocation {
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
  // "Where is my bus" tracking
  lastCrossedStop?: { name: string; sequence: number; crossedAt: number } | null;
  nextStop?: { name: string; sequence: number; etaMinutes: number; distanceMeters: number } | null;
  progressPercent?: number; // 0..100 — distance from departure to RIT campus
}

// In-memory store of latest positions (for new admin clients to bootstrap)
const latestPositions = new Map<string, VehicleLocation>();

io.on("connection", (socket) => {
  console.log(`[ws] client connected: ${socket.id}`);

  // Send current state to new client
  socket.emit("initial_state", Array.from(latestPositions.values()));

  // Driver → server: location update
  socket.on("location_update", (data: VehicleLocation) => {
    if (!data.vehicleId || typeof data.latitude !== "number") return;
    latestPositions.set(data.vehicleId, { ...data, timestamp: data.timestamp || new Date().toISOString() });
    // Broadcast to all OTHER clients (admins)
    socket.broadcast.emit("vehicle_location_updated", {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    });
  });

  // Driver → server: stop sharing
  socket.on("stop_sharing", (data: { vehicleId: string }) => {
    if (!data.vehicleId) return;
    latestPositions.delete(data.vehicleId);
    socket.broadcast.emit("vehicle_offline", { vehicleId: data.vehicleId });
  });

  // Driver → server: stop crossed (notification event)
  socket.on("stop_crossed", (data: {
    vehicleId: string;
    vehicleName?: string;
    routeNo: string;
    stopName: string;
    sequence: number;
    crossedAt: number;
    nextStop?: { name: string; sequence: number; etaMinutes: number } | null;
  }) => {
    socket.broadcast.emit("stop_crossed_notification", data);
  });

  // Driver → server: arrived at college
  socket.on("arrived_at_college", (data: { vehicleId: string; vehicleName?: string; arrivedAt: number }) => {
    socket.broadcast.emit("arrived_at_college_notification", data);
  });

  socket.on("disconnect", () => {
    // no-op
  });
});

httpServer.listen(PORT, () => {
  console.log(`[fleet-tracker-ws] listening on :${PORT}`);
});
