/**
 * Scheduling engine — DB-connected orchestrator.
 *
 * Resolves all data from the database, then delegates the pure slot-generation
 * logic to `scheduler-core.ts` for a clean separation of concerns.
 */

import { db }                    from "./db";
import { localToUtc, getDayOfWeek } from "./timezone";
import { generateSlots }          from "./scheduler-core";
import { getBusyTimes }           from "./google-calendar";

export interface SchedulerOptions {
  eventTypeId: string;
  date: string;     // "YYYY-MM-DD" — interpreted in the host's timezone
  timezone: string; // guest/viewer timezone (for context; slots returned as UTC ISO)
}

export interface AvailableSlot {
  start: string; // UTC ISO 8601
  end: string;   // UTC ISO 8601
}

export async function getAvailableSlots(
  options: SchedulerOptions
): Promise<AvailableSlot[]> {
  const { eventTypeId, date } = options;

  // ── 1. Load event type ──────────────────────────────────────────────────────
  const eventType = await db.eventType.findUnique({
    where: { id: eventTypeId },
    select: {
      id: true,
      userId: true,
      duration: true,
      bufferBefore: true,
      bufferAfter: true,
      minNotice: true,
      isActive: true,
      availabilityDays: true,
      user: { select: { timezone: true } },
    },
  });

  if (!eventType || !eventType.isActive) return [];

  const hostTz = eventType.user.timezone || "UTC";
  const { duration, bufferBefore, bufferAfter, minNotice } = eventType;

  // ── 2. Check if this day-of-week is allowed for this event type ─────────────
  const dayOfWeek = getDayOfWeek(date, hostTz);

  if (
    eventType.availabilityDays.length > 0 &&
    !eventType.availabilityDays.includes(dayOfWeek)
  ) {
    return []; // this day is not in the event type's custom day list
  }

  // ── 3. Check availability override for the specific date ────────────────────
  const [y, mo, d] = date.split("-").map(Number);
  const targetDate = new Date(Date.UTC(y, mo - 1, d));

  const override = await db.availabilityOverride.findFirst({
    where: { userId: eventType.userId, date: targetDate },
  });

  let windowStart: Date;
  let windowEnd: Date;

  if (override) {
    if (override.isBlocked) return []; // whole day blocked by override
    if (override.startTime && override.endTime) {
      // Custom hours set via override
      windowStart = localToUtc(date, override.startTime, hostTz);
      windowEnd   = localToUtc(date, override.endTime,   hostTz);
    } else {
      return []; // blocked but no fallback hours
    }
  } else {
    // ── 4. Load weekly availability row ───────────────────────────────────────
    const avail = await db.availability.findFirst({
      where: { userId: eventType.userId, dayOfWeek },
    });

    if (!avail || !avail.isActive) return [];

    windowStart = localToUtc(date, avail.startTime, hostTz);
    windowEnd   = localToUtc(date, avail.endTime,   hostTz);
  }

  if (windowStart >= windowEnd) return [];

  // ── 5. Load existing bookings that could overlap the window ─────────────────
  // Widen the query range by the max buffer to catch bookings just outside the window
  const bufferSlack = Math.max(bufferBefore, bufferAfter);
  const queryStart = new Date(windowStart.getTime() - bufferSlack * 60_000);
  const queryEnd   = new Date(windowEnd.getTime()   + bufferSlack * 60_000);

  const [bookings, googleBusy] = await Promise.all([
    db.booking.findMany({
      where: {
        hostId: eventType.userId,
        status: { in: ["CONFIRMED", "PENDING"] },
        startTime: { lt: queryEnd },
        endTime:   { gt: queryStart },
      },
      select: { startTime: true, endTime: true },
    }),
    // Fetch Google Calendar busy intervals (returns [] when not connected)
    getBusyTimes(eventType.userId, queryStart, queryEnd),
  ]);

  // Merge DB bookings + Google Calendar busy intervals into a single busy list
  const allBusy = [
    ...bookings.map((b) => ({ startMs: b.startTime.getTime(), endMs: b.endTime.getTime() })),
    ...googleBusy.map((b) => ({ startMs: b.start.getTime(), endMs: b.end.getTime() })),
  ];

  // ── 6. Delegate to pure slot-generation engine ──────────────────────────────
  const rawSlots = generateSlots({
    window:    { startMs: windowStart.getTime(), endMs: windowEnd.getTime() },
    duration,
    bufferBefore,
    bufferAfter,
    minNoticeMs: minNotice * 60_000,
    nowMs: Date.now(),
    existingBookings: allBusy,
  });

  return rawSlots.map((s) => ({
    start: new Date(s.startMs).toISOString(),
    end:   new Date(s.endMs).toISOString(),
  }));
}
