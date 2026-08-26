import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/stops/[routeNo] — list stop crossings for a route (today)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ routeNo: string }> }) {
  const { routeNo } = await params;
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const crossings = await db.stopCrossing.findMany({
      where: { routeNo, crossedAt: { gte: startOfDay } },
      orderBy: { crossedAt: "asc" },
    });
    return NextResponse.json({ crossings });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
