import { NextRequest } from "next/server";
import { fleetBus } from "@/lib/fleet/eventBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/live — Server-Sent Events stream for admin dashboard.
// Receives all fleet events (location updates, stop crossings, arrivals, offline).
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      const initial = fleetBus.getLatestPositions();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "initial_state", data: initial })}\n\n`));

      // Subscribe to future events
      const unsubscribe = fleetBus.subscribe((event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch (_) {
          // stream closed
        }
      });

      // Heartbeat every 25s to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (_) {
          // closed
        }
      }, 25000);

      // Clean up on abort (client disconnect)
      req.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(heartbeat);
        try { controller.close(); } catch (_) {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
