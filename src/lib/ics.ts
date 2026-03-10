/**
 * Minimal RFC 5545 iCalendar (.ics) generator.
 * No external dependencies — pure string building.
 */

export interface ICSParams {
  uid:             string; // unique ID, e.g. booking ID + "@scheduleit.app"
  title:           string;
  description?:    string | null;
  location?:       string | null;
  startTime:       Date;
  endTime:         Date;
  organizerName:   string;
  organizerEmail:  string;
  attendeeName:    string;
  attendeeEmail:   string;
}

/** Format a Date as iCal UTC timestamp: `YYYYMMDDTHHMMSSZ` */
function icalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Fold long lines at 75 octets as required by RFC 5545 §3.1 */
function foldLine(s: string): string {
  const max = 75;
  if (s.length <= max) return s;
  let out = s.slice(0, max);
  let rest = s.slice(max);
  while (rest.length > 0) {
    out += "\r\n " + rest.slice(0, max - 1);
    rest = rest.slice(max - 1);
  }
  return out;
}

/** Escape text fields per RFC 5545 §3.3.11 */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function generateICS(p: ICSParams): string {
  const stamp = icalDate(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ScheduleIt//ScheduleIt//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    foldLine(`UID:${p.uid}`),
    foldLine(`DTSTAMP:${stamp}`),
    foldLine(`DTSTART:${icalDate(p.startTime)}`),
    foldLine(`DTEND:${icalDate(p.endTime)}`),
    foldLine(`SUMMARY:${esc(p.title)}`),
  ];

  if (p.description) {
    lines.push(foldLine(`DESCRIPTION:${esc(p.description)}`));
  }
  if (p.location) {
    lines.push(foldLine(`LOCATION:${esc(p.location)}`));
  }

  lines.push(
    foldLine(`ORGANIZER;CN=${esc(p.organizerName)}:mailto:${p.organizerEmail}`),
    foldLine(`ATTENDEE;CN=${esc(p.attendeeName)};RSVP=TRUE;PARTSTAT=NEEDS-ACTION;ROLE=REQ-PARTICIPANT:mailto:${p.attendeeEmail}`),
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  );

  // iCal requires CRLF line endings
  return lines.join("\r\n");
}
