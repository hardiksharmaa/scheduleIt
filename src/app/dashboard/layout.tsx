import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

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

  return (
    <div className="flex h-screen overflow-hidden bg-[#0c0c0c]">
      <Sidebar user={user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
