/**
 * Team scheduling engine.
 *
 * Extends the solo scheduling logic for teams:
 *   - ROUND_ROBIN  → union of all members' available slots; host assigned at booking time
 *   - COLLECTIVE   → intersection of all members' slots (everyone must be free)
 */

import { db }             from "./db";
import { generateSlots }  from "./scheduler-core";
import { localToUtc, getDayOfWeek } from "./timezone";
import { getBusyTimes }   from "./google-calendar";

export interface TeamSlot {
  start: string; // UTC ISO
  end:   string; // UTC ISO
}

// ── Per-member slot computation ───────────────────────────────────────────────

interface EventTypeLike {
  duration:        number;
  bufferBefore:    number;
  bufferAfter:     number;
  minNotice:       number;
  availabilityDays: number[];
}

interface MemberSlotsResult {
  slots:           TeamSlot[];
  hasAvailability: boolean; // false = member has no availability rows → skip from collective intersection
}

async function getMemberAvailableSlots(
  userId:    string,
  userTz:    string,
  eventType: EventTypeLike,
  date:      string,
): Promise<MemberSlotsResult> {
  const { duration, bufferBefore, bufferAfter, minNotice, availabilityDays } = eventType;

  const dayOfWeek = getDayOfWeek(date, userTz);
  if (availabilityDays.length > 0 && !availabilityDays.includes(dayOfWeek))
    return { slots: [], hasAvailability: true }; // configured but day blocked

  const [y, mo, d] = date.split("-").map(Number);
  const targetDate = new Date(Date.UTC(y, mo - 1, d));

  const override = await db.availabilityOverride.findFirst({
    where: { userId, date: targetDate },
  });

  let windowStart: Date;
  let windowEnd:   Date;

  if (override) {
    if (override.isBlocked) return { slots: [], hasAvailability: true };
    if (override.startTime && override.endTime) {
      windowStart = localToUtc(date, override.startTime, userTz);
      windowEnd   = localToUtc(date, override.endTime,   userTz);
    } else return { slots: [], hasAvailability: true };
  } else {
    // Check if the member has ANY availability rows configured at all
    const anyAvail = await db.availability.findFirst({ where: { userId } });
    if (!anyAvail) return { slots: [], hasAvailability: false }; // never configured → skip from collective

    const avail = await db.availability.findFirst({ where: { userId, dayOfWeek } });
    if (!avail || !avail.isActive) return { slots: [], hasAvailability: true }; // configured but day off
    windowStart = localToUtc(date, avail.startTime, userTz);
    windowEnd   = localToUtc(date, avail.endTime,   userTz);
  }

  if (windowStart >= windowEnd) return { slots: [], hasAvailability: true };

  const bufferSlack = Math.max(bufferBefore, bufferAfter);
  const queryStart  = new Date(windowStart.getTime() - bufferSlack * 60_000);
  const queryEnd    = new Date(windowEnd.getTime()   + bufferSlack * 60_000);

  const [bookings, googleBusy] = await Promise.all([
    db.booking.findMany({
      where: {
        hostId:    userId,
        status:    { in: ["CONFIRMED", "PENDING"] },
        startTime: { lt: queryEnd  },
        endTime:   { gt: queryStart },
      },
      select: { startTime: true, endTime: true },
    }),
    getBusyTimes(userId, queryStart, queryEnd),
  ]);

  const allBusy = [
    ...bookings.map((b) => ({ startMs: b.startTime.getTime(), endMs: b.endTime.getTime() })),
    ...googleBusy.map((b) => ({ startMs: b.start.getTime(), endMs: b.end.getTime() })),
  ];

  const rawSlots = generateSlots({
    window:           { startMs: windowStart.getTime(), endMs: windowEnd.getTime() },
    duration,
    bufferBefore,
    bufferAfter,
    minNoticeMs:      minNotice * 60_000,
    nowMs:            Date.now(),
    existingBookings: allBusy,
  });

  return {
    slots: rawSlots.map((s) => ({
      start: new Date(s.startMs).toISOString(),
      end:   new Date(s.endMs).toISOString(),
    })),
    hasAvailability: true,
  };
}

// ── Merge helpers ─────────────────────────────────────────────────────────────

