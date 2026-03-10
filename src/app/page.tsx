import Link from "next/link";
import { Calendar, Clock, Users, Zap, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: "Calendar",
    title: "Smart Scheduling",
    description: "Share your booking link and let guests pick a time. No back-and-forth emails.",
  },
  {
    icon: "Clock",
    title: "Flexible Availability",
    description: "Set your weekly schedule, add date overrides, and buffer time between meetings.",
  },
  {
    icon: "Users",
    title: "Team Scheduling",
    description: "Round-robin, collective, and group events for your entire team.",
  },
  {
    icon: "Zap",
    title: "Auto Integrations",
    description: "Auto-creates Zoom, Google Meet, or Teams links and sends calendar invites.",
  },
];

const iconMap = { Calendar, Clock, Users, Zap } as const;

const plans = [
  "Unlimited booking links",
  "Google Calendar sync",
  "Zoom & Teams integration",
  "Email confirmations & reminders",
  "Team scheduling (round-robin)",
  "Analytics dashboard",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0c0c0c]">
      {/* Navbar */}
      <nav className="border-b border-[#2e2e2e] bg-[#181818]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c4956a]">
              <Calendar className="h-4 w-4 text-[#ffffff]" />
            </div>
            <span className="text-lg font-bold text-[#ffffff]">ScheduleIt</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/login">
              <Button size="sm">Get started free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#2e2e2e] bg-[#181818] px-4 py-1.5 text-xs text-[#9a9a9a]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#c4956a]" />
          Scheduling, simplified
        </div>
        <h1 className="mb-6 text-5xl font-bold leading-tight text-[#ffffff]">
          Easy scheduling for
          <br />
          <span className="text-[#c4956a]">busy people</span>
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-lg text-[#9a9a9a]">
          Create your booking page, share your link, and let others schedule meetings with you
          automatically.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/login">
            <Button size="lg" className="gap-2">
              Start for free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="secondary" size="lg">
              View demo
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold text-[#ffffff]">
          Everything you need to schedule smarter
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon, title, description }) => {
            const Icon = iconMap[icon as keyof typeof iconMap];
            return (
              <div key={title} className="rounded-xl border border-[#2e2e2e] bg-[#181818] p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#0c0c0c]">
                  <Icon className="h-5 w-5 text-[#c4956a]" />
                </div>
                <h3 className="mb-2 font-semibold text-[#ffffff]">{title}</h3>
                <p className="text-sm text-[#9a9a9a]">{description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h2 className="mb-10 text-3xl font-bold text-[#ffffff]">Everything included</h2>
        <div className="rounded-xl border border-[#2e2e2e] bg-[#181818] p-8">
          <ul className="space-y-4 text-left">
            {plans.map((label) => (
              <li key={label} className="flex items-center gap-3">
                <Check className="h-4 w-4 shrink-0 text-[#c4956a]" />
                <span className="text-[#ffffff]">{label}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Link href="/login">
              <Button size="lg" className="w-full">
                Get started free
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2e2e2e] bg-[#181818] py-8">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm text-[#9a9a9a]">
            © 2026 ScheduleIt. Built with Next.js, Tailwind, and Shadcn UI.
          </p>
        </div>
      </footer>
    </div>
  );
}
