import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db }   from "@/lib/db";
import { z }    from "zod";

// GET /api/teams/[teamId]/members
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

  const members = await db.teamMember.findMany({
    where: { teamId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true, username: true } },
    },
    orderBy: { joinedAt: "asc" },
  });
  return NextResponse.json({ members });
}

// POST /api/teams/[teamId]/members  — add a member by email (owner only)
const addSchema = z.object({
  email: z.string().email(),
  role:  z.enum(["OWNER", "MEMBER"]).default("MEMBER"),
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
    return NextResponse.json({ error: "Only the team owner can add members" }, { status: 403 });

  const body   = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const targetUser = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!targetUser) return NextResponse.json({ error: "No ScheduleIt account found for that email" }, { status: 404 });

  const existing = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: targetUser.id } },
  });
  if (existing) return NextResponse.json({ error: "User is already a team member" }, { status: 409 });

  const member = await db.teamMember.create({
    data: { teamId, userId: targetUser.id, role: parsed.data.role },
    include: {
      user: { select: { id: true, name: true, email: true, image: true, username: true } },
    },
  });
  return NextResponse.json({ member }, { status: 201 });
}

// DELETE /api/teams/[teamId]/members?userId=xxx  — remove a member
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await params;
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = team.ownerId === session.user.id;
  const isSelf  = userId === session.user.id;
  if (!isOwner && !isSelf) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (userId === team.ownerId)
    return NextResponse.json({ error: "Cannot remove the team owner" }, { status: 400 });

  await db.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
  return NextResponse.json({ ok: true });
}
