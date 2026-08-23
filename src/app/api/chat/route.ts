import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_CONTEXT = `
You are "Ritians Assistant" — a helpful AI chatbot for the Ritians Transport bus-tracking portal at RIT Chennai (Rajalakshmi Institute of Technology, Kuthambakkam, Chennai).

The portal manages 51 college bus routes (R01 through R29B) covering Chennai and surrounding areas including Kancheepuram, Thiruvallur, and Arcot. Buses arrive at RIT Campus at 7.40 am (morning trip) and depart from RIT Campus at 3.40 pm (afternoon return trip).

Key facts:
- Login: any role accepts credentials 123456 / 123456
- Three roles: Student (view schedules + track buses), Admin (manage routes), Driver (update parking)
- Live GPS Tracking shows simulated bus positions
- Afternoon departures: buses leave RIT Campus at 3.40 pm and follow the morning route in reverse

When asked about routes or schedules, give concise helpful answers. If asked for specific route times, mention the format is like "6.10 am" for morning departures. Afternoon arrival at the last stop is calculated from the morning trip duration.

Sample routes you can mention:
- R01 Ennore (5.50 am start)
- R12 Minjur (5.45 am — earliest)
- R24 Arcot (5.25 am — farthest, ~2h15m trip)
- R29B Sivanthangal (7.05 am — latest start)
- All buses arrive RIT Campus at 7.40 am

Be friendly, concise, and use simple formatting. If unsure, suggest the user check the dashboard. Keep replies under 4 sentences unless asked for detail.
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const chatMessages = [
      { role: "system" as const, content: ROUTE_CONTEXT },
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
    return NextResponse.json(
      { error: "Chat failed", details: message },
      { status: 500 }
    );
  }
}
