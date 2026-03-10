/**
 * Zoom OAuth + meeting creation utilities.
 *
 * Required env vars:
 *   ZOOM_CLIENT_ID
 *   ZOOM_CLIENT_SECRET
 *   ZOOM_REDIRECT_URI  (e.g. https://yourapp.com/api/integrations/zoom/callback)
 */

import { db }       from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

const APP_URL     = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const CLIENT_ID   = process.env.ZOOM_CLIENT_ID     ?? "";
const CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET ?? "";
const REDIRECT_URI  = process.env.ZOOM_REDIRECT_URI  ?? `${APP_URL}/api/integrations/zoom/callback`;

// ─── Auth URL ──────────────────────────────────────────────────────────────

export function getZoomAuthUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
  });
  return `https://zoom.us/oauth/authorize?${params.toString()}`;
}

// ─── Token exchange ─────────────────────────────────────────────────────────

interface ZoomTokenResponse {
  access_token:  string;
  refresh_token: string;
  expires_in:    number; // seconds
  token_type:    string;
}

function basicAuth() {
  return Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
}

export async function exchangeZoomCode(code: string): Promise<ZoomTokenResponse> {
  const res = await fetch("https://zoom.us/oauth/token", {
    method:  "POST",
    headers: {
      Authorization:  `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type:   "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoom token exchange failed: ${err}`);
  }
  return res.json() as Promise<ZoomTokenResponse>;
}

async function refreshZoomAccessToken(userId: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://zoom.us/oauth/token", {
    method:  "POST",
    headers: {
      Authorization:  `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error("Zoom token refresh failed");
  const data = await res.json() as ZoomTokenResponse;

  // Persist fresh tokens
  await db.calendarIntegration.update({
    where: { userId_provider: { userId, provider: "ZOOM" } },
    data: {
      accessToken:  encrypt(data.access_token),
      refreshToken: encrypt(data.refresh_token),
      expiresAt:    new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}

// ─── Get valid access token ─────────────────────────────────────────────────

async function getZoomAccessToken(userId: string): Promise<string> {
  const integration = await db.calendarIntegration.findUnique({
    where: { userId_provider: { userId, provider: "ZOOM" } },
    select: { accessToken: true, refreshToken: true, expiresAt: true, isActive: true },
  });

  if (!integration?.isActive || !integration.accessToken) {
    throw new Error("Zoom not connected for this user");
  }

  // Refresh if expired (with 60-second buffer)
  if (integration.expiresAt && integration.refreshToken) {
    const expiresMs = integration.expiresAt.getTime();
    if (Date.now() >= expiresMs - 60_000) {
      return refreshZoomAccessToken(userId, decrypt(integration.refreshToken));
    }
  }

  return decrypt(integration.accessToken);
}

// ─── Create meeting ─────────────────────────────────────────────────────────

export interface ZoomMeetingResult {
  joinUrl:   string;
  meetingId: string;
}

export async function createZoomMeeting(
  userId:    string,
  topic:     string,
  startTime: Date,
  duration:  number, // minutes
): Promise<ZoomMeetingResult> {
  const accessToken = await getZoomAccessToken(userId);

  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic,
      type:       2,                              // scheduled meeting
      start_time: startTime.toISOString(),
      duration,
      timezone:   "UTC",
      settings: {
        join_before_host:  true,
        waiting_room:      false,
        auto_recording:    "none",
        approval_type:     2,                     // no registration required
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoom meeting creation failed: ${err}`);
  }

  const data = await res.json() as { join_url: string; id: number };
  return { joinUrl: data.join_url, meetingId: String(data.id) };
}
