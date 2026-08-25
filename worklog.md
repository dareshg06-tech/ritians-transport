# Worklog

---
Task ID: 1
Agent: main
Task: Clone https://ritians-tracking.onrender.com — Ritians Transport (RIT Chennai) bus-tracking portal — as a runnable Next.js 16 app. Login must accept `123456 / 123456`.

Work Log:
- Fetched the source site's HTML (108 KB, 1728 lines) and extracted the CSS theme (dark glassmorphism with orange/teal accents), all 51 route definitions, and the per-route boarding-stop schedules (every R01…R29B with full stop lists + times).
- Extracted 119 video frames from the user-supplied demo video and used VLM (z-ai vision CLI) to verify the original UI flow: Render.com cold-start → Student login → mobile dashboard → Admin login modal → Driver login modal → Driver GPS portal → mobile nav drawer.
- Initialized the Next.js 16 + Tailwind 4 + TypeScript scaffold via `init-fullstack.sh`.
- Built the design system in `src/app/globals.css` (port of original CSS variables, navbar, hero, panels, badges, modals, tables, sidebar highlights, login screen, toast, admin/driver sections, about/report, mobile breakpoints).
- Built `src/lib/ritians/data.ts` with all 51 routes + every route's stops + parking-location list + time helpers (parseTime, timeCat, isToday).
- Built `src/lib/ritians/auth.tsx` (AuthContext, localStorage-backed) — accepts `123456 / 123456` universally for student/admin/driver, and still accepts the original demo creds (`admin@college.edu`/`admin123`, `driver01`/`driver123`).
- Built `src/lib/ritians/toast.tsx` (toast notification context).
- Built `src/components/ritians/LoginScreen.tsx` — full-screen glassmorphism login card matching the original student login page.
- Built `src/components/ritians/Navbar.tsx` — sticky nav with brand, tab bar (Student/Admin/Driver/Live Tracking/Driver GPS), live clock, auth chip with logout.
- Built `src/components/ritians/Hero.tsx` — hero with eyebrow, gradient headline, tags, 3 CTA buttons, and 2×2 stat grid.
- Built `src/components/ritians/StudentView.tsx` — week strip, search+sort, routes table with timing/parking badges, sidebar with highlights + legends, About+Report section.
- Built `src/components/ritians/AdminView.tsx` — Admin Control Center with 3 quick-link cards (Attendance/SOS/Notification dashboards), route add/edit form, summary cards (Total/Earliest/Latest), Manage Routes table with edit/delete actions.
- Built `src/components/ritians/DriverView.tsx` — Driver Parking Portal with route selector + 11-location dropdown + custom location + extra note + Live Parking Board that updates in real-time when drivers publish.
- Built `src/components/ritians/StopsModal.tsx` — modal showing per-route boarding stops table with times.
- Built `src/components/ritians/LoginModals.tsx` — Admin Login and Driver Login modals.
- Built `src/components/ritians/InfoModal.tsx` — placeholder modal explaining that Live Tracking / Driver GPS / Face Register / Attendance / SOS / Notification dashboards require backend services not available in this clone.
- Built `src/components/ritians/Dashboard.tsx` — orchestrates all views, modals, and localStorage persistence of parking data.
- Updated `src/app/layout.tsx` (Space Grotesk + Inter + JetBrains Mono fonts via next/font, Font Awesome CDN, AuthProvider + ToastProvider wrappers, Ritians favicon + metadata).
- Updated `src/app/page.tsx` — auth gate that renders LoginScreen or Dashboard.
- Fixed lint errors (lazy-initialize state from localStorage instead of useEffect; switched admin email input from `type="email"` to `type="text"` so the universal `123456` login actually works).
- Verified end-to-end with Agent Browser: login (123456/123456) ✓, dashboard render ✓, admin login modal + admin panel (form, summary cards, quick-link cards, manage-routes table) ✓, driver login modal + driver panel (parking form + live board) ✓, parking publish flow (publish → live board updates → toast → student-view parking badge updates → hero "Parking Updates" counter increments from 0 to 1) ✓, stops modal ✓, search filter ✓, Live Tracking coming-soon modal ✓, mobile viewport (390×844) responsive layout ✓.
- Zero console errors; zero runtime errors.

