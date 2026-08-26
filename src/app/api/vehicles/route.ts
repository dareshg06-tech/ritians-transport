import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const vehicles = await db.vehicle.findMany({
      orderBy: { vehicleName: "asc" },
    });
    return NextResponse.json({ vehicles });
  } catch (err) {
    console.error("[api/vehicles GET]", err);
    return NextResponse.json({ error: "Failed to fetch vehicles" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vehicleNumber, vehicleName, vehicleType, driverName, routeNo } = body;
    if (!vehicleNumber || !vehicleName) {
      return NextResponse.json({ error: "vehicleNumber and vehicleName required" }, { status: 400 });
    }
    const v = await db.vehicle.create({
      data: {
        vehicleNumber: String(vehicleNumber),
        vehicleName: String(vehicleName),
        vehicleType: vehicleType || "bus",
        driverName: driverName || null,
        routeNo: routeNo || null,
        status: "offline",
      },
    });
    return NextResponse.json({ vehicle: v }, { status: 201 });
  } catch (err) {
    console.error("[api/vehicles POST]", err);
    return NextResponse.json({ error: "Failed to create vehicle" }, { status: 500 });
  }
}
