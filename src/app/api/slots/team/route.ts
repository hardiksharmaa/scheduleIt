import { NextRequest, NextResponse } from "next/server";
import { getTeamAvailableSlots } from "@/lib/team-scheduler";

/**
 * GET /api/slots/team?teamEventTypeId=xxx&date=YYYY-MM-DD&timezone=xxx
 *
 * Public — no auth required.
 * Returns available slots for a team event type (ROUND_ROBIN = union, COLLECTIVE = intersection).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const teamEventTypeId = searchParams.get("teamEventTypeId");
    const date            = searchParams.get("date");
    const timezone        = searchParams.get("timezone") ?? "UTC";

    if (!teamEventTypeId)
      return NextResponse.json({ error: "Missing teamEventTypeId" }, { status: 400 });
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      return NextResponse.json({ error: "Invalid date (expected YYYY-MM-DD)" }, { status: 400 });

    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }

    const slots = await getTeamAvailableSlots({ teamEventTypeId, date, timezone });
    return NextResponse.json({ slots, date, timezone });
  } catch (err) {
    console.error("[GET /api/slots/team]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
