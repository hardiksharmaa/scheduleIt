import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  username: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9_-]+$/, "Only lowercase letters, numbers, hyphens and underscores")
    .optional(),
  timezone: z.string().min(1).max(80).optional(),
  // base64 data URL (e.g. "data:image/jpeg;base64,...") or null to clear
  picture: z.string().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      image: true,   // OAuth avatar URL
      picture: true, // uploaded base64 — included here for the settings page only
      timezone: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { username, name, timezone, picture } = parsed.data;

  // Enforce max size ~2 MB for base64 string (2MB * 1.37 overhead ≈ 2.8M chars)
  if (picture && picture.length > 3_000_000) {
    return NextResponse.json({ error: { picture: ["Image is too large. Max 2 MB."] } }, { status: 400 });
  }

  if (username) {
    const existing = await db.user.findFirst({
      where: { username, NOT: { id: session.user.id } },
    });
    if (existing) {
      return NextResponse.json({ error: { username: ["Username is already taken."] } }, { status: 409 });
    }
  }

  try {
    const updated = await db.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(username !== undefined && { username }),
        ...(timezone !== undefined && { timezone }),
        ...(picture !== undefined && { picture }),
      },
      // Never return picture here — keep it out of any session-bound responses
      select: { id: true, name: true, email: true, username: true, image: true, timezone: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/user/profile]", err);
    const message = process.env.NODE_ENV === "development"
      ? (err instanceof Error ? err.message : String(err))
      : "Failed to save. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.user.delete({ where: { id: session.user.id } });

  return NextResponse.json({ ok: true });
}