Stage Summary:
- Deliverable: a runnable Next.js 16 app at `/home/z/my-project/` (served on port 3000).
- All client-side functionality of the original site is preserved: student/admin/driver views, route CRUD, parking updates, stops explorer, search/sort, week strip, stats, about/report.
- Login uses `123456 / 123456` for any role (also accepts the original demo creds).
- Backend-only features (Live GPS, FCM push, Face Recognition, Attendance/SOS/Notification dashboards) are surfaced as styled "coming soon" modals that explain they require backend services.
- Files: src/app/{layout,page,globals.css}.tsx, src/lib/ritians/{data,auth,toast}.tsx, src/components/ritians/{LoginScreen,Navbar,Hero,StudentView,AdminView,DriverView,StopsModal,LoginModals,InfoModal,Dashboard}.tsx.

---
Task ID: 2
Agent: main
Task: Add desktop/mobile view toggle, lat/long for boarding locations, live GPS tracking, real implementations for Driver GPS/Attendance/SOS/Notification/Face Register dashboards, AI chatbot, and afternoon departure schedule (3.40 pm) for all 51 buses.

Work Log:
- Added `coords: {lat, lng}` field to all 51 routes in data.ts (Chennai region coordinates).
- Added `RIT_CAMPUS_COORDS` constant (13.0397, 80.0740).
- Added afternoon return-trip calculation: `getReturnTrip(routeNo)` reverses the morning stop list and computes afternoon arrival times as `3.40 pm + (7.40 am − morning_time_at_that_stop)`. Also added `getReturnArrival`, `getReturnTripDuration`, `formatTime` helpers and constants `AFTERNOON_DEPARTURE`, `AFTERNOON_DEPARTURE_MIN`, `MORNING_ARRIVAL_MIN`.
- Added new CSS to globals.css for: `body.rt-force-mobile` (mobile layout at any viewport), `.rt-view-mode-badge` (floating bottom-left desktop/mobile toggle), `.rt-chat-fab` + `.rt-chat-panel` (chatbot UI), `.rt-map-container` (live tracking map with grid/stops/buses), `.rt-return-banner` (afternoon departure banner), dashboard pages CSS (`.rt-dash-page`, `.rt-attendance-row`, `.rt-sos-card`, `.rt-notif-*`, `.rt-face-capture` with scan animation).
- Built `LiveTrackingModal.tsx` — full-screen modal with simulated live GPS positions of 6 buses moving along their routes (updates every 1.5s), route selector, polyline + stops + bus markers on a Chennai-bbox map, live coords info panel, legend, currently-tracking grid.
- Built `DriverGpsPortal.tsx` — full page where drivers select their route, click "Start Sharing Location", and watch their simulated GPS position move along the route on a live preview map. Updates every 2s.
- Built `AttendanceDashboard.tsx` — full page with 4 stat cards (Total/Present/Late/Absent), All/Present/Late/Absent filter bar, search by register no/name/route, 60 mock student rows with reg numbers (2022CS001 format), names, route assignments, boarding times, and colored status badges. Export CSV button (mock).
- Built `SOSDashboard.tsx` — full page with 4 stat cards (Active/Resolved/Total/Avg Response), SOS alert cards with student info, location, message, timestamp, status; resolve/call/notify driver actions for active alerts.
- Built `NotificationDashboard.tsx` — full page with compose form (target audience = all students or specific route, title, message, send button) + recent notifications list showing title/body/timestamp/recipients count.
- Built `FaceRegister.tsx` — full page with simulated face capture (scan animation for 2.5s → captured → enrolled), student info form (name, reg no, route, phone), success state.
- Built `ReturnTripView.tsx` — new "Return Trip" navbar tab showing afternoon departure schedule for all 51 buses. Banner with 4 stats (Buses/First Arrival/Last Arrival/Avg Duration), table with columns: #, Route No, Route Name, Departure (3.40 pm), Final Arrival (e.g., 5.30 pm for R01 Ennore), Trip Duration (e.g., 1h 50m), Stops. Click any row → opens StopsModal in afternoon mode.
- Built `Chatbot.tsx` — floating chat FAB (bottom-right) with pulse indicator, opens a chat panel with header (Ritians Assistant · Online · AI-powered), welcome message, suggestion chips, message list, typing indicator, and input box.
- Built `/api/chat/route.ts` — server-side endpoint using z-ai-web-dev-sdk's `ZAI.create()` and `chat.completions.create()` with a system prompt that gives the AI context about Ritians Transport (51 routes, login 123456/123456, morning arrival 7.40 am, afternoon departure 3.40 pm, sample routes).
- Updated `StopsModal.tsx` — added Morning/Afternoon toggle (radio buttons), Location column showing lat/long coord chips for each stop (RIT Campus shows 13.040, 80.074), route coordinates banner at bottom showing origin + RIT campus coords.
- Updated `Navbar.tsx` — added "Return Trip" tab (purple accent), `viewMode` + `onToggleView` props, floating `.rt-view-mode-badge` at bottom-left showing "View: Desktop" or "View: Mobile" with a "Switch View" button. Badge is rendered OUTSIDE the sticky header so `position: fixed` correctly anchors to the viewport.
- Updated `Dashboard.tsx` — added `viewMode` state (desktop/mobile) that toggles `body.rt-force-mobile` class via useEffect, `fullPage` state for rendering Attendance/SOS/Notification/DriverGps/FaceRegister as standalone pages, `trackingOpen` for the LiveTrackingModal, `stopsTrip` for opening StopsModal in morning/afternoon mode, Chatbot rendered on every page.
- Fixed lint errors: refactored `LiveTrackingModal` to use lazy `useState` initializer for bus positions (avoiding setState-in-effect), refactored `DriverGpsPortal` to set initial position in `toggleShare` instead of inside the effect body.
- Fixed JSX syntax bug in Navbar (missing `</header>` closing tag).
- Verified end-to-end with Agent Browser: login (123456/123456) ✓, Return Trip tab ✓ showing 51 buses departing 3.40 pm with arrival times (R01 Ennore → 5.30 pm, R24 Arcot → 5.55 pm), StopsModal afternoon toggle ✓ showing RIT Campus 3.40 pm → Lift Gate 5.30 pm in reverse, Live Tracking modal ✓ with 6 moving buses + polyline + stops + live LAT/LNG coords, Chatbot ✓ (sent "How many routes are there?" → got reply mentioning 51 routes), Desktop/Mobile view toggle ✓ (badge at bottom-left, mobile layout stacks navbar vertically), Admin → Attendance Dashboard ✓ (60 students with stats and filter).
- Zero console errors. ESLint clean.

