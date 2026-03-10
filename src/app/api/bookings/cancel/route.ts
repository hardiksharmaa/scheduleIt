import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteCalendarEvent } from "@/lib/google-calendar";
import { sendCancellationEmails } from "@/lib/email";

const bodySchema = z.object({
  bookingId:   z.string().min(1),
  cancelledBy: z.enum(["host", "invitee"]).default("host"),
  reason:      z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { bookingId, cancelledBy, reason } = parsed.data;

    const booking = await db.booking.findFirst({
      where: { id: bookingId, hostId: session.user.id },
      select: {
        id: true, status: true, calendarEventId: true,
        inviteeName: true, inviteeEmail: true, inviteeTimezone: true,
        startTime: true,
        hostId: true,
        eventType: { select: { title: true } },
        host: { select: { name: true, email: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.status === "CANCELLED") {
      return NextResponse.json({ error: "Booking is already cancelled" }, { status: 409 });
    }

    await db.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy, cancelReason: reason ?? null },
    });

    // Delete Google Calendar event (non-fatal)
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
        cancelledBy:  cancelledBy === "host" ? "host" : "invitee",
        reason:       reason ?? null,
        appUrl,
      },
      booking.host.email,
    ).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/bookings/cancel]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
