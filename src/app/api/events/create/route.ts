import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const createSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  duration: z.number().int().min(5).max(480),
  kind: z.enum(["ONE_ON_ONE", "GROUP", "ROUND_ROBIN", "COLLECTIVE"]).default("ONE_ON_ONE"),
  locationType: z
    .enum(["GOOGLE_MEET", "ZOOM", "TEAMS", "PHONE", "IN_PERSON", "OTHER"])
    .default("GOOGLE_MEET"),
  locationValue: z.string().max(300).optional().nullable(),
  bufferBefore: z.number().int().min(0).max(120).default(0),
  bufferAfter: z.number().int().min(0).max(120).default(0),
  minNotice: z.number().int().min(0).max(10080).default(0),
  maxBookings: z.number().int().min(1).optional().nullable(),
  maxAdvanceDays: z.number().int().min(1).max(730).optional().nullable(),
  isActive: z.boolean().default(true),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#c4956a"),
  slug: z.string().max(100).optional().nullable(),
  availabilityDays: z.array(z.number().int().min(0).max(6)).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const data = parsed.data;

    // Generate slug from title if not supplied
    let slug = data.slug ? slugify(data.slug) : slugify(data.title);
    if (!slug) slug = "event";

    // Ensure slug is unique for this user — append counter if needed
    const existing = await db.eventType.findMany({
      where: { userId: session.user.id },
      select: { slug: true },
    });
    const slugs = new Set(existing.map((e) => e.slug));
    let candidate = slug;
    let counter = 2;
    while (slugs.has(candidate)) {
      candidate = `${slug}-${counter}`;
      counter++;
    }
    slug = candidate;

    const eventType = await db.eventType.create({
      data: {
        userId: session.user.id,
        title: data.title,
        slug,
        description: data.description ?? null,
        duration: data.duration,
        kind: data.kind,
        locationType: data.locationType,
        locationValue: data.locationValue ?? null,
        bufferBefore: data.bufferBefore,
        bufferAfter: data.bufferAfter,
        minNotice: data.minNotice,
        maxBookings: data.maxBookings ?? null,
        maxAdvanceDays: data.maxAdvanceDays ?? null,
        isActive: data.isActive,
        color: data.color,
        availabilityDays: data.availabilityDays,
      },
    });

    return NextResponse.json({ eventType }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/events/create]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
