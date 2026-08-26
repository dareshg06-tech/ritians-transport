import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health — overall system status + dashboard stats
export async function GET() {
  try {
    const total = await db.vehicle.count();
    const live = await db.vehicle.count({ where: { status: "live" } });
    const idle = await db.vehicle.count({ where: { status: "idle" } });
    const offline = await db.vehicle.count({ where: { status: "offline" } });
    const tracking = await db.vehicle.count({ where: { status: "tracking" } });
    const activeDrivers = await db.vehicle.count({
      where: { status: { in: ["live", "idle", "tracking"] } },
    });

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      stats: { total, live, idle, offline, tracking, activeDrivers },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "DB unreachable" }, { status: 500 });
  }
}
