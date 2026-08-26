import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { routes, routeStops, parseTime, formatTime, AFTERNOON_DEPARTURE, MORNING_ARRIVAL_MIN, getReturnArrival } from "@/lib/ritians/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Build a compact but complete route catalog so the LLM can answer
// any question about routes, stops, times, or boarding points.
function buildRouteCatalog(): string {
  const lines: string[] = [];
  for (const r of routes) {
    const stops = routeStops[r.routeNo] || [];
    const stopNames = stops.map((s, i) => `${i + 1}. ${s.stop} (${s.time})`).join("; ");
    const morningStart = parseTime(r.start);
    const tripDurationMin = MORNING_ARRIVAL_MIN - morningStart; // minutes from start → RIT Campus (7.40 am)
    const afternoonArrival = getReturnArrival(r.routeNo);
    lines.push(
      `${r.routeNo} ${r.routeName} — Bus #${r.no}, starts ${r.start} (morning), arrives RIT Campus 7.40 am, ` +
        `trip duration ~${Math.floor(tripDurationMin / 60)}h ${tripDurationMin % 60}m; ` +
        `afternoon departs RIT 3.40 pm, arrives ${r.routeName} ${afternoonArrival}. ` +
        `Boarding stops (${stops.length}): ${stopNames}`
    );
  }
  return lines.join("\n");
}

const ROUTE_CATALOG = buildRouteCatalog();

const SYSTEM_PROMPT = `You are **Ritians Assistant** — the AI chatbot for the Ritians Transport portal at RIT Chennai (Rajalakshmi Institute of Technology, Kuthambakkam, Chennai).

## Your Role
Help students, drivers, and admins with questions about:
- Bus routes (51 routes, R01 through R29B)
- Boarding points / stops and their times
- Morning schedule (buses start from their origin and arrive RIT Campus at 7.40 am)
- Afternoon return schedule (buses depart RIT Campus at 3.40 pm and follow the morning route in reverse)
- Login credentials
- How to use the portal features (Admin, Driver, Live Tracking, Where Is My Bus, etc.)

## Key Facts
- **Login**: \`123456\` / \`123456\` (works for any role — student, admin, driver)
- **Total routes**: 51 (R01, R01A, R01B, R02, R03, R03A, R03B, R04, R05, R05A, R06, R07, R08, R08A, R09, R09A, R10, R11, R11A, R12, R13, R13A, R14, R14A, R15, R15A, R16, R16A, R16B, R17, R17A, R18, R18A, R18B, R19, R19A, R20, R21, R22, R22A, R23, R24, R25, R25A, R26, R27, R27A, R28, R29, R29A, R29B)
- **Morning arrival**: All buses arrive at RIT Campus at **7.40 am**
- **Afternoon departure**: All buses leave RIT Campus at **3.40 pm** and follow the morning route in reverse
- **Earliest bus**: R24 Arcot — starts at **5.25 am** (~2h 15m trip)
- **Latest bus**: R29B Sivanthangal — starts at **7.05 am** (~35m trip)
- **RIT Campus coords**: 13.0397, 80.0740 (Kuthambakkam, Chennai)

## Features
- **Student view**: Browse all 51 routes, search by route/boarding point/stop, click any row to see detailed boarding stops with times and coordinates
- **Return Trip tab**: Shows afternoon departure schedule (3.40 pm) for all 51 buses with calculated arrival times
- **Admin tab** (login admin@college.edu / admin123 or 123456 / 123456): Add/edit/delete routes
- **Driver tab** (login driver01 / driver123 or 123456 / 123456): Update parking location for students to see
- **Live Tracking**: Simulated GPS map showing buses moving along routes
- **Driver GPS Portal**: Real GPS sharing via \`navigator.geolocation.watchPosition()\`
- **Where Is My Bus**: Shows which stops a bus has crossed + ETA to next stop (like Chalo app)
- **Stops Modal**: Morning/Afternoon toggle showing boarding stops with lat/long coordinates

## Answering Guidelines
1. **Be accurate** — use the ROUTE CATALOG below to answer questions about specific routes, stops, and times. Don't make up information.
2. **Be concise** — under 4 sentences unless the user asks for detail.
3. **Use formatting** — \`code\` for route numbers/times, **bold** for emphasis.
4. **Stop-specific questions**: When asked "which bus passes via X" or "does R01 go through Y", check the route's boarding stops list in the catalog.
5. **Time questions**: When asked "what time does the bus reach X stop", give the scheduled time from the catalog.
6. **Distance/ETA**: When asked about distance or ETA, mention that the platform calculates it from GPS positions in real-time — suggest checking the Live Tracking or Where Is My Bus views.
7. **Login help**: Always mention \`123456\` / \`123456\` works for any role.

## ROUTE CATALOG
${ROUTE_CATALOG}
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const chatMessages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const zai = await ZAI.create();
    const response = await zai.chat.completions.create({
      messages: chatMessages,
      thinking: { type: "disabled" },
    });

    const reply =
      response?.choices?.[0]?.message?.content ||
      "Sorry, I couldn't generate a response. Please try again.";

    return NextResponse.json({ reply });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[chat] error:", message);
    return NextResponse.json({ error: "Chat failed", details: message }, { status: 500 });
  }
}
