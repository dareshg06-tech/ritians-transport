import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/vehicles/[id]/history?from=ISO&to=ISO&limit=500
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "500", 10), 5000);

  try {
    const where: { vehicleId: string; recordedAt?: { gte?: Date; lte?: Date } } = { vehicleId: id };
    if (from || to) {
      where.recordedAt = {};
      if (from) where.recordedAt.gte = new Date(from);
      if (to) where.recordedAt.lte = new Date(to);
    }
    const locations = await db.vehicleLocation.findMany({
      where,
      orderBy: { recordedAt: "asc" },
      take: limit,
    });
    // Also fetch stop crossings in same window
    const crossings = await db.stopCrossing.findMany({
      where: {
        vehicleId: id,
        ...(from || to
          ? { crossedAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } }
          : {}),
      },
      orderBy: { crossedAt: "asc" },
    });
    return NextResponse.json({ locations, crossings });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
