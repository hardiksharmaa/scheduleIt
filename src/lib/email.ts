/**
 * Email service — sends transactional emails via SMTP (Nodemailer).
 *
 * Required env vars:
 *   EMAIL_USER  — the Gmail (or SMTP) address to send from
 *   EMAIL_PASS  — Gmail App Password  (Settings → Security → App Passwords)
 *
 * Optional:
 *   EMAIL_HOST  — SMTP host (default: smtp.gmail.com)
 *   EMAIL_PORT  — SMTP port (default: 587)
 *
 * Falls back gracefully (console log only) when not set — booking is never blocked.
 *
 * Templates:
 *  - Booking confirmation (host + guest)
 *  - Booking reminder (1 h before)
 *  - Cancellation notice
 *  - Reschedule confirmation
 */

import nodemailer from "nodemailer";

// ── Transporter (lazily created) ──────────────────────────────────────────────

let _transporter: nodemailer.Transporter | null | undefined;

function getTransporter(): nodemailer.Transporter | null {
  if (_transporter !== undefined) return _transporter;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    console.warn("[email] EMAIL_USER / EMAIL_PASS not configured — emails disabled");
    _transporter = null;
    return null;
  }
  _transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST ?? "smtp.gmail.com",
    port:   Number(process.env.EMAIL_PORT ?? "587"),
    secure: false,
    auth:   { user, pass },
  });
  return _transporter;
}

// ── Low-level SMTP sender ─────────────────────────────────────────────────────

async function sendEmail(
  to:       string,
  subject:  string,
  html:     string,
  fromName?: string,
  attachments?: nodemailer.SendMailOptions["attachments"],
): Promise<boolean> {
  if (!to) return false;
  try {
    const transporter = getTransporter();
    if (!transporter) {
      console.log(`[email] skipping — no SMTP transporter configured`);
      return false;
    }
    const user = process.env.EMAIL_USER!;
    const from = fromName ? `${fromName} <${user}>` : user;
    await transporter.sendMail({ from, to, subject, html, attachments });
    console.log(`[email] sent "${subject}" → ${to}`);
    return true;
  } catch (err) {
    console.error("[email] sendEmail failed:", err);
    return false;
  }
}

// ── Date formatting helpers ───────────────────────────────────────────────────

function formatDate(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday:  "long",
    month:    "long",
    day:      "numeric",
    year:     "numeric",
  }).format(date);
}

function formatTime(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour:     "numeric",
    minute:   "2-digit",
    hour12:   true,
  }).format(date);
}

function tzAbbr(tz: string): string {
  // Extract timezone abbreviation like "EST" / "PST" from Intl
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone:     tz,
    timeZoneName: "short",
  }).formatToParts(new Date());
  return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
}

