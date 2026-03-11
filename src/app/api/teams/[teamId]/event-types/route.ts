import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db }   from "@/lib/db";
import { z }    from "zod";

function slugify(str: string) {
  return str.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET /api/teams/[teamId]/event-types
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await params;
  const membership = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const eventTypes = await db.eventType.findMany({
    where: { teamId },
    select: {
      id: true, title: true, slug: true, duration: true,
      kind: true, locationType: true, color: true, isActive: true,
      team: { select: { slug: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ eventTypes });
}

// POST /api/teams/[teamId]/event-types  — owner only
const createSchema = z.object({
  title:        z.string().min(1).max(100),
  description:  z.string().max(500).optional().nullable(),
  duration:     z.number().int().min(5).max(480),
  kind:         z.enum(["ONE_ON_ONE", "GROUP", "ROUND_ROBIN", "COLLECTIVE"]).default("ROUND_ROBIN"),
  locationType: z.enum(["GOOGLE_MEET", "ZOOM", "TEAMS", "PHONE", "IN_PERSON", "OTHER"]).default("GOOGLE_MEET"),
  color:        z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#D83F87"),
  bufferBefore: z.number().int().min(0).max(120).default(0),
  bufferAfter:  z.number().int().min(0).max(120).default(0),
  minNotice:    z.number().int().min(0).max(10080).default(0),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await params;
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (team.ownerId !== session.user.id)
    return NextResponse.json({ error: "Only the team owner can create event types" }, { status: 403 });

  const body   = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const data = parsed.data;
  let slug = slugify(data.title) || "event";

  // Schema unique constraint is (userId, slug) — check against owner's existing slugs
  const existingSlugs = new Set(
    (await db.eventType.findMany({ where: { userId: session.user.id }, select: { slug: true } }))
      .map((e) => e.slug),
  );
  let candidate = slug;
  let counter   = 2;
  while (existingSlugs.has(candidate)) candidate = `${slug}-${counter++}`;
  slug = candidate;

  const eventType = await db.eventType.create({
    data: {
      userId:       session.user.id,
      teamId,
      title:        data.title,
      slug,
      description:  data.description ?? null,
      duration:     data.duration,
      kind:         data.kind,
      locationType: data.locationType,
      bufferBefore: data.bufferBefore,
      bufferAfter:  data.bufferAfter,
      minNotice:    data.minNotice,
      color:        data.color,
    },
    include: { team: { select: { slug: true } } },
  });

  return NextResponse.json({ eventType }, { status: 201 });
}

// DELETE /api/teams/[teamId]/event-types?id=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await params;
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (team.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Delete bookings referencing this event type first (FK constraint),
  // then delete the event type itself — all in one transaction.
  await db.$transaction([
    db.booking.deleteMany({ where: { eventTypeId: id } }),
    db.eventType.delete({ where: { id, teamId } }),
  ]);
  return NextResponse.json({ ok: true });
}
