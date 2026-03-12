import {
  Calendar,
  Clock,
  Users,
  TrendingUp,
  Plus,
  ArrowRight,
  CheckCircle,
  Circle,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { autoCompleteExpiredBookings } from "@/lib/autoComplete";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtTime(date: Date) {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const todayStr = now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (date.toDateString() === todayStr) return `Today · ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`;
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const day = date.toLocaleDateString("en-US", { weekday: "short" });
    return `${day} · ${time}`;
  }
  return (
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ` · ${time}`
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  change,
  changePositive,
  icon: Icon,
  accent,
  href,
}: {
  label: string;
  value: string;
  change: string;
  changePositive?: boolean;
  icon: LucideIcon;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <Card
      className={`relative overflow-hidden transition-shadow hover:shadow-md ${
        accent ? "border-accent/30" : ""
      }`}
    >
      {accent && (
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-accent/8 via-transparent to-transparent" />
      )}
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium text-text-muted">{label}</CardTitle>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            accent ? "bg-accent/15" : "bg-[#44318D]"
          }`}
        >
          <Icon
            className={`h-4 w-4 ${accent ? "text-accent" : "text-text-muted"}`}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-white">{value}</div>
        <p
          className={`mt-1 text-sm ${
            changePositive ? "text-emerald-400" : "text-text-muted"
          }`}
        >
          {change}
        </p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── EmptyBookings ────────────────────────────────────────────────────────────

function EmptyBookings() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#44318D]">
        <Calendar className="h-6 w-6 text-[#3a3a3a]" />
      </div>
      <p className="text-base font-medium text-white">No upcoming bookings</p>
      <p className="mt-1 max-w-xs text-sm text-text-muted">
        Share your booking link to start receiving meetings.
      </p>
      <Link href="/dashboard/event-types" className="mt-4">
        <Button variant="secondary" size="sm" className="gap-2">
          <Plus className="h-3.5 w-3.5" /> Create event
        </Button>
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const now = new Date();

  await autoCompleteExpiredBookings(userId);

  // Week boundaries (Mon–Sun)
  const dayOfWeek = now.getDay();
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diffToMon);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    totalBookings,
    bookingsThisWeek,
    upcomingBookings,
    completedCount,
    eventTypes,
    availability,
    calendarIntegration,
    userProfile,
    upcomingCount,
  ] = await Promise.all([
    db.booking.count({ where: { hostId: userId } }),
    db.booking.count({
      where: { hostId: userId, createdAt: { gte: weekStart, lt: weekEnd } },
    }),
    db.booking.findMany({
      where: {
        hostId: userId,
        status: { in: ["CONFIRMED", "PENDING"] },
        startTime: { gte: now },
      },
      orderBy: { startTime: "asc" },
      take: 5,
      include: {
        eventType: { select: { title: true, color: true, duration: true } },
      },
    }),
    db.booking.count({ where: { hostId: userId, status: "COMPLETED" } }),
    db.eventType.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
      take: 3,
      select: { id: true, title: true, slug: true, duration: true, color: true },
    }),
    db.availability.findFirst({ where: { userId, isActive: true } }),
    db.calendarIntegration.findFirst({ where: { userId } }),
    db.user.findUnique({
      where: { id: userId },
      select: { name: true, username: true },
    }),
    db.booking.count({
      where: {
        hostId: userId,
        status: { in: ["CONFIRMED", "PENDING"] },
        startTime: { gte: now, lte: sevenDaysLater },
      },
    }),
  ]);

  const denominator = completedCount + totalBookings;
  const completionRate =
    denominator > 0 ? Math.round((completedCount / denominator) * 100) : null;

  const checklist = [
    {
      step: "Create your first event",
      done: eventTypes.length > 0,
      href: "/dashboard/event-types",
    },
    {
      step: "Set your availability",
      done: !!availability,
      href: "/dashboard/availability",
    },
    {
      step: "Share your booking link",
      done: !!userProfile?.username,
      href: "/dashboard/settings",
    },
  ];
  const checklistDone = checklist.filter((c) => c.done).length;
  const allDone = checklistDone === checklist.length;

  const firstName = userProfile?.name?.split(" ")[0];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">
            {firstName ? `Welcome back, ${firstName}!` : "Welcome back!"}
          </h1>
          <p className="text-base text-text-muted">
            Here&apos;s what&apos;s happening with your schedule.
          </p>
        </div>
        <Link href="/dashboard/event-types">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> New event
          </Button>
        </Link>
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Bookings"
          value={totalBookings.toString()}
          change={bookingsThisWeek > 0 ? `+${bookingsThisWeek} this week` : "0 this week"}
          changePositive={bookingsThisWeek > 0}
          icon={Calendar}
          href="/dashboard/bookings"
        />
        <StatCard
          label="Upcoming Meetings"
          value={upcomingCount.toString()}
          change="Next 7 days"
          icon={Clock}
          href="/dashboard/bookings"
        />
        <StatCard
          label="Events"
          value={eventTypes.length.toString()}
          change="Active links"
          icon={Users}
          href="/dashboard/event-types"
        />
        <StatCard
          label="Completion Rate"
          value={completionRate !== null ? `${completionRate}%` : "—"}
          change={
            completionRate !== null ? `${completedCount} completed` : "No data yet"
          }
          icon={TrendingUp}
          href="/dashboard/analytics"
        />
      </div>

      {/* ── Main grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming bookings — 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming bookings</CardTitle>
              <CardDescription>Your next scheduled meetings</CardDescription>
            </div>
            <Link href="/dashboard/bookings">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-text-muted hover:text-white"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingBookings.length === 0 ? (
              <EmptyBookings />
            ) : (
              <ul className="divide-y divide-[#44318D]">
                {upcomingBookings.map((b) => {
                  const color = b.eventType.color ?? "#D83F87";
                  return (
                    <li
                      key={b.id}
                      className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      {/* Avatar */}
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                        style={{ background: `${color}20`, color }}
                      >
                        {initials(b.inviteeName)}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-medium text-white">
                          {b.inviteeName}
                        </p>
                        <p className="flex items-center gap-1.5 text-sm text-text-muted">
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ background: color }}
                          />
                          {b.eventType.title} &middot; {b.eventType.duration} min
                        </p>
                      </div>

                      {/* Time + join */}
                      <div className="text-right">
                        <p className="text-sm font-medium text-accent">
                          {fmtTime(b.startTime)}
                        </p>
                        {b.location && (
                          <a
                            href={b.location}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 flex items-center justify-end gap-1 text-xs text-text-muted transition-colors hover:text-white"
                          >
                            Join <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Sidebar — 1 col */}
        <div className="flex flex-col gap-4">
          {/* Getting started */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Getting started</CardTitle>
                  <span className="text-sm text-text-muted">
                    {checklistDone}/{checklist.length}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#44318D]">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{
                      width: `${(checklistDone / checklist.length) * 100}%`,
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-0.5 pt-1">
                {checklist.map(({ step, done, href }) => (
                  <Link
                    key={step}
                    href={href}
                    className="flex items-center gap-2.5 rounded-md p-2 transition-colors hover:bg-bg-primary"
                  >
                    {done ? (
                      <CheckCircle className="h-4 w-4 shrink-0 text-accent" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-border" />
                    )}
                    <span
                      className={`text-sm leading-snug ${
                        done ? "text-text-muted line-through" : "text-white"
                      }`}
                    >
                      {step}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>

          {/* Event types */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Events</CardTitle>
                <Link href="/dashboard/event-types">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs text-text-muted hover:text-white"
                  >
                    Manage <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {eventTypes.length === 0 ? (
                <Link
                  href="/dashboard/event-types"
                  className="flex items-center gap-2 rounded-md border border-dashed border-border p-3 transition-colors hover:border-accent"
                >
                  <Plus className="h-5 w-5 text-text-muted" />
                  <span className="text-sm text-text-muted">
                    Create your first event
                  </span>
                </Link>
              ) : (
                <ul className="space-y-1">
                  {eventTypes.map((et) => (
                    <li key={et.id}>
                      <Link
                        href="/dashboard/event-types"
                        className="flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-bg-primary"
                      >
                        <div
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ background: et.color ?? "#D83F87" }}
                        />
                        <span className="flex-1 truncate text-sm text-white">
                          {et.title}
                        </span>
                        <span className="shrink-0 rounded bg-[#44318D] px-2 py-0.5 text-xs text-text-muted">
                          {et.duration}m
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>


        </div>
      </div>
    </div>
  );
}
