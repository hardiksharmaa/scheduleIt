/**
 * POST /api/bookings/cancel-token
 *
 * Public endpoint — no auth required.
 * Cancels a booking using the signed cancelToken from the confirmation email.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { deleteCalendarEvent } from "@/lib/google-calendar";
import { sendCancellationEmails } from "@/lib/email";

const schema = z.object({
  token:  z.string().min(1),
  reason: z.string().max(500).optional(),
});

// GET — look up booking details for the cancel page
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const booking = await db.booking.findUnique({
    where: { cancelToken: token },
    select: {
      id: true, status: true,
      inviteeName: true, inviteeEmail: true, inviteeTimezone: true,
      startTime: true, endTime: true,
      eventType: { select: { title: true, duration: true, color: true } },
      host:      { select: { name: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });

  return NextResponse.json({ booking });
}

// POST — confirm the cancellation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const { token, reason } = parsed.data;

    const booking = await db.booking.findUnique({
      where: { cancelToken: token },
      select: {
        id: true, status: true, calendarEventId: true,
        inviteeName: true, inviteeEmail: true, inviteeTimezone: true,
        startTime: true, hostId: true,
        eventType: { select: { title: true } },
        host:      { select: { name: true, email: true } },
      },
    });

    if (!booking) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
    if (booking.status === "CANCELLED") return NextResponse.json({ error: "Already cancelled" }, { status: 409 });

    await db.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "invitee", cancelReason: reason ?? null },
    });

    // Delete calendar event (non-fatal)
    if (booking.calendarEventId) {
      deleteCalendarEvent(booking.hostId, booking.calendarEventId).catch(() => {});
    }

    // Send cancellation emails (non-fatal)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    sendCancellationEmails(
      {
        hostName:     booking.host.name ?? "Host",
        inviteeName:  booking.inviteeName,
        inviteeEmail: booking.inviteeEmail,
        eventTitle:   booking.eventType.title,
        startTime:    booking.startTime,
        timezone:     booking.inviteeTimezone,
        cancelledBy:  "invitee",
        reason:       reason ?? null,
        appUrl,
      },
      booking.host.email,
    ).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/bookings/cancel-token]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
