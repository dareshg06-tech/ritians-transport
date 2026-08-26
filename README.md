# Elite Fleet Tracking — Ritians Transport

A production-quality real-time vehicle tracking platform for the RIT Chennai bus fleet. Built with Next.js 16, Prisma (SQLite), Leaflet maps, Socket.IO WebSockets, and the z-ai-web-dev-sdk for the AI chatbot.

## Features

### Admin / Dispatcher Dashboard (`/`)
- Premium dark navy glassmorphism UI
- Left sidebar with 10 vehicles (Bus One through Bus Ten)
- Search vehicles, filter by status (All / Live / Tracking / Idle / Offline)
- Live stats: Total / Live / Tracking / Idle / Offline counts
- DEMO toggle for simulated GPS
- Interactive Leaflet map with:
  - Dark tile theme
  - Bus markers colored by status (green=live, cyan=tracking, yellow=idle, gray=offline)
  - Route polyline + boarding-stop markers when vehicle selected
  - Smooth marker movement + popup with vehicle details
- Click vehicle card → map centers + opens popup
- Toast notifications when a bus crosses a boarding stop

### Driver GPS Portal (`Driver Portal` button)
- Centered card with cyan location icon hero
- Vehicle selector dropdown
- "Start Sharing Location" green button (real `navigator.geolocation.watchPosition()`)
- "Stop Sharing Location" red button when active
- Live GPS telemetry card:
  - Latitude / Longitude
  - Accuracy (meters)
  - Speed (km/h)
  - Heading (degrees)
  - Altitude (meters)
  - Last update time
  - Update frequency (every 2-5s)
- Progress bar with last crossed stop + ETA to next stop
- WebSocket connection status indicator
- Graceful error handling for permission denied / unavailable / timeout
- Stop-crossing detection: when bus is within 150m of a stop, timestamp is recorded and broadcast
- College arrival detection: when bus is within 200m of RIT Campus, tracking session auto-resets

### Where Is My Bus (`Where Is My Bus?` button)
- "Where Is My Train"-style live view
- Vehicle selector
- Progress banner showing:
  - % complete
  - Last crossed stop
  - Next stop + ETA (e.g. "Next: Kalmandapam · ETA 5 min")
  - Current speed
- Stop list showing each boarding point:
  - Sequence number
  - Stop name + scheduled time + coordinates
  - Status badge (✓ Crossed / ETA X min / Pending)
  - Actual crossing timestamp if crossed
- "Bus crossed Kasimedu" notification card

### Vehicle Details (`View Details & History` button)
- Map showing the vehicle's full route + crossed stops
- Tracking summary: distance travelled, duration, max/avg speed, GPS points, stops crossed
- Start/end timestamps
- Date/time filter (from/to)
- Stop crossings list with timestamps
- Route polyline + stop markers (cyan = upcoming, green = crossed, orange = RIT Campus)

