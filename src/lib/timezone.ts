/**
 * Timezone utilities — pure functions, no external dependencies.
 * Uses the Intl API available in all modern Node.js runtimes.
 */

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Convert a local date + time string to a UTC Date using the IANA timezone.
 * Uses a two-pass approach to handle DST boundary edge cases correctly.
 *
 * @param dateStr "YYYY-MM-DD"  (in localTz)
 * @param timeStr "HH:MM"       (in localTz)
 * @param tz      IANA timezone, e.g. "America/New_York"
 */
export function localToUtc(dateStr: string, timeStr: string, tz: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);

  // The desired local time expressed as a Date.UTC reference
  const desiredMs = Date.UTC(y, mo - 1, d, h, mi, 0);

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Resolve the full local-datetime that a given UTC instant maps to in `tz`,
  // then express that as a Date.UTC value so we can diff it vs desiredMs.
  const getMappedMs = (utcDate: Date): number => {
    const parts = Object.fromEntries(
      fmt.formatToParts(utcDate).map((p) => [p.type, p.value])
    );
    return Date.UTC(
      parseInt(parts.year),
      parseInt(parts.month) - 1,
      parseInt(parts.day),
      parseInt(parts.hour) % 24, // guard "24:00" edge case
      parseInt(parts.minute),
      0
    );
  };

  // Use desiredMs as a starting UTC reference
  const ref = new Date(desiredMs);

  // Pass 1: compute the difference between what we want and what the ref maps to
  const diff1 = desiredMs - getMappedMs(ref);
  const step1 = new Date(ref.getTime() + diff1);

  // Pass 2: correct any remaining off-by-1h DST boundary error
  const diff2 = desiredMs - getMappedMs(step1);
  return new Date(step1.getTime() + diff2);
}

/**
 * Get day-of-week (0=Sun … 6=Sat) for a date string in a specific timezone.
 * Uses noon UTC to avoid date-line crossing issues.
 */
export function getDayOfWeek(dateStr: string, tz: string): number {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const noon = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  });
  const dayStr = formatter.format(noon); // "Sun", "Mon", …
  const idx = DAYS_SHORT.indexOf(dayStr);
  return idx === -1 ? 0 : idx;
}

/**
 * Format a UTC Date as "YYYY-MM-DD" in a given timezone.
 */
export function utcToDateStr(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Format a UTC Date as "HH:MM" in a given timezone.
 */
export function utcToTimeStr(date: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  const h = parseInt(parts.hour) % 24;
  return `${String(h).padStart(2, "0")}:${parts.minute}`;
}