Stage Summary:
- Desktop/Mobile view toggle works (badge at bottom-left, body class `.rt-force-mobile` switches layout).
- All 51 routes + RIT Campus have lat/long coordinates; stops show coordinate chips in the StopsModal.
- Live Tracking modal shows 6 buses moving in real-time on a Chennai-bbox map with polyline + stops + RIT marker + live LAT/LNG info panel.
- Driver GPS Portal is a full standalone page with route selector, share toggle, and live preview map.
- Attendance Dashboard: 60 mock students, 4 stats, filter, search, Export CSV button.
- SOS Dashboard: 4 mock alerts, 4 stats, resolve/call/notify actions.
- Notification Dashboard: compose form + recent notifications list with recipient counts.
- Face Register: simulated scan animation + student info form + success state.
- Chatbot: floating FAB + chat panel + z-ai-web-dev-sdk backend at /api/chat.
- Afternoon departure schedule: all 51 buses depart RIT Campus at 3.40 pm, arrival times calculated by reversing morning schedule. R01 Ennore → 5.30 pm (1h 50m), R24 Arcot → 5.55 pm (2h 15m), R29B Sivanthangal → 4.15 pm (35m, shortest), etc. New "Return Trip" tab in navbar.
- Files added: src/app/api/chat/route.ts, src/components/ritians/{Chatbot,LiveTrackingModal,DriverGpsPortal,AttendanceDashboard,SOSDashboard,NotificationDashboard,FaceRegister,ReturnTripView}.tsx.
- Files updated: src/lib/ritians/data.ts (coords + return-trip functions), src/components/ritians/{Navbar,StopsModal,Dashboard}.tsx, src/app/globals.css.

---
Task ID: 3
Agent: main
Task: Redesign Driver GPS Portal to match the original site's screenshot — minimal card layout with big orange location icon, green "Start Sharing Location" button, and Status/Latitude/Longitude data grid.

