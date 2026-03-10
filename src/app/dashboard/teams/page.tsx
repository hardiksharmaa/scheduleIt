import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import TeamsClient from "./TeamsClient";

export default async function TeamsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const memberships = await db.teamMember.findMany({
    where: { userId: session.user.id },
    include: {
      team: {
        include: {
          members: { include: { user: true } },
          eventTypes: {
            where: { isActive: true },
            include: { team: { select: { slug: true } } },
          },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const teams = memberships.map((m) => ({
    ...m.team,
    myRole: m.role as "OWNER" | "MEMBER",
    members: m.team.members.map((mem) => ({
      ...mem,
      joinedAt: mem.joinedAt.toISOString(),
    })),
    eventTypes: m.team.eventTypes.map((et) => ({
      ...et,
      createdAt: et.createdAt.toISOString(),
      updatedAt: et.updatedAt.toISOString(),
    })),
    createdAt: m.team.createdAt.toISOString(),
    updatedAt: m.team.updatedAt.toISOString(),
  }));

  return <TeamsClient initialTeams={teams as never} userId={session.user.id} />;
}
