import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import BookingsClient, { SerializedBooking } from "./BookingsClient";
import { autoCompleteExpiredBookings } from "@/lib/autoComplete";

export default async function BookingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // Silently flip any CONFIRMED bookings whose end time has passed → COMPLETED
  await autoCompleteExpiredBookings(userId);

  const now = new Date();

  // Collect IDs of team event types for teams the user is a member of,
  // so team bookings assigned to other members still show up here.
  const teamMemberships = await db.teamMember.findMany({
    where: { userId },
    select: { team: { select: { eventTypes: { select: { id: true } } } } },
  });
  const teamEventTypeIds = teamMemberships.flatMap((m) =>
    m.team.eventTypes.map((e) => e.id),
  );

  const orFilter = teamEventTypeIds.length > 0
    ? { OR: [{ hostId: userId }, { eventTypeId: { in: teamEventTypeIds } }] }
    : { hostId: userId };

  const eventTypeInclude = {
    select: {
      title:    true,
      color:    true,
      duration: true,
      team:     { select: { name: true } },
    },
  } as const;

  const [upcomingRaw, cancelledRaw, completedRaw, statsRaw] = await Promise.all([
    db.booking.findMany({
      where: { ...orFilter, status: { in: ["CONFIRMED", "PENDING"] }, startTime: { gte: now } },
      include: { eventType: eventTypeInclude },
      orderBy: { startTime: "asc" },
      take: 100,
    }),
    db.booking.findMany({
      where: { ...orFilter, status: "CANCELLED" },
      include: { eventType: eventTypeInclude },
      orderBy: { startTime: "desc" },
      take: 100,
    }),
    db.booking.findMany({
      where: { ...orFilter, status: "COMPLETED" },
      include: { eventType: eventTypeInclude },
      orderBy: { startTime: "desc" },
      take: 100,
    }),
    db.booking.groupBy({
      by: ["status"],
      where: orFilter,
      _count: { status: true },
    }),
  ]);

  function serialize(b: (typeof upcomingRaw)[0]): SerializedBooking {
    return {
      id:              b.id,
      inviteeName:     b.inviteeName,
      inviteeEmail:    b.inviteeEmail,
      inviteeTimezone: b.inviteeTimezone,
      startTime:       b.startTime.toISOString(),
      endTime:         b.endTime.toISOString(),
      status:          b.status,
      notes:           b.notes,
      location:        b.location,
      cancelToken:     b.cancelToken,
      eventType: {
        title:    b.eventType.title,
        color:    b.eventType.color ?? "#D83F87",
        duration: b.eventType.duration,
        teamName: b.eventType.team?.name ?? null,
      },
    };
  }

  const upcoming  = upcomingRaw.map(serialize);
  const cancelled = cancelledRaw.map(serialize);
  const completed = completedRaw.map(serialize);

  const statusMap: Record<string, number> = {};
  for (const row of statsRaw) {
    statusMap[row.status] = row._count.status;
  }

  const stats = {
    total:     Object.values(statusMap).reduce((a, b) => a + b, 0),
    upcoming:  upcoming.length,
    completed: statusMap["COMPLETED"] ?? 0,
    cancelled: statusMap["CANCELLED"] ?? 0,
  };

  return (
    <BookingsClient
      upcoming={upcoming}
      cancelled={cancelled}
      completed={completed}
      stats={stats}
      initialView="upcoming"
    />
  );
}
