import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Read picture + image fresh from DB so uploaded avatars show immediately
  // without requiring a sign-out / sign-in cycle.
  const dbUser = session.user.id
    ? await db.user.findUnique({
        where: { id: session.user.id },
        select: { picture: true, image: true },
      })
    : null;

  const user = {
    name: session.user.name ?? "User",
    email: session.user.email ?? "",
    // Prefer uploaded picture over OAuth image
    image: dbUser?.picture ?? dbUser?.image ?? session.user.image ?? null,
  };

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
