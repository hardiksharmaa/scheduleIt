import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const daySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isActive: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
});

const putSchema = z.array(daySchema).length(7);

// GET — return all 7 day rows (or defaults if not set)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.availability.findMany({
    where: { userId: session.user.id },
    orderBy: { dayOfWeek: "asc" },
  });

  // Fill in defaults for any missing days (Mon–Fri active 09:00–17:00)
  const defaults: Record<number, { isActive: boolean; startTime: string; endTime: string }> = {
    0: { isActive: false, startTime: "09:00", endTime: "17:00" }, // Sun
    1: { isActive: true, startTime: "09:00", endTime: "17:00" },  // Mon
    2: { isActive: true, startTime: "09:00", endTime: "17:00" },  // Tue
    3: { isActive: true, startTime: "09:00", endTime: "17:00" },  // Wed
    4: { isActive: true, startTime: "09:00", endTime: "17:00" },  // Thu
    5: { isActive: true, startTime: "09:00", endTime: "17:00" },  // Fri
    6: { isActive: false, startTime: "09:00", endTime: "17:00" }, // Sat
  };

  const schedule = Array.from({ length: 7 }, (_, day) => {
    const existing = rows.find((r) => r.dayOfWeek === day);
    if (existing) {
      return {
        id: existing.id,
        dayOfWeek: existing.dayOfWeek,
        isActive: existing.isActive,
        startTime: existing.startTime,
        endTime: existing.endTime,
      };
    }
    return {
      id: null,
      dayOfWeek: day,
      ...defaults[day],
    };
  });

  return NextResponse.json(schedule);
}

// PUT — upsert all 7 days at once
export async function PUT(req: NextRequest) {
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

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Validate that endTime > startTime for active days
  for (const day of parsed.data) {
    if (day.isActive && day.startTime >= day.endTime) {
      return NextResponse.json(
        { error: `Day ${day.dayOfWeek}: end time must be after start time` },
        { status: 400 }
      );
    }
  }

  try {
    // Upsert each day
    const upserts = parsed.data.map((day) =>
      db.availability.upsert({
        where: { userId_dayOfWeek: { userId: session.user.id, dayOfWeek: day.dayOfWeek } },
        create: {
          userId: session.user.id,
          dayOfWeek: day.dayOfWeek,
          isActive: day.isActive,
          startTime: day.startTime,
          endTime: day.endTime,
        },
        update: {
          isActive: day.isActive,
          startTime: day.startTime,
          endTime: day.endTime,
        },
      })
    );

    await Promise.all(upserts);

    const updated = await db.availability.findMany({
      where: { userId: session.user.id },
      orderBy: { dayOfWeek: "asc" },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PUT /api/availability]", err);
    return NextResponse.json({ error: "Failed to save availability" }, { status: 500 });
  }
}
