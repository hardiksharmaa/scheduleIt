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

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  duration: z.number().int().min(5).max(480).optional(),
  kind: z.enum(["ONE_ON_ONE", "GROUP", "ROUND_ROBIN", "COLLECTIVE"]).optional(),
  locationType: z
    .enum(["GOOGLE_MEET", "ZOOM", "TEAMS", "PHONE", "IN_PERSON", "OTHER"])
    .optional(),
  locationValue: z.string().max(300).optional().nullable(),
  bufferBefore: z.number().int().min(0).max(120).optional(),
  bufferAfter: z.number().int().min(0).max(120).optional(),
  minNotice: z.number().int().min(0).max(10080).optional(),
  maxBookings: z.number().int().min(1).optional().nullable(),
  maxAdvanceDays: z.number().int().min(1).max(730).optional().nullable(),
  isActive: z.boolean().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  slug: z.string().max(100).optional(),
  availabilityDays: z.array(z.number().int().min(0).max(6)).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { id, slug: rawSlug, availabilityDays, ...rest } = parsed.data;

    // Verify ownership
    const existing = await db.eventType.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let slug: string | undefined;
    if (rawSlug !== undefined) {
      slug = slugify(rawSlug);
      if (!slug) slug = existing.slug;

      // Ensure new slug is unique (excluding this event type)
      const taken = await db.eventType.findFirst({
        where: { userId: session.user.id, slug, NOT: { id } },
      });
      if (taken) {
        return NextResponse.json({ error: { slug: ["Slug already in use"] } }, { status: 400 });
      }
    }

    const eventType = await db.eventType.update({
      where: { id },
      data: {
        ...rest,
        ...(slug ? { slug } : {}),
        ...(availabilityDays !== undefined ? { availabilityDays } : {}),
        description: rest.description ?? existing.description,
        locationValue: rest.locationValue ?? existing.locationValue,
        maxBookings: rest.maxBookings ?? existing.maxBookings,
        maxAdvanceDays: rest.maxAdvanceDays !== undefined ? rest.maxAdvanceDays : existing.maxAdvanceDays,
      },
    });

    return NextResponse.json({ eventType });
  } catch (err) {
    console.error("[PATCH /api/events/update]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
