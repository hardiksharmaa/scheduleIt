import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = req.nextUrl.searchParams.get("username");
  if (!username) {
    return NextResponse.json({ error: "username param required" }, { status: 400 });
  }

  if (!/^[a-z0-9_-]{3,40}$/.test(username)) {
    return NextResponse.json({ available: false, error: "Invalid format" });
  }

  const existing = await db.user.findFirst({
    where: { username, NOT: { id: session.user.id } },
  });

  return NextResponse.json({ available: !existing });
}