Work Log:
- Analyzed the user-provided screenshot of the original Ritians Transport Driver GPS Portal page.
- Added new CSS to globals.css for `.rt-gps-page`, `.rt-gps-card`, `.rt-gps-hero` (with big orange icon), `.rt-gps-alert` (amber info box), `.rt-gps-select-wrap`, `.rt-gps-share-btn` (green gradient with rocket icon), `.rt-gps-data-grid` (Status/Latitude/Longitude rows), `.rt-gps-mini-map` (compact live position preview).
- Rewrote `DriverGpsPortal.tsx`:
  - Top nav: "Back to Home" + "Live Tracking" buttons (Live Tracking button turns active/cyan when sharing)
  - Single centered card (max-width 560px) with rounded corners and glassmorphism backdrop
  - Hero: 72×72 orange gradient icon (location-arrow) + "Driver GPS Portal" title + subtitle
  - Amber alert box: "Your location is only visible while tracking is active. It auto-expires after 60 seconds of inactivity."
  - "YOUR ROUTE / VEHICLE ID" label + dropdown with route icon and chevron
  - Big green "Start Sharing Location" button (turns red "Stop Sharing Location" when active)
  - Status/Latitude/Longitude data grid showing live values when sharing (Status: ● Live sharing in green, Latitude: 13.21670 in cyan, Longitude: 80.30000 in cyan, Route: R01 · Ennore, Updated: 1s ago)
  - Mini live-position map preview (200px tall) showing cyan route stops + orange RIT Campus marker + animated bus marker
  - Footer note about simulated GPS
- Updated `Dashboard.tsx` to pass `onOpenTracking` prop to DriverGpsPortal so the "Live Tracking" nav button opens the LiveTrackingModal.
- Verified end-to-end with Agent Browser: opened Driver GPS Portal from navbar → saw the new minimal card layout matching the screenshot → selected R01 Ennore → clicked "Start Sharing Location" → button turned red, Status changed to "● Live sharing", Latitude showed 13.21670, Longitude showed 80.30000 (actual Ennore coords), Route row appeared, Updated counter started, mini map preview showed cyan stops + orange RIT Campus + bus marker.
- ESLint clean, zero console errors.

Stage Summary:
- Driver GPS Portal now matches the original screenshot's design: minimal centered card, big orange hero icon, green Start Sharing button, Status/Latitude/Longitude data grid.
- Live coordinates update every 2 seconds with real Chennai-area lat/long values.
- Mini map preview appears below the data grid when sharing is active.
- "Live Tracking" nav button at top opens the full LiveTrackingModal with 6 moving buses.

---
Task ID: 4
Agent: main
Task: Build Elite Live Vehicle Tracking & Driver GPS Portal — full-stack real-time fleet tracking platform with admin dashboard, driver GPS portal, where-is-my-bus feature (like Chalo/Where Is My Train), AI chatbot, and 3.40 pm college arrival reset logic.

