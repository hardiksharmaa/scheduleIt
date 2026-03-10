import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z.object({
  bookingId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { bookingId } = parsed.data;

    const booking = await db.booking.findFirst({
      where: { id: bookingId, hostId: session.user.id },
      select: { id: true, status: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status === "CANCELLED") {
      return NextResponse.json({ error: "Cannot complete a cancelled booking" }, { status: 409 });
    }

    await db.booking.update({
      where: { id: bookingId },
      data: { status: "COMPLETED" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/bookings/complete]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
