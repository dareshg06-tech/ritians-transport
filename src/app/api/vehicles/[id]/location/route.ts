import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/vehicles/[id]/location — latest location
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const latest = await db.vehicleLocation.findFirst({
      where: { vehicleId: id },
      orderBy: { recordedAt: "desc" },
    });
    return NextResponse.json({ location: latest });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
