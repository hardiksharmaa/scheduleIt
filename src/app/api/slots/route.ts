import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/scheduler";

/**
 * GET /api/slots?eventTypeId=xxx&date=YYYY-MM-DD&timezone=America/New_York
 *
 * Public endpoint — no auth required.
 * Returns available booking slots for the given event type and date.
 * Slots are returned as UTC ISO strings.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventTypeId = searchParams.get("eventTypeId");
    const date = searchParams.get("date");
    const timezone = searchParams.get("timezone") ?? "UTC";

    if (!eventTypeId) {
      return NextResponse.json({ error: "Missing eventTypeId" }, { status: 400 });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Missing or invalid date (expected YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Basic timezone validation
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }

    const slots = await getAvailableSlots({ eventTypeId, date, timezone });

    return NextResponse.json({ slots, date, timezone });
  } catch (err) {
    console.error("[GET /api/slots]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
