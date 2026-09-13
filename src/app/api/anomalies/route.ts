import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/anomalies — list GPS anomalies for the admin debug panel.
// Supports filtering by vehicleId, type, and time range.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const vehicleId = url.searchParams.get("vehicleId");
    const type = url.searchParams.get("type");
    const rejected = url.searchParams.get("rejected");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);

    const where: Record<string, unknown> = {};
    if (vehicleId) where.vehicleId = vehicleId;
    if (type) where.type = type;
    if (rejected === "true") where.rejected = true;
    if (rejected === "false") where.rejected = false;

    const anomalies = await db.busLocationAnomaly.findMany({
      where,
      orderBy: { detectedAt: "desc" },
      take: limit,
      include: {
        vehicle: {
          select: { vehicleNumber: true, vehicleName: true, routeNo: true },
        },
      },
    });

    return NextResponse.json({ anomalies });
  } catch (err) {
    console.error("[api/anomalies GET]", err);
    return NextResponse.json({ error: "Failed to fetch anomalies" }, { status: 500 });
  }
}
