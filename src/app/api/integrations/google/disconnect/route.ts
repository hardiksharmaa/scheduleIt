/**
 * POST /api/integrations/google/disconnect
 *
 * Marks the user's Google Calendar integration as inactive (soft delete).
 * The access/refresh tokens are retained in case the user reconnects later.
 */

import { NextResponse } from "next/server";
import { auth }         from "@/lib/auth";
import { db }           from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.calendarIntegration.updateMany({
    where: { userId: session.user.id, provider: "GOOGLE_CALENDAR" },
    data:  { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
