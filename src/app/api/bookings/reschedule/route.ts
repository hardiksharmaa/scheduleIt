/**
 * GET  /api/bookings/reschedule?token=  — load booking + event type details
 * POST /api/bookings/reschedule         — confirm new time
 *
 * Public endpoint — no auth required. Uses rescheduleToken from email.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { updateCalendarEvent } from "@/lib/google-calendar";
import { sendRescheduleEmails } from "@/lib/email";

const schema = z.object({
  token:     z.string().min(1),
  startTime: z.string().datetime(),
});

// GET — return booking info so the reschedule page can show current details
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const booking = await db.booking.findUnique({
    where: { rescheduleToken: token },
    select: {
      id: true, status: true,
      inviteeName: true, inviteeEmail: true, inviteeTimezone: true,
      startTime: true, endTime: true,
      eventType: {
        select: {
          id: true, title: true, duration: true, color: true,
          userId: true,
        },
      },
      host: { select: { name: true, username: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });

  return NextResponse.json({ booking });
}

// POST — apply the rescheduled time
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const { token, startTime: startIso } = parsed.data;

    const booking = await db.booking.findUnique({
      where: { rescheduleToken: token },
      select: {
        id: true, status: true, calendarEventId: true,
        inviteeName: true, inviteeEmail: true, inviteeTimezone: true,
        startTime: true, endTime: true, hostId: true,
        eventType: { select: { title: true, duration: true } },
        host:      { select: { name: true, email: true } },
      },
    });

    if (!booking) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
    if (booking.status === "CANCELLED") return NextResponse.json({ error: "Cannot reschedule a cancelled booking" }, { status: 409 });

    const newStart = new Date(startIso);
    if (newStart.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Cannot reschedule to a time in the past" }, { status: 400 });
    }

    const newEnd = new Date(newStart.getTime() + booking.eventType.duration * 60_000);

    // Check for conflicts at the new time
    const conflict = await db.booking.findFirst({
      where: {
        hostId: booking.hostId,
        id:     { not: booking.id },
        status: { in: ["CONFIRMED", "PENDING"] },
        startTime: { lt: newEnd },
        endTime:   { gt: newStart },
      },
      select: { id: true },
    });

    if (conflict) {
      return NextResponse.json({ error: "That slot is no longer available — please choose another time" }, { status: 409 });
    }

    const oldStart = booking.startTime;

    await db.booking.update({
      where: { id: booking.id },
      data: {
        startTime: newStart,
        endTime:   newEnd,
        status:    "CONFIRMED",
      },
    });

    // Update Google Calendar event (non-fatal)
    if (booking.calendarEventId) {
      updateCalendarEvent(booking.hostId, booking.calendarEventId, newStart, newEnd).catch(() => {});
    }

    // Send reschedule emails (non-fatal)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    sendRescheduleEmails(
      {
        hostName:      booking.host.name ?? "Host",
        inviteeName:   booking.inviteeName,
        inviteeEmail:  booking.inviteeEmail,
        eventTitle:    booking.eventType.title,
        oldStartTime:  oldStart,
        newStartTime:  newStart,
        newEndTime:    newEnd,
        timezone:      booking.inviteeTimezone,
        appUrl,
      },
      booking.host.email,
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      startTime: newStart.toISOString(),
      endTime:   newEnd.toISOString(),
    });
  } catch (err) {
    console.error("[POST /api/bookings/reschedule]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
