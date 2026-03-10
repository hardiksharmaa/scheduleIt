import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db }   from "@/lib/db";
import { z }    from "zod";

// GET /api/teams/[teamId]
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

  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true, username: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
      eventTypes: {
        select: {
          id: true, title: true, slug: true, duration: true,
          kind: true, locationType: true, color: true, isActive: true,
          team: { select: { slug: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ team, myRole: membership.role });
}

// PATCH /api/teams/[teamId]  — update name / description (owner only)
const updateSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await params;
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (team.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body   = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const updated = await db.team.update({
    where: { id: teamId },
    data: {
      ...(parsed.data.name        !== undefined && { name: parsed.data.name }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
    },
  });

  return NextResponse.json({ team: updated });
}

// DELETE /api/teams/[teamId]  — owner only; cascades members + event types
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await params;
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (team.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Must delete bookings before event types (FK constraint), then event types
  // before the team itself can be removed.
  const eventTypes = await db.eventType.findMany({
    where: { teamId },
    select: { id: true },
  });
  const eventTypeIds = eventTypes.map((e) => e.id);
  await db.$transaction([
    db.booking.deleteMany({ where: { eventTypeId: { in: eventTypeIds } } }),
    db.eventType.deleteMany({ where: { teamId } }),
    db.teamMember.deleteMany({ where: { teamId } }),
    db.team.delete({ where: { id: teamId } }),
  ]);
  return NextResponse.json({ ok: true });
}
