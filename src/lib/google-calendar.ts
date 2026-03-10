/**
 * Google Calendar integration helpers.
 *
 * Covers:
 *  - OAuth2 URL generation (connect flow)
 *  - Retrieving + auto-refreshing an authorized client for a given user
 *  - Creating calendar events with optional Google Meet conferencing
 *  - Querying free/busy times for conflict detection
 */

import { google, calendar_v3 } from "googleapis";
import { db }     from "./db";
import { encrypt, decrypt } from "./encryption";

// ── OAuth2 Configuration ─────────────────────────────────────────────────────

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI!;

/** Scopes required for calendar read + event write + Google Meet + Gmail send */
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Creates a bare OAuth2 client (no credentials set). */
export function createOAuthClient() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

/**
 * Returns the Google OAuth consent-screen URL.
 * `prompt: "consent"` forces the refresh_token to be returned every time.
 */
export function getAuthUrl(): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt:      "consent",
    scope:       SCOPES,
  });
}

/**
 * Retrieves an authorized OAuth2 client for the given user.
 * Automatically refreshes the access token if it is within 5 minutes of expiry.
 * Returns `null` if the user has no active Google Calendar integration.
 */
export async function getAuthorizedClient(userId: string) {
  const integration = await db.calendarIntegration.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE_CALENDAR" } },
  });

  if (!integration || !integration.isActive) return null;

  const client = createOAuthClient();
  client.setCredentials({
    access_token:  decrypt(integration.accessToken),
    refresh_token: integration.refreshToken ? decrypt(integration.refreshToken) : undefined,
    expiry_date:   integration.expiresAt?.getTime(),
  });

  // Proactively refresh if the token expires within the next 5 minutes
  const expiresAt = integration.expiresAt;
  if (expiresAt && expiresAt.getTime() < Date.now() + 5 * 60_000) {
    try {
      const { credentials } = await client.refreshAccessToken();

      await db.calendarIntegration.update({
        where: { userId_provider: { userId, provider: "GOOGLE_CALENDAR" } },
        data: {
          accessToken:  encrypt(credentials.access_token!),
          refreshToken: credentials.refresh_token
            ? encrypt(credentials.refresh_token)
            : undefined,
          expiresAt: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : undefined,
        },
      });

      client.setCredentials(credentials);
    } catch (err) {
      console.error("[google-calendar] token refresh failed", err);
      // Mark integration as inactive so we stop trying
      await db.calendarIntegration.update({
        where: { userId_provider: { userId, provider: "GOOGLE_CALENDAR" } },
        data:  { isActive: false },
      });
      return null;
    }
  }

  return client;
}

// ── Calendar event creation ───────────────────────────────────────────────────

export interface CreateEventParams {
  title:            string;
  description?:     string;
  startTime:        Date;
  endTime:          Date;
  attendeeEmail:    string;
  attendeeName:     string;
  /** When true, attaches a Google Meet conferencing link to the event. */
  addMeetLink?:     boolean;
}

export interface CreatedEventResult {
  calendarEventId?: string;
  meetLink?:        string;
}

/**
 * Creates a Google Calendar event on the host's primary calendar.
 * If `addMeetLink` is true a Google Meet conference is generated automatically.
 *
 * Returns an empty object when the user has no active Google Calendar integration.
 */
export async function createCalendarEvent(
  userId: string,
  params: CreateEventParams,
): Promise<CreatedEventResult> {
  const auth = await getAuthorizedClient(userId);
  if (!auth) return {};

  const calendar = google.calendar({ version: "v3", auth });

  const insertParams: calendar_v3.Params$Resource$Events$Insert = {
    calendarId:            "primary",
    conferenceDataVersion: params.addMeetLink ? 1 : 0,
    requestBody: {
      summary:     params.title,
      description: params.description,
      start:       { dateTime: params.startTime.toISOString() },
      end:         { dateTime: params.endTime.toISOString() },
      attendees:   [{ email: params.attendeeEmail, displayName: params.attendeeName }],
      conferenceData: params.addMeetLink
        ? {
            createRequest: {
              requestId:             `scheduleit-${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          }
        : undefined,
    },
  };

  try {
    const event = await calendar.events.insert(insertParams);
    return {
      calendarEventId: event.data.id ?? undefined,
      meetLink:
        event.data.conferenceData?.entryPoints?.find(
          (ep: calendar_v3.Schema$EntryPoint) => ep.entryPointType === "video",
        )?.uri
        ?? event.data.hangoutLink  // fallback: older API field, always populated
        ?? undefined,
    };
  } catch (err) {
    // Non-fatal: log and continue — booking is still saved in our DB
    console.error("[google-calendar] createCalendarEvent failed", err);
    return {};
  }
}

// ── Delete calendar event ─────────────────────────────────────────────────────

/**
 * Deletes a Google Calendar event by its event ID. Non-fatal — returns false on failure.
 */
export async function deleteCalendarEvent(
  userId:  string,
  eventId: string,
): Promise<boolean> {
  try {
    const auth = await getAuthorizedClient(userId);
    if (!auth) return false;
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.events.delete({ calendarId: "primary", eventId });
    return true;
  } catch (err) {
    console.error("[google-calendar] deleteCalendarEvent failed", err);
    return false;
  }
}

// ── Update calendar event ─────────────────────────────────────────────────────

/**
 * Updates the start/end time of an existing Google Calendar event. Non-fatal.
 */
export async function updateCalendarEvent(
  userId:    string,
  eventId:   string,
  startTime: Date,
  endTime:   Date,
): Promise<boolean> {
  try {
    const auth = await getAuthorizedClient(userId);
    if (!auth) return false;
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: {
        start: { dateTime: startTime.toISOString() },
        end:   { dateTime: endTime.toISOString() },
      },
    });
    return true;
  } catch (err) {
    console.error("[google-calendar] updateCalendarEvent failed", err);
    return false;
  }
}

// ── Free/busy query ───────────────────────────────────────────────────────────

export interface BusyInterval {
  start: Date;
  end:   Date;
}

/**
 * Returns all busy intervals from the user's primary Google Calendar
 * within the given time window.
 *
 * Returns an empty array when the user has no active integration or on error.
 */
export async function getBusyTimes(
  userId:  string,
  timeMin: Date,
  timeMax: Date,
): Promise<BusyInterval[]> {
  const auth = await getAuthorizedClient(userId);
  if (!auth) return [];

  const calendar = google.calendar({ version: "v3", auth });

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items:   [{ id: "primary" }],
      },
    });

    const busy = response.data.calendars?.["primary"]?.busy ?? [];
    return busy.flatMap((b) => {
      if (!b.start || !b.end) return [];
      return [{ start: new Date(b.start), end: new Date(b.end) }];
    });
  } catch (err) {
    console.error("[google-calendar] getBusyTimes failed", err);
    return [];
  }
}
