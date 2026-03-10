/**
 * GET /api/integrations/google/callback
 *
 * OAuth 2.0 callback from Google. Exchanges the authorization code for tokens,
 * encrypts them, and upserts a CalendarIntegration record for the user.
 *
 * Success → redirects to /dashboard/integrations?connected=google
 * Failure → redirects to /dashboard/integrations?error=<reason>
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { createOAuthClient }         from "@/lib/google-calendar";
import { encrypt }                   from "@/lib/encryption";
import { db }                        from "@/lib/db";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/sign-in", APP_URL));
  }

  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    const reason = error ?? "no_code";
    return NextResponse.redirect(
      new URL(`/dashboard/integrations?error=${encodeURIComponent(reason)}`, APP_URL),
    );
  }

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token) {
      throw new Error("No access_token returned from Google");
    }

    await db.calendarIntegration.upsert({
      where: {
        userId_provider: { userId: session.user.id, provider: "GOOGLE_CALENDAR" },
      },
      create: {
        userId:       session.user.id,
        provider:     "GOOGLE_CALENDAR",
        accessToken:  encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        expiresAt:    tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        isActive:     true,
      },
      update: {
        accessToken:  encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
        expiresAt:    tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        isActive:     true,
      },
    });

    return NextResponse.redirect(
      new URL("/dashboard/integrations?connected=google", APP_URL),
    );
  } catch (err) {
    console.error("[GET /api/integrations/google/callback]", err);
    return NextResponse.redirect(
      new URL("/dashboard/integrations?error=server_error", APP_URL),
    );
  }
}
