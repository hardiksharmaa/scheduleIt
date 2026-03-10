/**
 * GET /api/integrations/google/status
 *
 * Returns the current Google Calendar connection status for the authenticated user.
 *
 * Response: { connected: boolean; connectedAt: string | null }
 */

import { NextResponse } from "next/server";
import { auth }         from "@/lib/auth";
import { db }           from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integration = await db.calendarIntegration.findUnique({
    where: {
      userId_provider: { userId: session.user.id, provider: "GOOGLE_CALENDAR" },
    },
    select: { isActive: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({
    connected:   integration?.isActive ?? false,
    connectedAt: integration?.isActive ? integration.updatedAt.toISOString() : null,
  });
}
