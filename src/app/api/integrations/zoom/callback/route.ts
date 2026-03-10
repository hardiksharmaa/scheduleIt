/**
 * GET /api/integrations/zoom/callback
 * Exchanges the auth code for tokens, stores encrypted in CalendarIntegration.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { exchangeZoomCode }          from "@/lib/zoom";
import { encrypt }                   from "@/lib/encryption";
import { db }                        from "@/lib/db";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", APP_URL));
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
    const tokens = await exchangeZoomCode(code);

    await db.calendarIntegration.upsert({
      where: { userId_provider: { userId: session.user.id, provider: "ZOOM" } },
      create: {
        userId:       session.user.id,
        provider:     "ZOOM",
        accessToken:  encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt:    new Date(Date.now() + tokens.expires_in * 1000),
        isActive:     true,
      },
      update: {
        accessToken:  encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt:    new Date(Date.now() + tokens.expires_in * 1000),
        isActive:     true,
      },
    });

    return NextResponse.redirect(
      new URL("/dashboard/integrations?connected=zoom", APP_URL),
    );
  } catch (err) {
    console.error("[GET /api/integrations/zoom/callback]", err);
    return NextResponse.redirect(
      new URL("/dashboard/integrations?error=zoom_server_error", APP_URL),
    );
  }
}
