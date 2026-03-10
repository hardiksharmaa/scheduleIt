/**
 * Pure, DB-free scheduling logic.
 * All inputs are pre-resolved; this function only performs algorithmic work.
 * This makes it 100% unit-testable without any database or network calls.
 */

export interface AvailabilityWindow {
  startMs: number; // UTC epoch ms — start of availability window
  endMs: number;   // UTC epoch ms — end of availability window
}

export interface ExistingBooking {
  startMs: number; // UTC epoch ms
  endMs: number;   // UTC epoch ms
}

export interface SlotGenerationOptions {
  window: AvailabilityWindow;
  duration: number;       // slot duration in minutes
  bufferBefore: number;   // minutes of free time required BEFORE each slot
  bufferAfter: number;    // minutes of free time required AFTER each slot
  minNoticeMs: number;    // minimum notice required (ms); slots before now+minNotice are excluded
  nowMs: number;          // current time in epoch ms (injected for testability)
  existingBookings: ExistingBooking[];
}

export interface RawSlot {
  startMs: number;
  endMs: number;
}

/**
 * Generate available booking slots.
 *
 * Algorithm:
 *   1. Iterate the availability window in `duration`-minute steps.
 *   2. Discard slots that start before (now + minNotice).
 *   3. For each candidate slot, expand it by bufferBefore and bufferAfter
 *      to form a "guard zone", then discard if any existing booking overlaps
 *      the guard zone.
 *   4. Return surviving slots.
 */
export function generateSlots(opts: SlotGenerationOptions): RawSlot[] {
  const {
    window,
    duration,
    bufferBefore,
    bufferAfter,
    minNoticeMs,
    nowMs,
    existingBookings,
  } = opts;

  const durationMs = duration * 60_000;
  const bufBeforeMs = bufferBefore * 60_000;
  const bufAfterMs = bufferAfter * 60_000;
  const earliestStartMs = nowMs + minNoticeMs;

  const slots: RawSlot[] = [];
  let cursor = window.startMs;

  while (cursor + durationMs <= window.endMs) {
    const slotStartMs = cursor;
    const slotEndMs = cursor + durationMs;

    if (slotStartMs >= earliestStartMs) {
      // Expand by buffers to form the guard zone
      const guardStart = slotStartMs - bufBeforeMs;
      const guardEnd = slotEndMs + bufAfterMs;

      const hasConflict = existingBookings.some(
        (b) => guardStart < b.endMs && guardEnd > b.startMs
      );

      if (!hasConflict) {
        slots.push({ startMs: slotStartMs, endMs: slotEndMs });
      }
    }

    cursor += durationMs;
  }

  return slots;
}
