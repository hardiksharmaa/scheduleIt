import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db";
import { generateICS }               from "@/lib/ics";

/**
 * GET /api/bookings/{id}/ics
 *
 * Public endpoint — returns an iCalendar (.ics) file for the given booking.
 * The booking CUID is sufficiently non-guessable; no auth token required.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      eventType: { select: { title: true } },
      host:      { select: { name: true, email: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hostName  = booking.host.name  ?? "Host";
  const hostEmail = booking.host.email ?? "no-reply@scheduleit.app";

  const ics = generateICS({
    uid:            `${booking.id}@scheduleit.app`,
    title:          `${booking.eventType.title} with ${booking.inviteeName}`,
    description:    booking.notes ?? undefined,
    location:       booking.location ?? undefined,
    startTime:      booking.startTime,
    endTime:        booking.endTime,
    organizerName:  hostName,
    organizerEmail: hostEmail,
    attendeeName:   booking.inviteeName,
    attendeeEmail:  booking.inviteeEmail,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type":        "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="meeting-${booking.id}.ics"`,
      "Cache-Control":       "no-store",
    },
  });
}