function unionSlots(sets: TeamSlot[][]): TeamSlot[] {
  const seen = new Set<string>();
  const result: TeamSlot[] = [];
  for (const slots of sets) {
    for (const slot of slots) {
      if (!seen.has(slot.start)) {
        seen.add(slot.start);
        result.push(slot);
      }
    }
  }
  result.sort((a, b) => a.start.localeCompare(b.start));
  return result;
}

function intersectSlots(sets: TeamSlot[][]): TeamSlot[] {
  if (sets.length === 0) return [];
  let base = sets[0];
  for (let i = 1; i < sets.length; i++) {
    const keys = new Set(sets[i].map((s) => s.start));
    base = base.filter((s) => keys.has(s.start));
  }
  return base;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns available booking slots for a team event type.
 * ROUND_ROBIN → union of all members' slots (anyone is free)
 * COLLECTIVE  → intersection (everyone is free simultaneously)
 */
export async function getTeamAvailableSlots(options: {
  teamEventTypeId: string;
  date:            string;
  timezone:        string;
}): Promise<TeamSlot[]> {
  const { teamEventTypeId, date } = options;

  const eventType = await db.eventType.findUnique({
    where: { id: teamEventTypeId },
    select: {
      id:               true,
      teamId:           true,
      duration:         true,
      bufferBefore:     true,
      bufferAfter:      true,
      minNotice:        true,
      isActive:         true,
      kind:             true,
      availabilityDays: true,
      team: {
        select: {
          members: {
            select: {
              userId: true,
              user:   { select: { timezone: true } },
            },
          },
        },
      },
    },
  });

  if (!eventType?.isActive || !eventType.teamId || !eventType.team) return [];

  const { members } = eventType.team;
  if (members.length === 0) return [];

  const memberResults = await Promise.all(
    members.map((m) =>
      getMemberAvailableSlots(m.userId, m.user.timezone ?? "UTC", eventType, date),
    ),
  );

  if (eventType.kind === "COLLECTIVE") {
    // Only intersect members who actually have availability configured.
    // Members who have never set up availability are treated as "always free"
    // and excluded from blocking the intersection.
    const participating = memberResults.filter((r) => r.hasAvailability);
    if (participating.length === 0) {
      // No one has configured availability — fall back to showing all slots
      // from everyone (same as round-robin union) so the page isn't blank.
      return unionSlots(memberResults.map((r) => r.slots));
    }
    return intersectSlots(participating.map((r) => r.slots));
  }

  return unionSlots(memberResults.map((r) => r.slots));
}

/**
 * Pick the best round-robin host: the available member with the fewest bookings
 * in the rolling 28-day window.  Ties are broken randomly.
 * Returns null if no member is available for the slot.
 */
export async function pickRoundRobinHost(
  teamId:    string,
  slotStart: Date,
  slotEnd:   Date,
): Promise<string | null> {
  const members = await db.teamMember.findMany({
    where:  { teamId },
    select: { userId: true },
  });
  if (members.length === 0) return null;

  const since = new Date(Date.now() - 28 * 24 * 60 * 60_000);

  // Count bookings per member over the rolling window
  const counts = await Promise.all(
    members.map(async (m) => {
      const count = await db.booking.count({
        where: {
          hostId:    m.userId,
          status:    { in: ["CONFIRMED", "PENDING"] },
          startTime: { gte: since },
        },
      });
      return { userId: m.userId, count };
    }),
  );

  // Filter to members with no conflict at this exact slot
  const available: { userId: string; count: number }[] = [];
  await Promise.all(
    counts.map(async (m) => {
      const conflict = await db.booking.findFirst({
        where: {
          hostId:    m.userId,
          status:    { in: ["CONFIRMED", "PENDING"] },
          startTime: { lt: slotEnd  },
          endTime:   { gt: slotStart },
        },
        select: { id: true },
      });
      if (!conflict) available.push(m);
    }),
  );

  if (available.length === 0) return null;

  available.sort((a, b) => a.count - b.count);
  const minCount = available[0].count;
  const tied     = available.filter((c) => c.count === minCount);
  return tied[Math.floor(Math.random() * tied.length)].userId;
}