// ── Shared layout wrapper ─────────────────────────────────────────────────────

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ScheduleIt</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <!-- Card -->
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header bar -->
          <tr>
            <td style="background:#0c0c0c;padding:24px 32px;">
              <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">ScheduleIt</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f8f8;border-top:1px solid #e8e8e8;padding:20px 32px;">
              <p style="margin:0;font-size:12px;color:#999999;line-height:1.6;">
                Sent by <a href="https://scheduleit.app" style="color:#c4956a;text-decoration:none;">ScheduleIt</a>.
                You are receiving this email because a meeting was scheduled using your ScheduleIt link.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function detailRow(icon: string, label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;vertical-align:top;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:28px;padding-top:1px;vertical-align:top;font-size:15px;">${icon}</td>
          <td>
            <div style="font-size:12px;color:#999;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">${label}</div>
            <div style="font-size:14px;color:#111;margin-top:2px;font-weight:500;">${value}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

// ── Template: Booking confirmation (guest) ────────────────────────────────────

export interface BookingEmailParams {
  hostName:       string;
  hostEmail:      string | null;
  inviteeName:    string;
  inviteeEmail:   string;
  eventTitle:     string;
  startTime:      Date;
  endTime:        Date;
  timezone:       string;
  location?:      string;
  notes?:         string | null;
  cancelToken?:   string | null;
  rescheduleToken?: string | null;
  appUrl:         string;
  /** Raw ICS file content to attach to the guest confirmation email */
  icsContent?:    string | null;
}

function bookingConfirmationGuestHtml(p: BookingEmailParams): string {
  const dateStr  = formatDate(p.startTime, p.timezone);
  const fromStr  = formatTime(p.startTime, p.timezone);
  const toStr    = formatTime(p.endTime,   p.timezone);
  const tz       = tzAbbr(p.timezone);

  const cancelLink     = p.cancelToken
    ? `${p.appUrl}/cancel?token=${p.cancelToken}` : null;
  const rescheduleLink = p.rescheduleToken
    ? `${p.appUrl}/reschedule?token=${p.rescheduleToken}` : null;

  const body = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111;">Meeting confirmed ✓</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#555;">
      Hi ${p.inviteeName}, your meeting with <strong style="color:#111;">${p.hostName}</strong> is booked.
    </p>

    <!-- Details card -->
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
      <tr><td>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding-bottom:12px;border-bottom:1px solid #e8e8e8;margin-bottom:12px;">
              <div style="font-size:11px;color:#aaa;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;">Event</div>
              <div style="font-size:18px;font-weight:700;color:#111;margin-top:4px;">${p.eventTitle}</div>
            </td>
          </tr>
          <tr><td style="padding-top:12px;">
            <table cellpadding="0" cellspacing="0" width="100%">
              ${detailRow("📅", "Date", dateStr)}
              ${detailRow("🕐", "Time", `${fromStr} – ${toStr} ${tz}`)}
              ${p.location ? detailRow("🎥", "Meeting link", `<a href="${p.location}" style="color:#1a73e8;font-weight:600;">${p.location}</a>`) : ""}
              ${p.notes ? detailRow("📝", "Notes", p.notes) : ""}
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>

    ${p.location ? `
    <div style="margin-bottom:20px;">
      <a href="${p.location}" style="display:inline-block;padding:10px 22px;background:#1a73e8;color:#ffffff;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;">
        🎥 Join Meeting
      </a>
      <div style="margin-top:6px;font-size:11px;color:#aaa;word-break:break-all;">${p.location}</div>
    </div>
    ` : ""}

    ${cancelLink || rescheduleLink ? `
    <p style="margin:0 0 12px;font-size:13px;color:#777;">Need to change your plans?</p>
    <table cellpadding="0" cellspacing="0">
      <tr>
        ${rescheduleLink ? `<td style="padding-right:8px;"><a href="${rescheduleLink}" style="display:inline-block;padding:9px 18px;background:#111;color:#fff;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">Reschedule</a></td>` : ""}
        ${cancelLink ? `<td><a href="${cancelLink}" style="display:inline-block;padding:9px 18px;background:#fff;border:1px solid #ddd;color:#555;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">Cancel</a></td>` : ""}
      </tr>
    </table>
    ` : ""}
  `;
  return emailWrapper(body);
}

function bookingConfirmationHostHtml(p: BookingEmailParams): string {
  const dateStr = formatDate(p.startTime, p.timezone);
  const fromStr = formatTime(p.startTime, p.timezone);
  const toStr   = formatTime(p.endTime,   p.timezone);
  const tz      = tzAbbr(p.timezone);

  const body = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111;">New booking received</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#555;">
      <strong style="color:#111;">${p.inviteeName}</strong> booked
      <strong style="color:#c4956a;">${p.eventTitle}</strong> with you.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
      <tr><td>
        <table cellpadding="0" cellspacing="0" width="100%">
          ${detailRow("👤", "Guest", `${p.inviteeName} &lt;${p.inviteeEmail}&gt;`)}
          ${detailRow("📅", "Date", dateStr)}
          ${detailRow("🕐", "Time", `${fromStr} – ${toStr} ${tz}`)}
          ${p.location ? detailRow("📍", "Meeting link", `<a href="${p.location}" style="color:#1a73e8;font-weight:600;">${p.location}</a>`) : ""}
          ${p.notes ? detailRow("📝", "Guest notes", p.notes) : ""}
        </table>
      </td></tr>
    </table>

    ${p.location ? `
    <div style="margin-bottom:20px;">
      <a href="${p.location}" style="display:inline-block;padding:10px 22px;background:#1a73e8;color:#ffffff;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;">
        🎥 Join Meeting
      </a>
      <div style="margin-top:6px;font-size:11px;color:#aaa;word-break:break-all;">${p.location}</div>
    </div>
    ` : ""}

    <a href="${p.appUrl}/dashboard/bookings"
      style="display:inline-block;padding:10px 20px;background:#c4956a;color:#000;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;">
      View in Dashboard →
    </a>
  `;
  return emailWrapper(body);
}

// ── Template: Booking reminder ────────────────────────────────────────────────

export interface ReminderEmailParams {
  hostName:      string;
  inviteeName:   string;
  inviteeEmail:  string;
  eventTitle:    string;
  startTime:     Date;
  endTime:       Date;
  timezone:      string;
  location?:     string;
  cancelToken?:  string | null;
  appUrl:        string;
}

export function reminderEmailHtml(p: ReminderEmailParams): string {
  const dateStr = formatDate(p.startTime, p.timezone);
  const fromStr = formatTime(p.startTime, p.timezone);
  const toStr   = formatTime(p.endTime,   p.timezone);
  const tz      = tzAbbr(p.timezone);

  const body = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111;">Your meeting is in 1 hour ⏰</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#555;">
      Just a reminder about your upcoming meeting with <strong style="color:#111;">${p.hostName}</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
      <tr><td>
        <table cellpadding="0" cellspacing="0" width="100%">
          ${detailRow("📌", "Event", `<strong>${p.eventTitle}</strong>`)}
          ${detailRow("📅", "Date", dateStr)}
          ${detailRow("🕐", "Time", `${fromStr} – ${toStr} ${tz}`)}
          ${p.location ? detailRow("📍", "Join link", `<a href="${p.location}" style="color:#c4956a;font-weight:600;">Join meeting</a>`) : ""}
        </table>
      </td></tr>
    </table>

    ${p.location ? `
    <a href="${p.location}" style="display:inline-block;padding:10px 20px;background:#c4956a;color:#000;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;">
      Join Meeting →
    </a>` : ""}
  `;
  return emailWrapper(body);
}

// ── Template: Cancellation ────────────────────────────────────────────────────

export interface CancellationEmailParams {
  hostName:     string;
  inviteeName:  string;
  inviteeEmail: string;
  eventTitle:   string;
  startTime:    Date;
  timezone:     string;
  cancelledBy:  "host" | "invitee";
  reason?:      string | null;
  appUrl:       string;
}

export function cancellationEmailHtml(
  p: CancellationEmailParams,
  recipient: "host" | "guest",
): string {
  const dateStr   = formatDate(p.startTime, p.timezone);
  const fromStr   = formatTime(p.startTime, p.timezone);
  const tz        = tzAbbr(p.timezone);
  const cancelledByLabel = p.cancelledBy === "host" ? p.hostName : p.inviteeName;

  const isHost = recipient === "host";
  const headline = isHost
    ? `${p.inviteeName} cancelled their booking`
    : `Your meeting has been cancelled`;
  const subtext = isHost
    ? `${p.inviteeName} cancelled the booking for <strong>${p.eventTitle}</strong>.`
    : `<strong>${cancelledByLabel}</strong> cancelled your <strong>${p.eventTitle}</strong> meeting.`;

  const body = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111;">${headline}</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#555;">${subtext}</p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
      <tr><td>
        <table cellpadding="0" cellspacing="0" width="100%">
          ${detailRow("❌", "Cancelled event", `<strong>${p.eventTitle}</strong>`)}
          ${detailRow("📅", "Was scheduled for", `${dateStr} at ${fromStr} ${tz}`)}
          ${p.reason ? detailRow("💬", "Reason", p.reason) : ""}
        </table>
      </td></tr>
    </table>

    ${!isHost ? `
    <p style="font-size:14px;color:#777;">
      If you'd like to schedule a new meeting, you can visit
      <a href="${p.appUrl}" style="color:#c4956a;">ScheduleIt</a> to find a new time.
    </p>` : `
    <a href="${p.appUrl}/dashboard/bookings" style="display:inline-block;padding:10px 20px;background:#c4956a;color:#000;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;">
      View Dashboard →
    </a>`}
  `;
  return emailWrapper(body);
}

// ── Template: Reschedule ──────────────────────────────────────────────────────

export interface RescheduleEmailParams {
  hostName:      string;
  inviteeName:   string;
  inviteeEmail:  string;
  eventTitle:    string;
  oldStartTime:  Date;
  newStartTime:  Date;
  newEndTime:    Date;
  timezone:      string;
  location?:     string;
  cancelToken?:  string | null;
  appUrl:        string;
}

export function rescheduleEmailHtml(
  p: RescheduleEmailParams,
  recipient: "host" | "guest",
): string {
  const oldDate  = formatDate(p.oldStartTime, p.timezone);
  const oldTime  = formatTime(p.oldStartTime, p.timezone);
  const newDate  = formatDate(p.newStartTime, p.timezone);
  const newFrom  = formatTime(p.newStartTime, p.timezone);
  const newTo    = formatTime(p.newEndTime,   p.timezone);
  const tz       = tzAbbr(p.timezone);

  const isHost   = recipient === "host";
  const headline = isHost ? `${p.inviteeName} rescheduled their meeting` : `Your meeting has been rescheduled`;

  const body = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111;">${headline}</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#555;">
      ${isHost
        ? `${p.inviteeName} rescheduled <strong>${p.eventTitle}</strong>.`
        : `Your <strong>${p.eventTitle}</strong> with <strong>${p.hostName}</strong> has been moved.`
      }
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;padding:20px 24px;margin-bottom:10px;">
      <tr><td>
        <div style="font-size:11px;color:#aaa;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Previous time</div>
        <div style="font-size:14px;color:#999;text-decoration:line-through;">${oldDate} at ${oldTime} ${tz}</div>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
      <tr><td>
        <div style="font-size:11px;color:#16a34a;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">New time</div>
        <table cellpadding="0" cellspacing="0" width="100%">
          ${detailRow("📅", "Date", newDate)}
          ${detailRow("🕐", "Time", `${newFrom} – ${newTo} ${tz}`)}
          ${p.location ? detailRow("📍", "Location", `<a href="${p.location}" style="color:#c4956a;">${p.location}</a>`) : ""}
        </table>
      </td></tr>
    </table>

    ${!isHost && p.cancelToken ? `
    <a href="${p.appUrl}/cancel?token=${p.cancelToken}" style="display:inline-block;padding:9px 18px;background:#fff;border:1px solid #ddd;color:#555;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">
      Cancel instead
    </a>` : !isHost ? "" : `
    <a href="${p.appUrl}/dashboard/bookings" style="display:inline-block;padding:10px 20px;background:#c4956a;color:#000;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;">
      View Dashboard →
    </a>`}
  `;
  return emailWrapper(body);
}

// ── High-level send functions ─────────────────────────────────────────────────

/**
 * Send booking confirmation to BOTH host and guest.
 * Always non-fatal — never throws.
 */
export async function sendBookingConfirmationEmails(
  p: BookingEmailParams,
): Promise<void> {
  const icsAttachment = p.icsContent
    ? [{
        filename:    "meeting.ics",
        content:     p.icsContent,
        contentType: "text/calendar; method=REQUEST",
      }]
    : undefined;

  await Promise.allSettled([
    sendEmail(
      p.inviteeEmail,
      `Confirmed: ${p.eventTitle} with ${p.hostName}`,
      bookingConfirmationGuestHtml(p),
      `${p.hostName} via ScheduleIt`,
      icsAttachment,
    ),
    p.hostEmail ? sendEmail(
      p.hostEmail,
      `New booking: ${p.inviteeName} – ${p.eventTitle}`,
      bookingConfirmationHostHtml(p),
      `ScheduleIt`,
    ) : Promise.resolve(false),
  ]);
}

/**
 * Send cancellation notices to both parties.
 */
export async function sendCancellationEmails(
  p: CancellationEmailParams,
  hostEmail: string | null,
): Promise<void> {
  await Promise.allSettled([
    sendEmail(
      p.inviteeEmail,
      `Cancelled: ${p.eventTitle} with ${p.hostName}`,
      cancellationEmailHtml(p, "guest"),
      `${p.hostName} via ScheduleIt`,
    ),
    hostEmail ? sendEmail(
      hostEmail,
      `Cancellation: ${p.inviteeName} – ${p.eventTitle}`,
      cancellationEmailHtml(p, "host"),
      `ScheduleIt`,
    ) : Promise.resolve(false),
  ]);
}

/**
 * Send reschedule confirmation to both parties.
 */
export async function sendRescheduleEmails(
  p: RescheduleEmailParams,
  hostEmail: string | null,
): Promise<void> {
  await Promise.allSettled([
    sendEmail(
      p.inviteeEmail,
      `Rescheduled: ${p.eventTitle} with ${p.hostName}`,
      rescheduleEmailHtml(p, "guest"),
      `${p.hostName} via ScheduleIt`,
    ),
    hostEmail ? sendEmail(
      hostEmail,
      `Rescheduled: ${p.inviteeName} – ${p.eventTitle}`,
      rescheduleEmailHtml(p, "host"),
      `ScheduleIt`,
    ) : Promise.resolve(false),
  ]);
}

/**
 * Send 1-hour reminder to the guest.
 */
export async function sendReminderEmail(
  p: ReminderEmailParams,
): Promise<void> {
  await sendEmail(
    p.inviteeEmail,
    `Reminder: ${p.eventTitle} starts in 1 hour`,
    reminderEmailHtml(p),
    `${p.hostName} via ScheduleIt`,
  );
}
