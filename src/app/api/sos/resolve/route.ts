import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST — resolve an SOS alert
export async function POST(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const alert = await db.sOSAlert.update({ where: { id }, data: { status: "resolved", resolvedAt: new Date() } });
  return NextResponse.json({ alert });
}
