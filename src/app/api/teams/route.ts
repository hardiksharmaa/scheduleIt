import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db }   from "@/lib/db";
import { z }    from "zod";

function slugify(str: string) {
  return str
    .toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const createSchema = z.object({
  name:        z.string().min(1).max(100),
  slug:        z.string().max(60).optional(),
  description: z.string().max(500).optional().nullable(),
});

// GET /api/teams  — list all teams the current user belongs to
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await db.teamMember.findMany({
    where: { userId: session.user.id },
    include: {
      team: {
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
          _count: { select: { members: true, eventTypes: true } },
        },
      },
    },
  });

  const teams = memberships.map((m) => ({ ...m.team, myRole: m.role }));
  return NextResponse.json({ teams });
}

// POST /api/teams  — create a new team (current user becomes owner + first member)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body   = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const data = parsed.data;
  let slug = data.slug ? slugify(data.slug) : slugify(data.name);
  if (!slug) slug = "team";

  // Ensure globally unique slug
  let candidate = slug;
  let counter   = 2;
  while (await db.team.findUnique({ where: { slug: candidate } })) {
    candidate = `${slug}-${counter++}`;
  }
  slug = candidate;

  const team = await db.team.create({
    data: {
      name:        data.name,
      slug,
      description: data.description ?? null,
      ownerId:     session.user.id,
      members: {
        create: { userId: session.user.id, role: "OWNER" },
      },
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true, username: true } },
        },
      },
      eventTypes: {
        select: {
          id: true, title: true, slug: true, duration: true,
          kind: true, locationType: true, color: true, isActive: true,
          team: { select: { slug: true } },
        },
      },
      _count: { select: { members: true, eventTypes: true } },
    },
  });

  return NextResponse.json({ team: { ...team, myRole: "OWNER" } }, { status: 201 });
}
