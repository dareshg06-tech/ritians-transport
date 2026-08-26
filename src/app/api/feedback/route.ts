import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST — submit feedback
export async function POST(req: NextRequest) {
  const { type, message, tags, studentName, routeNo } = await req.json();
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });
  const f = await db.feedback.create({
    data: { type: type || "feedback", message, tags: tags || "", studentName: studentName || null, routeNo: routeNo || null },
  });
  return NextResponse.json({ feedback: f });
}

// GET — list all feedback (for admin analysis)
export async function GET() {
  const feedback = await db.feedback.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ feedback });
}