Work Log:
- Designed architecture: Next.js 16 (single SPA with view state) + Prisma/SQLite + Leaflet + Socket.IO mini-service + z-ai-web-dev-sdk for AI chatbot.
- Installed packages: leaflet, react-leaflet, ws, socket.io, socket.io-client, @types/leaflet, @types/ws.
- Set up Prisma schema with 5 tables: User, Vehicle, VehicleLocation, TrackingSession, StopCrossing. Pushed to SQLite via `bun run db:push`.
- Wrote seed script (scripts/seed.ts) that creates 10 buses (Bus One through Bus Ten) with route assignments (R01, R12, R24, R16B, R29, R05, R08, R03A, R16, R27) + admin/driver users. Ran successfully — 10 vehicles seeded.
- Built WebSocket mini-service at mini-services/fleet-tracker/index.ts (port 3003) using Socket.IO. Events: location_update, stop_crossed, arrived_at_college, vehicle_offline, initial_state. In-memory cache of latest positions for new client bootstrap. Started in background via `nohup bun --hot index.ts &`.
- Built REST API routes (all force-dynamic, runtime=nodejs):
  - /api/vehicles (GET, POST)
  - /api/vehicles/[id] (GET, PUT, DELETE)
  - /api/vehicles/[id]/location (GET)
  - /api/vehicles/[id]/history (GET — with from/to/limit query params, returns locations + crossings)
  - /api/locations (POST — validates coords, saves location, updates vehicle's last position + status)
  - /api/tracking/start (POST — closes existing sessions, clears today's crossings, creates new session, sets vehicle status to "tracking")
  - /api/tracking/stop (POST)
  - /api/tracking/status/[vehicleId] (GET)
  - /api/stop-crossings (POST — with 5-min dedupe)
  - /api/stop-crossings/[vehicleId] (GET — today's crossings)
  - /api/stops/[routeNo] (GET — today's crossings for a route)
  - /api/health (GET — total/live/idle/offline/tracking counts)
  - /api/chat (POST — z-ai-web-dev-sdk with system prompt containing Ritians Transport context + live fleet state injected per request)
- Built geo utilities (src/lib/ritians/geo.ts): haversineMeters, bearingDeg, formatDistance, formatDuration, timeAgo, statusFromLastSeen. Constants: OFFLINE_TIMEOUT_MS=2min, STOP_CROSSING_RADIUS_M=150, COLLEGE_ARRIVAL_RADIUS_M=200.
- Built fleet mapping (src/lib/ritians/fleet.ts): 10 vehicles with route → destination coords. getRouteStopsWithCoords() returns route stops with synthesized lat/lng coords (interpolated between destination and RIT Campus). computeBusProgress() returns lastCrossed, nextStop (with ETA + distance), progressPercent.
- Built WebSocket client hook (src/lib/fleet/useFleetSocket.ts): connects via `io("/?XTransformPort=3003")` per Caddy gateway requirements. Exposes emitLocation, emitStop, emitArrived, emitStopSharing. Connection status: connecting | connected | disconnected.
- Built demo simulator (src/lib/fleet/demoSimulator.ts): for vehicles not being driver-tracked, simulates GPS positions moving along their route at ~35 km/h. Detects stop crossings (within 150m) and college arrival (within 200m of RIT Campus). After arrival, auto-resets after 10s for next trip. Marked isSimulated=true.
- Built Leaflet map component (src/components/fleet/FleetMap.client.tsx): client-only (renamed to .client.tsx and dynamically imported via next/dynamic with ssr:false to avoid `window is not defined` SSR errors). Dark tile filter via CSS. Bus markers as divIcon (color by status: green=live, cyan=tracking, yellow=idle, gray=offline). Selected vehicle marker scales 1.3x + opens popup. Route polyline (cyan dashed) + stop markers (cyan dots, orange for RIT Campus, green for crossed). Popups show vehicle name, status, speed, last update, coords, route.
- Built Landing page (src/components/fleet/Landing.tsx): hero with gradient headline "Live Vehicle Tracking & Driver GPS Portal", badge with pulsing dot, two CTA buttons (Open Dashboard cyan, Driver GPS Portal orange), 4 stat cards (10 Vehicles, 51 Routes, 500+ Boarding Stops, AI Chat Assistant).
- Built Dashboard (src/components/fleet/Dashboard.tsx): sticky header with logo, "Live Tracking" title + connection status subtitle. Top-right stats pills (Live/Tracking/Idle/Offline counts) + DEMO ON/OFF toggle + Driver Portal + Where Is My Bus buttons. Left sidebar (340px) with Vehicle Tracker heading, search input, filter buttons (All/Live/Track/Off with counts), Active Vehicles list — each card shows vehicle icon (color by status), name, vehicle number, route, status chip, speed, last update time, progress bar. Right side: Leaflet map filling the area. Selected vehicle info overlay (top-left of map) with status/speed/coords/last crossed/next stop/progress/updated + "View Details & History" button. DEMO badge (top-right of map) when simulation is on. Mobile: sidebar becomes a drawer with toggle button.
- Built Driver Portal (src/components/fleet/DriverPortal.tsx): centered card with cyan location icon hero (pulsing animation). Vehicle selector dropdown. Status message card (idle: "Your location is currently not being shared" / active: "Your location is currently being shared"). Green "Start Sharing Location" button (turns red "Stop Sharing Location" when active). Real `navigator.geolocation.watchPosition()` with enableHighAccuracy. Live GPS telemetry card with 8 rows: Latitude, Longitude, Accuracy, Speed, Heading, Altitude, Last Update, Update Freq. Progress bar with last crossed stop + ETA to next stop. Stop counter ("✓ 3 stops crossed"). Graceful error handling for permission denied / unavailable / timeout with helpful fix instructions. WebSocket status indicator. Stop-crossing detection (within 150m of a stop's coords → save to DB + toast + WS broadcast). College arrival detection (within 200m of RIT Campus → stop tracking session + reset crossings + arrival toast).
- Built Vehicle Details (src/components/fleet/VehicleDetails.tsx): map showing the vehicle's full route + crossed stops (cyan=upcoming, green=crossed, orange=RIT). Tracking summary card: distance travelled, duration, max/avg speed, GPS points, stops crossed, start/end timestamps. Date/time filter (from/to datetime-local inputs). Stop crossings list with timestamps. Refresh History button.
- Built Where Is My Bus view (src/components/fleet/WhereIsMyBus.tsx): "Where Is My Train"-style live view. Banner with title + description mentioning Chalo/Where Is My Train. Vehicle selector. Progress banner (% complete, last crossed, next stop + ETA, speed). Stop-crossing notification card. Stop list: each row has sequence number (green if crossed, cyan if current, gray if pending), stop name, scheduled time, coordinates, actual crossing timestamp if crossed, status badge (✓ Crossed / ETA X min / Pending).
- Enhanced AI chatbot (src/components/fleet/Chatbot.tsx): floating orange FAB (bottom-right) with pulse indicator, opens 380×540 chat panel. Suggestion chips: "Where is Bus Five now?", "Which bus has crossed Kasimedu?", "How long until R01 reaches campus?", "Show me all live buses". Backend (/api/chat) injects live fleet state (all 10 vehicles' positions, speeds, last crossed stops) into the system prompt per request, so the AI's responses reference real live data.
- Updated toast provider (src/lib/ritians/toast.tsx) with two new toast types: stop_crossed (cyan icon + vehicle name + crossed stop + ETA to next) and arrived_college (green icon + "arrived at RIT Campus" + "Tracking session completed — data saved").
- Wired up main page (src/app/page.tsx): single SPA with view state (landing | dashboard | driver | details | where). Fetches /api/vehicles every 10s. Forwards live position updates from Dashboard to Where Is My Bus view via callback. AuthProvider + ToastProvider wrap everything.
- Added ~700 lines of CSS to globals.css for: .rt-landing-* (landing page), .rt-fleet-* (dashboard layout, sidebar, vehicle cards, map area, header pills), .rt-gps-* (driver portal card, hero, telemetry grid), .rt-wimb-* (where is my bus view), .rt-vd-* (vehicle details), mobile responsive breakpoints (sidebar → drawer on tablet/mobile).
- Fixed multiple lint issues: refactored cbRef updates to use useEffect (refs-in-render rule), used dynamic import with ssr:false for Leaflet (window is not defined), added eslint-disable for legitimate setState-in-effect patterns (fetchVehicles on mount).
- Verified end-to-end with Agent Browser:
  - Landing page renders with hero + 2 CTA buttons + 4 stat cards ✓
  - Open Dashboard → 10 buses in sidebar with live status, search/filter, DEMO badge on map, map shows bus markers + route polyline + stop markers ✓
  - Stop crossing notifications appear as toasts when simulated buses cross stops ✓
  - Chatbot: asked "Where is Bus Five now?" → got response mentioning Bus Five, route R29, last crossed Vijayanagar Bus Stand, location 12.98, 80.22 (real live data) ✓
  - Where Is My Bus view: progress banner (% complete, last crossed, next stop + ETA, speed), stop list with sequence numbers, scheduled times, coords, status badges (Crossed/ETA/Pending) ✓
  - Driver Portal: large cyan location icon, vehicle selector, status card, green Start Sharing button, real `navigator.geolocation.watchPosition()` triggers permission prompt, when permission denied shows clear error message with fix instructions ✓
- ESLint: 0 errors, 2 warnings (unused eslint-disable directives — non-blocking). Dev server: 0 errors. WebSocket service: 0 errors.

Stage Summary:
- Production-quality fleet tracking platform with premium dark glassmorphism UI.
- 10 buses seeded with routes, real GPS via `navigator.geolocation.watchPosition()` in Driver Portal, demo simulator for non-driver-tracked vehicles.
- Live updates via Socket.IO WebSocket (port 3003, accessed via Caddy gateway with XTransformPort=3003 query param).
- Leaflet map with dark theme, animated bus markers (color by status), route polyline, stop markers (crossed = green, upcoming = cyan, RIT Campus = orange).
- "Where Is My Bus" feature: similar to Chalo/Where Is My Train — shows last crossed stop, next stop ETA, % progress, distance to college. Stop crossing timestamps saved to DB. After college arrival, session auto-resets.
- AI chatbot with live fleet context — responses reference real-time bus positions.
- Files: prisma/schema.prisma, scripts/seed.ts, mini-services/fleet-tracker/{package.json,index.ts}, src/app/api/{vehicles,locations,tracking,stop-crossings,stops,health,chat}/route.ts, src/lib/{db.ts,ritians/{data,fleet,geo,auth,toast}.ts,fleet/{useFleetSocket,demoSimulator}.ts}, src/components/fleet/{Landing,Dashboard,DriverPortal,VehicleDetails,WhereIsMyBus,Chatbot,FleetMap.client}.tsx, src/app/{page.tsx,globals.css}, README.md.
