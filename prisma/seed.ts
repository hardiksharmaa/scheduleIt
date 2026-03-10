import { PrismaClient, EventTypeKind, LocationType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { resolve } from "path";

// dotenv strips single/double quotes properly
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: resolve(process.cwd(), ".env") });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ DATABASE_URL is not set. Check your .env file.");
  process.exit(1);
}

console.log("  DB host:", new URL(dbUrl).hostname);

const pool = new pg.Pool({ connectionString: dbUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // ── Clean up existing seed data ──────────────────────────────────────────
  await prisma.analyticsSnapshot.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.availabilityOverride.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.eventType.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.calendarIntegration.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // ── Create demo user ─────────────────────────────────────────────────────
  const user = await prisma.user.create({
    data: {
      name: "Demo User",
      email: "demo@scheduleit.com",
      username: "demo",
      timezone: "America/New_York",
    },
  });
  console.log("✅ Created user:", user.email);

  // ── Default weekly availability (Mon–Fri, 9–17) ───────────────────────────
  const workDays = [1, 2, 3, 4, 5]; // Monday to Friday
  await prisma.availability.createMany({
    data: workDays.map((day) => ({
      userId: user.id,
      dayOfWeek: day,
      startTime: "09:00",
      endTime: "17:00",
      isActive: true,
    })),
  });
  console.log("✅ Created default availability (Mon–Fri 09:00–17:00)");

  // ── Create sample event types ─────────────────────────────────────────────
  const eventTypes = await prisma.$transaction([
    prisma.eventType.create({
      data: {
        userId: user.id,
        title: "15 Minute Chat",
        slug: "15-min-chat",
        description: "A quick 15 minute introductory call.",
        duration: 15,
        kind: EventTypeKind.ONE_ON_ONE,
        locationType: LocationType.GOOGLE_MEET,
        bufferAfter: 5,
        minNotice: 60,
        color: "#c4956a",
      },
    }),
    prisma.eventType.create({
      data: {
        userId: user.id,
        title: "30 Minute Meeting",
        slug: "30-min-meeting",
        description: "A standard 30 minute meeting.",
        duration: 30,
        kind: EventTypeKind.ONE_ON_ONE,
        locationType: LocationType.GOOGLE_MEET,
        bufferAfter: 10,
        minNotice: 120,
        color: "#c4956a",
      },
    }),
    prisma.eventType.create({
      data: {
        userId: user.id,
        title: "60 Minute Consultation",
        slug: "60-min-consultation",
        description: "An in-depth 60 minute consultation session.",
        duration: 60,
        kind: EventTypeKind.ONE_ON_ONE,
        locationType: LocationType.ZOOM,
        bufferBefore: 10,
        bufferAfter: 10,
        minNotice: 240,
        color: "#c4956a",
      },
    }),
    prisma.eventType.create({
      data: {
        userId: user.id,
        title: "Team Webinar",
        slug: "team-webinar",
        description: "Group webinar session — up to 50 attendees.",
        duration: 60,
        kind: EventTypeKind.GROUP,
        locationType: LocationType.GOOGLE_MEET,
        maxBookings: 50,
        minNotice: 1440, // 24 hours
        color: "#c4956a",
      },
    }),
  ]);
  console.log(`✅ Created ${eventTypes.length} event types`);

  // ── Sample bookings ───────────────────────────────────────────────────────
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const next30 = new Date(tomorrow);
  next30.setMinutes(30);

  await prisma.booking.create({
    data: {
      eventTypeId: eventTypes[1].id,
      hostId: user.id,
      inviteeName: "Jane Smith",
      inviteeEmail: "jane@example.com",
      inviteeTimezone: "America/Los_Angeles",
      startTime: tomorrow,
      endTime: next30,
      status: "CONFIRMED",
      notes: "Looking forward to the call!",
      location: "https://meet.google.com/abc-defg-hij",
    },
  });
  console.log("✅ Created sample booking");

  // ── Analytics snapshot ────────────────────────────────────────────────────
  await prisma.analyticsSnapshot.create({
    data: {
      userId: user.id,
      date: new Date(),
      totalBookings: 1,
      completedBookings: 0,
      cancelledBookings: 0,
      rescheduled: 0,
    },
  });
  console.log("✅ Created analytics snapshot");

  console.log("\n🎉 Seed complete!");
  console.log(`\n   Demo account: demo@scheduleit.com`);
  console.log(`   Public booking: http://localhost:3000/demo`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
