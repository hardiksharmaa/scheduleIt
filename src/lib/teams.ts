/**
 * Microsoft Teams (MS Graph API) OAuth + online meeting creation utilities.
 *
 * Required env vars:
 *   TEAMS_CLIENT_ID
 *   TEAMS_CLIENT_SECRET
 *   TEAMS_REDIRECT_URI  (e.g. https://yourapp.com/api/integrations/teams/callback)
 *   TEAMS_TENANT_ID     (defaults to "common" for multi-tenant)
 */

import { db }              from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const CLIENT_ID     = process.env.TEAMS_CLIENT_ID     ?? "";
const CLIENT_SECRET = process.env.TEAMS_CLIENT_SECRET ?? "";
const TENANT_ID     = process.env.TEAMS_TENANT_ID     ?? "common";
const REDIRECT_URI  = process.env.TEAMS_REDIRECT_URI  ?? `${APP_URL}/api/integrations/teams/callback`;

const AUTH_BASE   = `https://login.microsoftonline.com/${TENANT_ID}`;
const GRAPH_BASE  = "https://graph.microsoft.com/v1.0";

// ─── Auth URL ──────────────────────────────────────────────────────────────

export function getTeamsAuthUrl(): string {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    response_type: "code",
    redirect_uri:  REDIRECT_URI,
    scope:         "OnlineMeetings.ReadWrite offline_access User.Read",
    response_mode: "query",
  });
  return `${AUTH_BASE}/oauth2/v2.0/authorize?${params.toString()}`;
}

// ─── Token exchange ─────────────────────────────────────────────────────────

interface TeamsTokenResponse {
  access_token:  string;
  refresh_token: string;
  expires_in:    number; // seconds
  token_type:    string;
}

export async function exchangeTeamsCode(code: string): Promise<TeamsTokenResponse> {
  const res = await fetch(`${AUTH_BASE}/oauth2/v2.0/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    "authorization_code",
      code,
      redirect_uri:  REDIRECT_URI,
      scope:         "OnlineMeetings.ReadWrite offline_access User.Read",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Teams token exchange failed: ${err}`);
  }
  return res.json() as Promise<TeamsTokenResponse>;
}

async function refreshTeamsAccessToken(userId: string, refreshToken: string): Promise<string> {
  const res = await fetch(`${AUTH_BASE}/oauth2/v2.0/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
      scope:         "OnlineMeetings.ReadWrite offline_access User.Read",
    }),
  });

  if (!res.ok) throw new Error("Teams token refresh failed");
  const data = await res.json() as TeamsTokenResponse;

  await db.calendarIntegration.update({
    where: { userId_provider: { userId, provider: "MICROSOFT_TEAMS" } },
    data: {
      accessToken:  encrypt(data.access_token),
      refreshToken: encrypt(data.refresh_token),
      expiresAt:    new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}

// ─── Get valid access token ─────────────────────────────────────────────────

async function getTeamsAccessToken(userId: string): Promise<string> {
  const integration = await db.calendarIntegration.findUnique({
    where: { userId_provider: { userId, provider: "MICROSOFT_TEAMS" } },
    select: { accessToken: true, refreshToken: true, expiresAt: true, isActive: true },
  });

  if (!integration?.isActive || !integration.accessToken) {
    throw new Error("Microsoft Teams not connected for this user");
  }

  if (integration.expiresAt && integration.refreshToken) {
    const expiresMs = integration.expiresAt.getTime();
    if (Date.now() >= expiresMs - 60_000) {
      return refreshTeamsAccessToken(userId, decrypt(integration.refreshToken));
    }
  }

  return decrypt(integration.accessToken);
}

// ─── Create meeting ─────────────────────────────────────────────────────────

export interface TeamsMeetingResult {
  joinUrl:   string;
  meetingId: string;
}

export async function createTeamsMeeting(
  userId:    string,
  subject:   string,
  startTime: Date,
  endTime:   Date,
): Promise<TeamsMeetingResult> {
  const accessToken = await getTeamsAccessToken(userId);

  const res = await fetch(`${GRAPH_BASE}/me/onlineMeetings`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject,
      startDateTime: startTime.toISOString(),
      endDateTime:   endTime.toISOString(),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Teams meeting creation failed: ${err}`);
  }

  const data = await res.json() as { joinWebUrl: string; id: string };
  return { joinUrl: data.joinWebUrl, meetingId: data.id };
}
