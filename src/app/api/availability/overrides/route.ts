import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const overrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  isBlocked: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  reason: z.string().max(200).optional().nullable(),
});

// GET — all overrides for the user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overrides = await db.availabilityOverride.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "asc" },
  });

  // Serialize dates as YYYY-MM-DD strings
  return NextResponse.json(
    overrides.map((o) => ({
      id: o.id,
      date: o.date.toISOString().split("T")[0],
      isBlocked: o.isBlocked,
      startTime: o.startTime,
      endTime: o.endTime,
      reason: o.reason,
    }))
  );
}

// POST — create or update an override for a date
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = overrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { date, isBlocked, startTime, endTime, reason } = parsed.data;

  // Custom hours: both times required and end > start
  if (!isBlocked) {
    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: "startTime and endTime are required for custom hours" },
        { status: 400 }
      );
    }
    if (startTime >= endTime) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }
  }

  try {
    const dateObj = new Date(`${date}T00:00:00.000Z`);

    const override = await db.availabilityOverride.upsert({
      where: { userId_date: { userId: session.user.id, date: dateObj } },
      create: {
        userId: session.user.id,
        date: dateObj,
        isBlocked,
        startTime: isBlocked ? null : startTime,
        endTime: isBlocked ? null : endTime,
        reason: reason ?? null,
      },
      update: {
        isBlocked,
        startTime: isBlocked ? null : startTime,
        endTime: isBlocked ? null : endTime,
        reason: reason ?? null,
      },
    });

    return NextResponse.json({
      id: override.id,
      date: override.date.toISOString().split("T")[0],
      isBlocked: override.isBlocked,
      startTime: override.startTime,
      endTime: override.endTime,
      reason: override.reason,
    });
  } catch (err) {
    console.error("[POST /api/availability/overrides]", err);
    return NextResponse.json({ error: "Failed to save override" }, { status: 500 });
  }
}

// DELETE — remove override by date ?date=YYYY-MM-DD
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Valid date param required (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const dateObj = new Date(`${date}T00:00:00.000Z`);

    await db.availabilityOverride.deleteMany({
      where: { userId: session.user.id, date: dateObj },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/availability/overrides]", err);
    return NextResponse.json({ error: "Failed to delete override" }, { status: 500 });
  }
}
