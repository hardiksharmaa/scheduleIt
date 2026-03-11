import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { db }                        from "@/lib/db";
import { autoCompleteExpiredBookings } from "@/lib/autoComplete";

/**
 * GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns booking analytics for the authenticated host.
 * Includes: overview stats, daily series, hourly heatmap,
 * top event types, and status breakdown.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  // Auto-complete any bookings whose end time has passed before computing stats
  await autoCompleteExpiredBookings(userId);

  const { searchParams } = new URL(req.url);

  // Date range bounds — default to last 30 days
  const toParam   = searchParams.get("to");
  const fromParam = searchParams.get("from");
  const to   = toParam   ? new Date(toParam   + "T23:59:59Z") : new Date();
  const from = fromParam ? new Date(fromParam + "T00:00:00Z")
                         : new Date(to.getTime() - 30 * 24 * 60 * 60_000);

  // ── Load all bookings in range ─────────────────────────────────────────────
  // Include team event type bookings where user is a member
  const teamMemberships = await db.teamMember.findMany({
    where: { userId },
    select: { team: { select: { eventTypes: { select: { id: true } } } } },
  });
  const teamEventTypeIds = teamMemberships.flatMap((m) =>
    m.team.eventTypes.map((e) => e.id),
  );

  const bookings = await db.booking.findMany({
    where: {
      OR: [
        { hostId: userId },
        ...(teamEventTypeIds.length > 0
          ? [{ eventTypeId: { in: teamEventTypeIds } }]
          : []),
      ],
      createdAt: { gte: from, lte: to },
    },
    include: {
      eventType: { select: { title: true, color: true, duration: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // ── Also get bookings outside the range for total-ever stats ──────────────
  const allBookings = await db.booking.findMany({
    where: {
      OR: [
        { hostId: userId },
        ...(teamEventTypeIds.length > 0
          ? [{ eventTypeId: { in: teamEventTypeIds } }]
          : []),
      ],
    },
    select: { status: true },
  });

  // ── Overview ──────────────────────────────────────────────────────────────
  const total     = bookings.length;
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length;
  const completed = bookings.filter((b) => b.status === "COMPLETED").length;
  const cancelled = bookings.filter((b) => b.status === "CANCELLED").length;
  const pending   = bookings.filter((b) => b.status === "PENDING").length;

  const allTotal     = allBookings.length;
  const allCancelled = allBookings.filter((b) => b.status === "CANCELLED").length;
  const allCompleted = allBookings.filter((b) => b.status === "COMPLETED").length;

  const avgDuration =
    total > 0
      ? Math.round(
          bookings.reduce((sum, b) => sum + b.eventType.duration, 0) / total,
        )
      : 0;

  const completionRate =
    allTotal > 0 ? Math.round((allCompleted / allTotal) * 100) : 0;
  const cancellationRate =
    allTotal > 0 ? Math.round((allCancelled / allTotal) * 100) : 0;

  // Unique invitees in range
  const uniqueInvitees = new Set(bookings.map((b) => b.inviteeEmail)).size;

  // ── Daily series (all statuses) ───────────────────────────────────────────
  const dailyMap: Record<string, { confirmed: number; cancelled: number; completed: number }> = {};

  // Pre-populate every day in range so chart has no gaps
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(23, 59, 59, 999);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    dailyMap[key] = { confirmed: 0, cancelled: 0, completed: 0 };
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (const b of bookings) {
    const key = b.createdAt.toISOString().slice(0, 10);
    if (!dailyMap[key]) dailyMap[key] = { confirmed: 0, cancelled: 0, completed: 0 };
    if (b.status === "CONFIRMED" || b.status === "PENDING")
      dailyMap[key].confirmed++;
    else if (b.status === "CANCELLED")
      dailyMap[key].cancelled++;
    else if (b.status === "COMPLETED")
      dailyMap[key].completed++;
  }

  const series = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  // ── Hourly heatmap (slot start hour in UTC — client adjusts to local) ─────
  const hourlyMap: Record<number, number> = {};
  for (let h = 0; h < 24; h++) hourlyMap[h] = 0;
  for (const b of bookings) {
    if (b.status !== "CANCELLED") {
      const hour = b.startTime.getUTCHours();
      hourlyMap[hour] = (hourlyMap[hour] ?? 0) + 1;
    }
  }
  const hourly = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: hourlyMap[h] ?? 0,
  }));

  // ── By event type ─────────────────────────────────────────────────────────
  const etMap: Record<string, { title: string; color: string; count: number }> = {};
  for (const b of bookings) {
    if (b.status === "CANCELLED") continue;
    const key = b.eventTypeId;
    if (!etMap[key]) {
      etMap[key] = {
        title: b.eventType.title,
        color: b.eventType.color ?? "#D83F87",
        count: 0,
      };
    }
    etMap[key].count++;
  }
  const byEventType = Object.values(etMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // ── By day of week ────────────────────────────────────────────────────────
  const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dowMap: Record<number, number> = {};
  for (let i = 0; i < 7; i++) dowMap[i] = 0;
  for (const b of bookings) {
    if (b.status !== "CANCELLED") {
      const dow = b.startTime.getUTCDay();
      dowMap[dow] = (dowMap[dow] ?? 0) + 1;
    }
  }
  const byDayOfWeek = Array.from({ length: 7 }, (_, i) => ({
    day: DOW_LABELS[i],
    count: dowMap[i] ?? 0,
  }));

  // ── Status breakdown ──────────────────────────────────────────────────────
  const statusBreakdown = [
    { status: "Confirmed",  count: confirmed, color: "#D83F87" },
    { status: "Completed",  count: completed, color: "#4ade80" },
    { status: "Cancelled",  count: cancelled, color: "#f87171" },
    { status: "Pending",    count: pending,   color: "#facc15" },
  ].filter((s) => s.count > 0);

  return NextResponse.json({
    overview: {
      total,
      confirmed,
      completed,
      cancelled,
      pending,
      avgDuration,
      completionRate,
      cancellationRate,
      uniqueInvitees,
      allTotal,
    },
    series,
    hourly,
    byEventType,
    byDayOfWeek,
    statusBreakdown,
    range: { from: from.toISOString(), to: to.toISOString() },
  });
}
