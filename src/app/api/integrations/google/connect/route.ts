/**
 * GET /api/integrations/google/connect
 *
 * Redirects the authenticated user to Google's OAuth 2.0 consent screen.
 * On success Google redirects back to /api/integrations/google/callback.
 */

import { NextResponse }  from "next/server";
import { auth }          from "@/lib/auth";
import { getAuthUrl }    from "@/lib/google-calendar";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
