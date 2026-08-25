import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `
You are "Ritians Fleet Assistant" — an AI chatbot for the Ritians Transport live fleet tracking platform at RIT Chennai (Rajalakshmi Institute of Technology, Kuthambakkam, Chennai).

Key facts:
- 10 buses are tracked (Bus One through Bus Ten), each assigned to a route from R01 through R29B
- Buses arrive at RIT Campus at 7.40 am (morning trip) and depart from RIT Campus at 3.40 pm (afternoon return trip)
- Each bus has a list of boarding stops with times; the platform tracks when each bus crosses each stop ("Where Is My Bus" feature, similar to the Chalo app or "Where Is My Train")
- Live GPS data: latitude, longitude, speed, heading, accuracy — updated every 2-5 seconds via WebSocket
- When a bus crosses a stop, a notification is sent and the stop crossing is recorded with a timestamp
- Distance from departure to college: calculated from GPS positions
- ETA to next stop: based on current speed and Haversine distance to that stop's coordinates
- After a bus arrives at RIT Campus, its tracking session resets for the next day

Routes and examples:
- R01 Ennore — 10 stops, ~1h 50m morning trip
- R12 Minjur — earliest start (5.45 am), ~1h 55m
- R24 Arcot — farthest (5.25 am), ~2h 15m
- R29B Sivanthangal — latest start (7.05 am), ~35m

When asked about a specific bus's location, ETA, or stop crossings, give a concise answer based on the live context provided in the user message. If you don't know the exact live status, suggest the user check the dashboard or ask specifically for "where is Bus Five".

For login questions: use 123456 / 123456 (works for any role).

Be friendly, concise (under 4 sentences), use **bold** for emphasis and \`code\` for technical values. If asked something unrelated to fleet tracking, gently redirect.
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    // Gather live context: all vehicles with last positions + today's stop crossings
    let liveContext = "";
    try {
      const vehicles = await db.vehicle.findMany({ orderBy: { vehicleName: "asc" } });
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const crossings = await db.stopCrossing.findMany({
        where: { crossedAt: { gte: startOfDay } },
        orderBy: { crossedAt: "asc" },
      });

      const lines: string[] = ["LIVE FLEET STATE:"];
      for (const v of vehicles) {
        const vCrossings = crossings.filter((c) => c.vehicleId === v.id);
        const lastCrossed = vCrossings[vCrossings.length - 1];
        lines.push(
          `- ${v.vehicleName} (${v.vehicleNumber}, route ${v.routeNo}): status=${v.status}, ` +
            `lat=${v.lastLat ?? "?"}, lng=${v.lastLng ?? "?"}, ` +
            `speed=${v.lastSpeed ?? 0} km/h, ` +
            `lastSeen=${v.lastSeenAt ? new Date(v.lastSeenAt).toISOString() : "never"}` +
            (lastCrossed ? `, last crossed stop="${lastCrossed.stopName}" at ${new Date(lastCrossed.crossedAt).toLocaleTimeString("en-IN")}` : "")
        );
      }
      liveContext = lines.join("\n");
    } catch (_) {
      // ignore DB errors — fall back without context
    }

    const chatMessages = [
      { role: "system" as const, content: SYSTEM_PROMPT + (liveContext ? "\n\n" + liveContext : "") },
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