### AI Chatbot (floating bottom-right)
- "Ritians Fleet Assistant" powered by z-ai-web-dev-sdk
- Context-aware: includes live fleet state (all 10 vehicles' positions, speeds, last crossed stops) in every prompt
- Suggestion chips: "Where is Bus Five now?", "Which bus has crossed Kasimedu?", "How long until R01 reaches campus?", "Show me all live buses"
- Real responses from the LLM, not canned

### Afternoon Departure (3.40 pm)
- All buses depart RIT Campus at 3.40 pm and follow their morning route in reverse
- Stop crossing timestamps are saved for both morning (to campus) and afternoon (from campus) trips

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend (Next.js 16, React 19, TypeScript)        │
│  - src/app/page.tsx (single SPA with view state)  │
│  - src/components/fleet/* (Landing, Dashboard,     │
│    DriverPortal, VehicleDetails, WhereIsMyBus,      │
│    Chatbot, FleetMap)                               │
│  - src/lib/fleet/* (socket hook, demo simulator)   │
│  - src/lib/ritians/* (data, auth, toast, geo,      │
│    fleet mapping)                                   │
└─────────────────────┬───────────────────────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
┌───────▼────────┐          ┌─────────▼─────────┐
│ REST API        │          │ WebSocket         │
│ (Next.js Route  │          │ (mini-service     │
│  Handlers)      │          │  on port 3003)    │
│                 │          │                   │
│ /api/vehicles   │          │ location_update   │
│ /api/locations  │          │ stop_crossed       │
│ /api/tracking/* │          │ arrived_at_college │
│ /api/health     │          │ vehicle_offline    │
│ /api/stop-*     │          │                   │
│ /api/chat       │          │ Frontend connects  │
│                 │          │ via /?XTransform   │
│ Prisma + SQLite │          │ Port=3003          │
└─────────────────┘          └───────────────────┘
```

## REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/vehicles` | GET | List all vehicles |
| `/api/vehicles` | POST | Create vehicle |
| `/api/vehicles/:id` | GET / PUT / DELETE | CRUD on single vehicle |
| `/api/vehicles/:id/location` | GET | Latest location |
| `/api/vehicles/:id/history` | GET | Location history (with `from`/`to` query) |
| `/api/locations` | POST | Record a new location |
| `/api/tracking/start` | POST | Start tracking session |
| `/api/tracking/stop` | POST | Stop tracking session |
| `/api/tracking/status/:vehicleId` | GET | Tracking session status |
| `/api/stop-crossings` | POST | Record stop crossing |
| `/api/stop-crossings/:vehicleId` | GET | Today's stop crossings |
| `/api/stops/:routeNo` | GET | Stop crossings for a route |
| `/api/health` | GET | System health + stats |
| `/api/chat` | POST | AI chatbot (z-ai-web-dev-sdk) |

## Database Schema (Prisma + SQLite)

```prisma
model Vehicle {
  id, vehicleNumber, vehicleName, vehicleType, driverName, routeNo, status,
  lastLat, lastLng, lastSpeed, lastHeading, lastAccuracy, lastAltitude, lastSeenAt,
  createdAt, updatedAt
  → locations, sessions, stopCrossings
}

model VehicleLocation {
  id, vehicleId, latitude, longitude, accuracy, speed, heading, altitude,
  isSimulated, recordedAt
}

model TrackingSession {
  id, vehicleId, startedAt, stoppedAt, status (active | stopped)
}

model StopCrossing {
  id, vehicleId, routeNo, stopName, stopLat, stopLng, crossedAt, sequence
}
```

## Setup

### 1. Install dependencies
```bash
bun install
cd mini-services/fleet-tracker && bun install
```

### 2. Set up the database
```bash
bun run db:push      # create SQLite schema
bun run scripts/seed.ts  # seed 10 buses + admin/driver users
```

### 3. Start the WebSocket service
```bash
cd mini-services/fleet-tracker
bun --hot index.ts &
# runs on port 3003
```

### 4. Start the Next.js dev server
```bash
bun run dev
# runs on port 3000
```

Open http://localhost:3000 to see the landing page.

## Demo Mode

By default, the dashboard runs in DEMO mode — 10 buses move along their routes at ~35 km/h, broadcasting simulated GPS positions every 2 seconds. When a bus crosses a boarding stop (within 150m), a toast notification appears on the admin dashboard and a `StopCrossing` record is saved to the database. When the bus reaches RIT Campus, the tracking session auto-resets for the next trip.

To turn off demo mode: click the "DEMO ON" pill in the top-right header.

To use real GPS: open the Driver GPS Portal, select a vehicle, and click "Start Sharing Location". The browser will prompt for location permission and use real `navigator.geolocation.watchPosition()`.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4
- **Maps**: Leaflet 1.9 + OpenStreetMap tiles (dark theme via CSS filter)
- **Realtime**: Socket.IO 4.8 (mini-service on port 3003)
- **Database**: Prisma 6 + SQLite (file-based, zero-config)
- **AI**: z-ai-web-dev-sdk (GLM model via /api/chat route)
- **Icons**: Font Awesome 6.5
- **Fonts**: Space Grotesk (headings), Inter (body), JetBrains Mono (coordinates/times)

## Demo Credentials

- Universal login: `123456 / 123456` (works for any role)
- Admin: `admin@ritians.edu / 123456`
- Driver: `driver@bus-001.local / 123456` (etc.)

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── vehicles/route.ts
│   │   ├── vehicles/[id]/route.ts
│   │   ├── vehicles/[id]/location/route.ts
│   │   ├── vehicles/[id]/history/route.ts
│   │   ├── locations/route.ts
│   │   ├── tracking/start/route.ts
│   │   ├── tracking/stop/route.ts
│   │   ├── tracking/status/[vehicleId]/route.ts
│   │   ├── stop-crossings/route.ts
│   │   ├── stop-crossings/[vehicleId]/route.ts
│   │   ├── stops/[routeNo]/route.ts
│   │   ├── health/route.ts
│   │   └── chat/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── fleet/
│       ├── FleetMap.client.tsx     (Leaflet map, client-only)
│       ├── Dashboard.tsx
│       ├── DriverPortal.tsx
│       ├── VehicleDetails.tsx
│       ├── WhereIsMyBus.tsx
│       ├── Chatbot.tsx
│       └── Landing.tsx
├── lib/
│   ├── db.ts                        (Prisma client)
│   ├── fleet/
│   │   ├── useFleetSocket.ts        (Socket.IO client hook)
│   │   └── demoSimulator.ts         (fake GPS for non-driver-tracked vehicles)
│   └── ritians/
│       ├── data.ts                  (51 routes + stops + coords)
│       ├── fleet.ts                 (10-vehicle mapping + progress calc)
│       ├── geo.ts                   (Haversine, ETA, status helpers)
│       ├── auth.tsx                 (Auth context)
│       └── toast.tsx                (Toast provider)
└── prisma/
    └── schema.prisma

mini-services/
└── fleet-tracker/
    ├── package.json
    └── index.ts                     (Socket.IO server on :3003)

scripts/
└── seed.ts                          (seed 10 vehicles + users)
```
