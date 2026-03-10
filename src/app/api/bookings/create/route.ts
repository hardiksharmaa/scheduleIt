import "@/lib/env";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes }       from "crypto";
import { z }                  from "zod";
import { db }                 from "@/lib/db";
import { createCalendarEvent } from "@/lib/google-calendar";
import { createZoomMeeting }   from "@/lib/zoom";
import { createTeamsMeeting }  from "@/lib/teams";
import { sendBookingConfirmationEmails } from "@/lib/email";
import { generateICS }         from "@/lib/ics";
import { apiError, logError }  from "@/lib/apiError";

/**
 * POST /api/bookings/create
 *
 * Public endpoint — no auth required.
 * Validates the requested slot, checks for conflicts, and creates a CONFIRMED booking.
 */

const bodySchema = z.object({
  eventTypeId:     z.string().min(1),
  inviteeName:     z.string().min(1).max(200),
  inviteeEmail:    z.string().email(),
  inviteeTimezone: z.string().default("UTC"),
  startTime:       z.string().datetime(), // UTC ISO 8601
  notes:           z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // ── 1. Load the event type ─────────────────────────────────────────────
    const eventType = await db.eventType.findUnique({
      where: { id: data.eventTypeId },
      select: {
        id:           true,
        userId:       true,
        title:        true,
        duration:     true,
        isActive:     true,
        locationType: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (!eventType || !eventType.isActive) {
      return NextResponse.json(
        { error: "Event type not found or inactive" },
        { status: 404 }
      );
    }

    const startTime = new Date(data.startTime);
    const endTime   = new Date(startTime.getTime() + eventType.duration * 60_000);

    // ── 2. Validate timezone ───────────────────────────────────────────────
    try {
      Intl.DateTimeFormat(undefined, { timeZone: data.inviteeTimezone });
    } catch {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }

    // ── 3. Reject slots in the past ────────────────────────────────────────
    if (startTime.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Cannot book a slot in the past" },
        { status: 400 }
      );
    }

    // ── 4–6. Conflict check + create — single serializable transaction ──────
    // SERIALIZABLE isolation prevents two concurrent requests from both passing
    // the conflict check and writing overlapping bookings.
    const cancelToken     = randomBytes(24).toString("hex");
    const rescheduleToken = randomBytes(24).toString("hex");

    let booking: { id: string; startTime: Date; endTime: Date };
    try {
      booking = await db.$transaction(async (tx) => {
        const conflict = await tx.booking.findFirst({
          where: {
            hostId: eventType.userId,
            status: { in: ["CONFIRMED", "PENDING"] },
            startTime: { lt: endTime },
            endTime:   { gt: startTime },
          },
          select: { id: true },
        });
        if (conflict) {
          throw Object.assign(new Error("This slot is no longer available — please pick another time"), { statusCode: 409 });
        }

        const duplicate = await tx.booking.findFirst({
          where: {
            eventTypeId:  data.eventTypeId,
            inviteeEmail: data.inviteeEmail,
            status:       { in: ["CONFIRMED", "PENDING"] },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw Object.assign(new Error("You have already booked this event. Only one booking per email is allowed."), { statusCode: 409 });
        }

        return tx.booking.create({
          data: {
            eventTypeId:     data.eventTypeId,
            hostId:          eventType.userId,
            inviteeName:     data.inviteeName,
            inviteeEmail:    data.inviteeEmail,
            inviteeTimezone: data.inviteeTimezone,
            startTime,
            endTime,
            status:          "CONFIRMED",
            notes:           data.notes ?? null,
            cancelToken,
            rescheduleToken,
          },
          select: { id: true, startTime: true, endTime: true },
        });
      }, { isolationLevel: "Serializable" });
    } catch (txErr) {
      const code = (txErr as { statusCode?: number }).statusCode;
      if (code === 409) {
        return NextResponse.json({ error: (txErr as Error).message }, { status: 409 });
      }
      throw txErr;
    }

    // ── 7. Create meeting link based on locationType ──────────────────────
    let meetingLink: string | null = null;
    let meetingId:   string | null = null;
    let calendarEventId: string | null = null;

    // Always try to create a Google Calendar event (blocks host's time).
    // Only add a Meet conference if the location type is GOOGLE_MEET.
    const wantsMeetLink = eventType.locationType === "GOOGLE_MEET";
    const gcal = await createCalendarEvent(eventType.userId, {
      title:         `${eventType.title} with ${data.inviteeName}`,
      description:   data.notes ?? undefined,
      startTime,
      endTime,
      attendeeEmail: data.inviteeEmail,
      attendeeName:  data.inviteeName,
      addMeetLink:   wantsMeetLink,
    });
    calendarEventId = gcal.calendarEventId ?? null;
    if (wantsMeetLink && gcal.meetLink) meetingLink = gcal.meetLink;

    // For Zoom bookings: create a Zoom meeting and use its join URL
    if (eventType.locationType === "ZOOM") {
      try {
        const zm = await createZoomMeeting(
          eventType.userId,
          `${eventType.title} with ${data.inviteeName}`,
          startTime,
          eventType.duration,
        );
        meetingLink = zm.joinUrl;
        meetingId   = zm.meetingId;
      } catch (err) {
        console.warn("[bookings/create] Zoom meeting creation failed, no link set:", err);
        // Non-fatal: booking continues without Zoom link
      }
    }

    // For Teams bookings: create an online meeting via MS Graph
    if (eventType.locationType === "TEAMS") {
      try {
        const tm = await createTeamsMeeting(
          eventType.userId,
          `${eventType.title} with ${data.inviteeName}`,
          startTime,
          endTime,
        );
        meetingLink = tm.joinUrl;
        meetingId   = tm.meetingId;
      } catch (err) {
        console.warn("[bookings/create] Teams meeting creation failed, no link set:", err);
        // Non-fatal: booking continues without Teams link
      }
    }

    // Persist calendar event ID + resolved meeting link / meeting ID
    if (calendarEventId || meetingLink || meetingId) {
      await db.booking.update({
        where: { id: booking.id },
        data:  {
          calendarEventId: calendarEventId ?? undefined,
          location:        meetingLink     ?? undefined,
          meetingId:       meetingId       ?? undefined,
        },
      });
    }

    // ── 8. Send confirmation emails (non-fatal) ──────────────────────────
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const hostName = eventType.user.name ?? "Host";
    const hostEmail = eventType.user.email;

    // Generate ICS attachment for the guest confirmation email
    const icsContent = generateICS({
      uid:            `${booking.id}@scheduleit.app`,
      title:          `${eventType.title} with ${data.inviteeName}`,
      description:    data.notes ?? undefined,
      location:       meetingLink ?? undefined,
      startTime,
      endTime,
      organizerName:  hostName,
      organizerEmail: hostEmail ?? "no-reply@scheduleit.app",
      attendeeName:   data.inviteeName,
      attendeeEmail:  data.inviteeEmail,
    });

    sendBookingConfirmationEmails({
      hostName,
      hostEmail,
      inviteeName:     data.inviteeName,
      inviteeEmail:    data.inviteeEmail,
      eventTitle:      eventType.title,
      startTime,
      endTime,
      timezone:        data.inviteeTimezone,
      location:        meetingLink ?? undefined,
      notes:           data.notes ?? null,
      cancelToken,
      rescheduleToken,
      appUrl,
      icsContent,
    }).catch((err) => console.error("[bookings/create] email error:", err));

    return NextResponse.json({
      bookingId: booking.id,
      startTime: booking.startTime.toISOString(),
      endTime:   booking.endTime.toISOString(),
      ...(meetingLink ? { meetLink: meetingLink } : {}),
      ...(meetingId   ? { meetingId }             : {}),
    });

  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      const code = (err as Error & { statusCode: number }).statusCode;
      return NextResponse.json({ error: err.message }, { status: code });
    }
    logError("POST /api/bookings/create", err);
    return NextResponse.json(apiError(err), { status: 500 });
  }
}
