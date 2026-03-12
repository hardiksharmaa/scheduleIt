"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/ui/Logo";

const featureCards = [
  {
    title: "Email confirmations",
    description:
      "Send instant booking confirmations, reminders, and updates so attendees never miss a meeting.",
  },
  {
    title: "Calendar + video integrations",
    description:
      "Connect Google Calendar, Zoom, and Teams to auto-create links and keep your schedule synced.",
  },
  {
    title: "Availability controls",
    description:
      "Define weekly hours, date overrides, and buffers to protect focus time and avoid burnout.",
  },
  {
    title: "Booking pages",
    description:
      "Create clean public booking pages for every event type and let guests schedule instantly.",
  },
  {
    title: "Team scheduling",
    description:
      "Run one-on-one, round-robin, and collective events for distributed teams at scale.",
  },
  {
    title: "Analytics dashboard",
    description:
      "Track bookings, completions, and no-shows to optimize your event types and availability.",
  },
];

const workflowSteps = [
  {
    title: "Create event types",
    description:
      "Set durations, locations, and booking limits for each meeting type.",
  },
  {
    title: "Connect your stack",
    description:
      "Attach calendars and conferencing tools so every booking is coordinated automatically.",
  },
  {
    title: "Share your link",
    description:
      "Guests pick a time, receive email confirmation, and meet with zero admin overhead.",
  },
];

export default function LandingClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const primaryHref = isLoggedIn ? "/dashboard" : "/register";
  const primaryLabel = isLoggedIn ? "Dashboard" : "Start for Free";

  return (
    <div className="min-h-screen bg-bg-primary text-text-light">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <Logo size="lg" />
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <Button variant="secondary" onClick={() => signOut({ callbackUrl: "/" })}>
              Sign out
            </Button>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Log In</Button>
              </Link>
              <Link href="/register">
                <Button>Register</Button>
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-border bg-linear-to-br from-bg-secondary/70 via-bg-secondary/40 to-bg-primary px-6 py-12 shadow-(--shadow-premium) sm:px-10 sm:py-16">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-accent-secondary">
            Scheduling, simplified
          </p>
          <h1 className="max-w-4xl font-display text-5xl leading-[0.92] tracking-[0.02em] text-text-light sm:text-6xl lg:text-7xl">
            Book meetings faster with built-in confirmations, integrations, and team-ready workflows.
          </h1>
          <p className="mt-6 max-w-3xl text-base text-text-muted sm:text-lg">
            ScheduleIt gives you a public booking page, real-time availability, email confirmation flows,
            and calendar/video sync in one place.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={primaryHref}>
              <Button size="lg">{primaryLabel}</Button>
            </Link>
            <Link href={isLoggedIn ? "/dashboard/event-types" : "/register"}>
              <Button size="lg" variant="secondary">
                Explore Events
              </Button>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-text-light/90">
            <span className="rounded-full border border-border px-3 py-1">Email confirmations</span>
            <span className="rounded-full border border-border px-3 py-1">real-time availability</span>
            <span className="rounded-full border border-border px-3 py-1">Booking pages</span>
            <span className="rounded-full border border-border px-3 py-1">Team scheduling</span>
            <span className="rounded-full border border-border px-3 py-1">Analytics</span>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Everything you need in one scheduler</h2>
          <p className="mt-3 max-w-3xl text-text-muted">
            Built for creators, consultants, and teams who need reliable booking workflows from link share to follow-up.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((feature) => (
              <Card key={feature.title} className="h-full">
                <CardHeader>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-bg-secondary/40 p-6 sm:p-8">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">How ScheduleIt works</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <Card key={step.title} className="border-border/80 bg-bg-primary/60">
                <CardHeader>
                  <CardDescription>Step {index + 1}</CardDescription>
                  <CardTitle>{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-text-muted">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

      </main>

      <footer className="w-full overflow-hidden bg-bg-primary py-12 sm:py-16">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
          <h2 className="select-none text-center font-display text-[clamp(4rem,18vw,18rem)] leading-none tracking-[0.04em] text-transparent bg-linear-to-b from-white/90 to-bg-primary/50 bg-clip-text">
            SCHEDULEIT
          </h2>
        </div>
      </footer>
    </div>
  );
}
