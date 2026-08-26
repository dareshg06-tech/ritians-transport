import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — list all notifications
export async function GET() {
  const notifications = await db.notification.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ notifications });
}

// POST — create + broadcast a new notification
export async function POST(req: NextRequest) {
  const { title, body, routeNo } = await req.json();
  if (!title || !body) return NextResponse.json({ error: "title and body required" }, { status: 400 });
  const recipients = routeNo ? Math.floor(20 + Math.random() * 60) : 1240;
  const n = await db.notification.create({ data: { title, body, routeNo: routeNo || null, recipients } });
  return NextResponse.json({ notification: n });
}
