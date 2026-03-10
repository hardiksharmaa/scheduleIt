import { NextResponse } from "next/server";
import { auth }         from "@/lib/auth";
import { db }           from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.calendarIntegration.updateMany({
    where: { userId: session.user.id, provider: "ZOOM" },
    data:  { isActive: false },
  });

  return NextResponse.json({ success: true });
}
