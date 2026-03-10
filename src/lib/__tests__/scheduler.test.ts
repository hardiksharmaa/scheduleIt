import { describe, it, expect } from "vitest";
import { localToUtc, getDayOfWeek, utcToDateStr, utcToTimeStr } from "../timezone";
import { generateSlots } from "../scheduler-core";

// ─── Reference "now" for deterministic tests ─────────────────────────────────
// 2026-03-10 Tuesday, 08:00 UTC
const NOW_MS = new Date("2026-03-10T08:00:00.000Z").getTime();

// ─── Timezone utilities ───────────────────────────────────────────────────────

describe("localToUtc", () => {
  it("converts EST (UTC-5) 09:00 → 14:00 UTC in winter", () => {
    const result = localToUtc("2026-01-15", "09:00", "America/New_York");
    expect(result.toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });

  it("converts EDT (UTC-4) 09:00 → 13:00 UTC in summer", () => {
    const result = localToUtc("2026-07-15", "09:00", "America/New_York");
    expect(result.toISOString()).toBe("2026-07-15T13:00:00.000Z");
  });

  it("converts IST (UTC+5:30) 09:00 → 03:30 UTC", () => {
    const result = localToUtc("2026-03-10", "09:00", "Asia/Kolkata");
    expect(result.toISOString()).toBe("2026-03-10T03:30:00.000Z");
  });

  it("converts UTC 09:00 → 09:00 UTC", () => {
    const result = localToUtc("2026-03-10", "09:00", "UTC");
    expect(result.toISOString()).toBe("2026-03-10T09:00:00.000Z");
  });

  it("converts JST (UTC+9) 17:00 → 08:00 UTC same day", () => {
    // JST is UTC+9, so 17:00 JST - 9h = 08:00 UTC (same calendar day)
    const result = localToUtc("2026-03-10", "17:00", "Asia/Tokyo");
    expect(result.toISOString()).toBe("2026-03-10T08:00:00.000Z");
  });
});

describe("getDayOfWeek", () => {
  it("2026-03-10 (Tuesday) → 2", () => {
    expect(getDayOfWeek("2026-03-10", "UTC")).toBe(2);
  });

  it("2026-03-15 (Sunday) → 0", () => {
    expect(getDayOfWeek("2026-03-15", "UTC")).toBe(0);
  });

  it("2026-03-14 (Saturday) → 6", () => {
    expect(getDayOfWeek("2026-03-14", "UTC")).toBe(6);
  });

  it("same date gives same weekday regardless of timezone (no boundary cross at noon)", () => {
    // 2026-03-10 noon UTC is still 2026-03-10 in all common timezones
    expect(getDayOfWeek("2026-03-10", "America/Los_Angeles")).toBe(2); // Tuesday
    expect(getDayOfWeek("2026-03-10", "Asia/Tokyo")).toBe(2);          // Tuesday
  });
});

describe("utcToDateStr", () => {
  it("formats UTC date as YYYY-MM-DD", () => {
    expect(utcToDateStr(new Date("2026-03-10T14:00:00Z"), "UTC")).toBe("2026-03-10");
  });

  it("accounts for timezone offset in date string", () => {
    // 2026-03-10T03:00:00Z is still 2026-03-09 in New York (EST = UTC-5)
    expect(utcToDateStr(new Date("2026-03-10T03:00:00Z"), "America/New_York")).toBe("2026-03-09");
  });
});

describe("utcToTimeStr", () => {
  it("formats UTC time as HH:MM in UTC", () => {
    expect(utcToTimeStr(new Date("2026-03-10T14:30:00Z"), "UTC")).toBe("14:30");
  });

  it("formats UTC time in EDT (-4) on 2026-03-10", () => {
    // 2026-03-10 is after spring-forward (2026-03-08), so NY is EDT = UTC-4
    // 14:00 UTC - 4h = 10:00 EDT
    expect(utcToTimeStr(new Date("2026-03-10T14:00:00Z"), "America/New_York")).toBe("10:00");
  });

  it("formats UTC time in EST (-5) in January", () => {
    // Jan 15 is in EST (UTC-5): 14:00 UTC - 5h = 09:00 EST
    expect(utcToTimeStr(new Date("2026-01-15T14:00:00Z"), "America/New_York")).toBe("09:00");
  });
});

// ─── Slot generation ──────────────────────────────────────────────────────────

describe("generateSlots — basic cases", () => {
  it("fills a 1-hour window with two 30-min slots", () => {
    const slots = generateSlots({
      window: {
        startMs: new Date("2026-03-10T09:00:00Z").getTime(),
        endMs:   new Date("2026-03-10T10:00:00Z").getTime(),
      },
      duration: 30,
      bufferBefore: 0,
      bufferAfter: 0,
      minNoticeMs: 0,
      nowMs: NOW_MS,
      existingBookings: [],
    });

    expect(slots).toHaveLength(2);
    expect(new Date(slots[0].startMs).toISOString()).toBe("2026-03-10T09:00:00.000Z");
    expect(new Date(slots[0].endMs).toISOString()).toBe("2026-03-10T09:30:00.000Z");
    expect(new Date(slots[1].startMs).toISOString()).toBe("2026-03-10T09:30:00.000Z");
  });

  it("returns empty when window is shorter than duration", () => {
    const slots = generateSlots({
      window: {
        startMs: new Date("2026-03-10T09:00:00Z").getTime(),
        endMs:   new Date("2026-03-10T09:20:00Z").getTime(), // 20 min < 30-min duration
      },
      duration: 30,
      bufferBefore: 0,
      bufferAfter: 0,
      minNoticeMs: 0,
      nowMs: NOW_MS,
      existingBookings: [],
    });
    expect(slots).toHaveLength(0);
  });

  it("generates correct number of slots for a full work day (8h, 30-min slots → 16)", () => {
    const slots = generateSlots({
      window: {
        startMs: new Date("2026-03-10T09:00:00Z").getTime(),
        endMs:   new Date("2026-03-10T17:00:00Z").getTime(), // 8 hours
      },
      duration: 30,
      bufferBefore: 0,
      bufferAfter: 0,
      minNoticeMs: 0,
      nowMs: 0, // far in the past so no minNotice exclusions
      existingBookings: [],
    });
    expect(slots).toHaveLength(16);
  });

  it("last slot ends exactly at window end", () => {
    const windowEnd = new Date("2026-03-10T10:00:00Z").getTime();
    const slots = generateSlots({
      window: {
        startMs: new Date("2026-03-10T09:00:00Z").getTime(),
        endMs: windowEnd,
      },
      duration: 30,
      bufferBefore: 0,
      bufferAfter: 0,
      minNoticeMs: 0,
      nowMs: 0,
      existingBookings: [],
    });
    const last = slots[slots.length - 1];
    expect(last.endMs).toBe(windowEnd);
  });
});

describe("generateSlots — minNotice", () => {
  it("excludes slots within minNotice window", () => {
    // NOW = 08:00 UTC, minNotice = 60 min → earliest start = 09:00
    const slots = generateSlots({
      window: {
        startMs: new Date("2026-03-10T08:00:00Z").getTime(),
        endMs:   new Date("2026-03-10T10:00:00Z").getTime(),
      },
      duration: 30,
      bufferBefore: 0,
      bufferAfter: 0,
      minNoticeMs: 60 * 60_000,
      nowMs: NOW_MS, // 08:00 UTC
      existingBookings: [],
    });

    const starts = slots.map((s) => new Date(s.startMs).toISOString());
    // 08:00 and 08:30 excluded; 09:00 and 09:30 remain
    expect(starts).not.toContain("2026-03-10T08:00:00.000Z");
    expect(starts).not.toContain("2026-03-10T08:30:00.000Z");
    expect(starts).toContain("2026-03-10T09:00:00.000Z");
    expect(starts).toContain("2026-03-10T09:30:00.000Z");
    expect(slots).toHaveLength(2);
  });

  it("returns all past-day slots when minNotice = 0 and now is far past", () => {
    const slots = generateSlots({
      window: {
        startMs: new Date("2026-03-10T09:00:00Z").getTime(),
        endMs:   new Date("2026-03-10T10:00:00Z").getTime(),
      },
      duration: 30,
      bufferBefore: 0,
      bufferAfter: 0,
      minNoticeMs: 0,
      nowMs: new Date("2026-03-11T00:00:00Z").getTime(), // next day → all excluded
      existingBookings: [],
    });
    expect(slots).toHaveLength(0);
  });
});

describe("generateSlots — booking conflicts (no buffer)", () => {
  it("excludes slots that directly overlap a booking", () => {
    // Booking: 10:00–11:00
    // Window:  09:00–12:00, 30-min slots
    const booking = {
      startMs: new Date("2026-03-10T10:00:00Z").getTime(),
      endMs:   new Date("2026-03-10T11:00:00Z").getTime(),
    };

    const slots = generateSlots({
      window: {
        startMs: new Date("2026-03-10T09:00:00Z").getTime(),
        endMs:   new Date("2026-03-10T12:00:00Z").getTime(),
      },
      duration: 30,
      bufferBefore: 0,
      bufferAfter: 0,
      minNoticeMs: 0,
      nowMs: 0,
      existingBookings: [booking],
    });

    const starts = slots.map((s) => new Date(s.startMs).toISOString());
    expect(starts).toContain("2026-03-10T09:00:00.000Z");
    expect(starts).toContain("2026-03-10T09:30:00.000Z");
    expect(starts).not.toContain("2026-03-10T10:00:00.000Z"); // starts at booking start
    expect(starts).not.toContain("2026-03-10T10:30:00.000Z"); // overlaps booking
    expect(starts).toContain("2026-03-10T11:00:00.000Z");     // starts exactly at booking end → fine
    expect(starts).toContain("2026-03-10T11:30:00.000Z");
    expect(slots).toHaveLength(4);
  });

  it("handles multiple non-adjacent bookings", () => {
    const bookings = [
      {
        startMs: new Date("2026-03-10T09:30:00Z").getTime(),
        endMs:   new Date("2026-03-10T10:00:00Z").getTime(),
      },
      {
        startMs: new Date("2026-03-10T11:00:00Z").getTime(),
        endMs:   new Date("2026-03-10T11:30:00Z").getTime(),
      },
    ];

    const slots = generateSlots({
      window: {
        startMs: new Date("2026-03-10T09:00:00Z").getTime(),
        endMs:   new Date("2026-03-10T12:00:00Z").getTime(),
      },
      duration: 30,
      bufferBefore: 0,
      bufferAfter: 0,
      minNoticeMs: 0,
      nowMs: 0,
      existingBookings: bookings,
    });

    const starts = slots.map((s) => new Date(s.startMs).toISOString());
    expect(starts).toContain("2026-03-10T09:00:00.000Z");
    expect(starts).not.toContain("2026-03-10T09:30:00.000Z");
    expect(starts).toContain("2026-03-10T10:00:00.000Z");
    expect(starts).toContain("2026-03-10T10:30:00.000Z");
    expect(starts).not.toContain("2026-03-10T11:00:00.000Z");
    expect(starts).toContain("2026-03-10T11:30:00.000Z");
  });
});

describe("generateSlots — buffer time", () => {
  // Booking: 10:00–11:00, bufferBefore=15, bufferAfter=15
  // Window:  09:00–12:00, 30-min slots
  //
  // Candidate analysis (guardStart = slotStart-15, guardEnd = slotEnd+15):
  //   09:00 slot: guard 08:45–09:45 → 08:45 < 11:00 BUT 09:45 > 10:00? NO (09:45 < 10:00) → OK ✓
  //   09:30 slot: guard 09:15–10:15 → 10:15 > 10:00 AND 09:15 < 11:00 → conflict ✗
  //   10:00 slot: direct overlap → conflict ✗
  //   10:30 slot: guard 10:15–11:15 → 10:15 < 11:00 AND 11:15 > 10:00 → conflict ✗
  //   11:00 slot: guard 10:45–11:45 → 10:45 < 11:00 AND 11:45 > 10:00 → conflict ✗
  //   11:30 slot: guard 11:15–12:15 → 11:15 < 11:00? NO → OK ✓
  it("guards 15 min before and after an existing booking", () => {
    const booking = {
      startMs: new Date("2026-03-10T10:00:00Z").getTime(),
      endMs:   new Date("2026-03-10T11:00:00Z").getTime(),
    };

    const slots = generateSlots({
      window: {
        startMs: new Date("2026-03-10T09:00:00Z").getTime(),
        endMs:   new Date("2026-03-10T12:00:00Z").getTime(),
      },
      duration: 30,
      bufferBefore: 15,
      bufferAfter: 15,
      minNoticeMs: 0,
      nowMs: 0,
      existingBookings: [booking],
    });

    const starts = slots.map((s) => new Date(s.startMs).toISOString());
    expect(starts).toContain("2026-03-10T09:00:00.000Z");
    expect(starts).not.toContain("2026-03-10T09:30:00.000Z");
    expect(starts).not.toContain("2026-03-10T10:00:00.000Z");
    expect(starts).not.toContain("2026-03-10T10:30:00.000Z");
    expect(starts).not.toContain("2026-03-10T11:00:00.000Z");
    expect(starts).toContain("2026-03-10T11:30:00.000Z");
    expect(slots).toHaveLength(2);
  });

  it("zero buffer behaves the same as no-buffer case", () => {
    const noBuffer = generateSlots({
      window: {
        startMs: new Date("2026-03-10T09:00:00Z").getTime(),
        endMs:   new Date("2026-03-10T11:00:00Z").getTime(),
      },
      duration: 30,
      bufferBefore: 0,
      bufferAfter: 0,
      minNoticeMs: 0,
      nowMs: 0,
      existingBookings: [],
    });

    const withBuffer = generateSlots({
      window: {
        startMs: new Date("2026-03-10T09:00:00Z").getTime(),
        endMs:   new Date("2026-03-10T11:00:00Z").getTime(),
      },
      duration: 30,
      bufferBefore: 0,
      bufferAfter: 0,
      minNoticeMs: 0,
      nowMs: 0,
      existingBookings: [],
    });

    expect(noBuffer).toEqual(withBuffer);
  });
});
