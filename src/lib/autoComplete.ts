import { db } from "@/lib/db";

/**
 * Marks any CONFIRMED bookings whose endTime has already passed as COMPLETED.
 * Call this at the top of server components / API routes that read booking data,
 * so statuses are always up to date without a background job.
 */
export async function autoCompleteExpiredBookings(userId: string): Promise<void> {
  const now = new Date();

  // Also include team event types where this user is a member
  const teamMemberships = await db.teamMember.findMany({
    where: { userId },
    select: { team: { select: { eventTypes: { select: { id: true } } } } },
  });
  const teamEventTypeIds = teamMemberships.flatMap((m) =>
    m.team.eventTypes.map((e) => e.id),
  );

  const orClause = teamEventTypeIds.length > 0
    ? [{ hostId: userId }, { eventTypeId: { in: teamEventTypeIds } }]
    : [{ hostId: userId }];

  await db.booking.updateMany({
    where: {
      OR: orClause,
      status: "CONFIRMED",
      endTime: { lt: now },
    },
    data: { status: "COMPLETED" },
  });
}
