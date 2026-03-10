import "@/lib/env";
import { NextRequest, NextResponse }   from "next/server";
import { randomBytes }                  from "crypto";
import { z }                            from "zod";
import { db }                           from "@/lib/db";
import { createCalendarEvent }          from "@/lib/google-calendar";
import { createZoomMeeting }            from "@/lib/zoom";
import { createTeamsMeeting }           from "@/lib/teams";
import { sendBookingConfirmationEmails } from "@/lib/email";
import { pickRoundRobinHost }           from "@/lib/team-scheduler";
import { generateICS }                  from "@/lib/ics";
import { apiError, logError }           from "@/lib/apiError";

/**
 * POST /api/bookings/create/team
 *
 * Public — no auth required.
 * Creates a booking for a team event type.
 *   ROUND_ROBIN → picks the member with fewest recent bookings who is free at the slot.
 *   COLLECTIVE  → all members must be free; team owner is recorded as hostId.
 */

const bodySchema = z.object({
  teamEventTypeId: z.string().min(1),
  inviteeName:     z.string().min(1).max(200),
  inviteeEmail:    z.string().email(),
  inviteeTimezone: z.string().default("UTC"),
  startTime:       z.string().datetime(),
  notes:           z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const raw    = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

    const data = parsed.data;

    // ── Load event type + team ──────────────────────────────────────────────
    const eventType = await db.eventType.findUnique({
      where: { id: data.teamEventTypeId },
      select: {
        id: true, userId: true, teamId: true, title: true, duration: true,
        isActive: true, locationType: true, kind: true,
        user: { select: { name: true, email: true } },
        team: {
          select: {
            id: true, name: true, ownerId: true,
            members: {
              select: {
                userId: true,
                user:   { select: { name: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!eventType?.isActive || !eventType.teamId || !eventType.team)
      return NextResponse.json({ error: "Event type not found or inactive" }, { status: 404 });

    const startTime = new Date(data.startTime);
    const endTime   = new Date(startTime.getTime() + eventType.duration * 60_000);

    try {
      Intl.DateTimeFormat(undefined, { timeZone: data.inviteeTimezone });
    } catch {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }

    if (startTime.getTime() <= Date.now())
      return NextResponse.json({ error: "Cannot book a slot in the past" }, { status: 400 });

    // ── Assign host ─────────────────────────────────────────────────────────
    let hostId: string;

    if (eventType.kind === "ROUND_ROBIN") {
      const rr = await pickRoundRobinHost(eventType.teamId, startTime, endTime);
      if (!rr)
        return NextResponse.json({ error: "No team member is available for this slot" }, { status: 409 });
      hostId = rr;
    } else {
      // COLLECTIVE: all members must be free; use team owner as the booking's hostId
      hostId = eventType.team.ownerId;
      for (const m of eventType.team.members) {
        const conflict = await db.booking.findFirst({
          where: {
            hostId:    m.userId,
            status:    { in: ["CONFIRMED", "PENDING"] },
            startTime: { lt: endTime  },
            endTime:   { gt: startTime },
          },
          select: { id: true },
        });
        if (conflict)
          return NextResponse.json({ error: "A team member is no longer available for this slot" }, { status: 409 });
      }
    }

    // ── Atomic: duplicate-check + conflict-check + create ───────────────────
    const cancelToken     = randomBytes(24).toString("hex");
    const rescheduleToken = randomBytes(24).toString("hex");

    const booking = await db.$transaction(async (tx) => {
      // 1. Duplicate guard
      const duplicate = await tx.booking.findFirst({
        where: {
          eventTypeId:  data.teamEventTypeId,
          inviteeEmail: data.inviteeEmail,
          status:       { in: ["CONFIRMED", "PENDING"] },
        },
        select: { id: true },
      });
      if (duplicate)
        throw Object.assign(new Error("You already have a booking for this event"), { statusCode: 409 });

      // 2. Final conflict guard for the assigned host
      const conflict = await tx.booking.findFirst({
        where: {
          hostId,
          status:    { in: ["CONFIRMED", "PENDING"] },
          startTime: { lt: endTime   },
          endTime:   { gt: startTime },
        },
        select: { id: true },
      });
      if (conflict)
        throw Object.assign(new Error("Slot just became unavailable"), { statusCode: 409 });

      // 3. Create
      return tx.booking.create({
        data: {
          eventTypeId:     data.teamEventTypeId,
          hostId,
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

    // ── Meeting link ────────────────────────────────────────────────────────
    // Always use the team owner's integrations (eventType.userId), since only
    // the owner has OAuth tokens for Google Calendar / Zoom / Teams.
    // The assigned hostId is used only for conflict-checking / round-robin.
    let meetingLink:     string | null = null;
    let meetingId:       string | null = null;
    let calendarEventId: string | null = null;

    const integrationUserId = eventType.userId; // team owner — has integrations
    const hostMember = eventType.team.members.find((m) => m.userId === hostId);
    const hostUser   = hostMember?.user ?? eventType.user;

    const wantsMeetLink = eventType.locationType === "GOOGLE_MEET";
    const gcal = await createCalendarEvent(integrationUserId, {
      title:         `${eventType.title} with ${data.inviteeName}`,
      description:   data.notes,
      startTime,
      endTime,
      attendeeEmail: data.inviteeEmail,
      attendeeName:  data.inviteeName,
      addMeetLink:   wantsMeetLink,
    });
    calendarEventId = gcal.calendarEventId ?? null;
    if (wantsMeetLink && gcal.meetLink) meetingLink = gcal.meetLink;

    if (eventType.locationType === "ZOOM") {
      try {
        const zm = await createZoomMeeting(
          integrationUserId, `${eventType.title} with ${data.inviteeName}`, startTime, eventType.duration,
        );
        meetingLink = zm.joinUrl;
        meetingId   = zm.meetingId;
      } catch (err) {
        console.warn("[bookings/create/team] Zoom failed:", err);
      }
    }

    if (eventType.locationType === "TEAMS") {
      try {
        const tm = await createTeamsMeeting(
          integrationUserId, `${eventType.title} with ${data.inviteeName}`, startTime, endTime,
        );
        meetingLink = tm.joinUrl;
        meetingId   = tm.meetingId;
      } catch (err) {
        console.warn("[bookings/create/team] Teams failed:", err);
      }
    }

    if (calendarEventId || meetingLink || meetingId) {
      await db.booking.update({
        where: { id: booking.id },
        data: {
          calendarEventId: calendarEventId ?? undefined,
          location:        meetingLink     ?? undefined,
          meetingId:       meetingId       ?? undefined,
        },
      });
    }

    // ── Confirmation emails ─────────────────────────────────────────────────
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const teamName = eventType.team.name;
    const hostName = hostUser.name ? `${hostUser.name} (${teamName})` : teamName;

    // Generate ICS attachment for the guest confirmation email
    const icsContent = generateICS({
      uid:            `${booking.id}@scheduleit.app`,
      title:          `${eventType.title} with ${data.inviteeName}`,
      description:    data.notes ?? undefined,
      location:       meetingLink ?? undefined,
      startTime,
      endTime,
      organizerName:  hostName,
      organizerEmail: hostUser.email ?? "no-reply@scheduleit.app",
      attendeeName:   data.inviteeName,
      attendeeEmail:  data.inviteeEmail,
    });

    sendBookingConfirmationEmails({
      hostName,
      hostEmail:       hostUser.email,
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
    }).catch((err) => console.error("[bookings/create/team] email error:", err));

    return NextResponse.json({
      bookingId:      booking.id,
      startTime:      booking.startTime.toISOString(),
      endTime:        booking.endTime.toISOString(),
      assignedHostId: hostId,
      ...(meetingLink ? { meetLink: meetingLink } : {}),
      ...(meetingId   ? { meetingId }             : {}),
    });

  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      const code = (err as Error & { statusCode: number }).statusCode;
      return NextResponse.json({ error: err.message }, { status: code });
    }
    logError("POST /api/bookings/create/team", err);
    return NextResponse.json(apiError(err), { status: 500 });
  }
}
