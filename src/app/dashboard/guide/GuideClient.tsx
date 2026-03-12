"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  Clock,
  Link2,
  Share2,
  Users,
  BarChart2,
  Plug,
  Settings,
  CalendarCheck,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ArrowRight,
  BookOpen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GuideSection {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  summary: string;
  steps: { title: string; detail: string }[];
  tips?: string[];
  href?: string;
}

// ─── Guide Data ───────────────────────────────────────────────────────────────

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "quick-start",
    title: "Quick Start — Your First Booking in 3 Steps",
    icon: Sparkles,
    color: "#D83F87",
    summary:
      "The fastest way to start receiving bookings. Follow these three steps and you'll be live in under 5 minutes.",
    steps: [
      {
        title: "1. Create an Event",
        detail:
          'Go to Events and click "New event". Give it a name (e.g. "30 min intro call"), pick a duration, and choose a meeting location (Zoom, Google Meet, phone, etc.). Enable the days you\'re available and save.',
      },
      {
        title: "2. Set Your Availability",
        detail:
          "Head to Availability and define your weekly working hours — which days and what time window you accept bookings. This is your default schedule that applies to all events unless overridden.",
      },
      {
        title: "3. Share Your Booking Link",
        detail:
          'Each event gets a unique booking link. Go to Events, click "Booking Page" to preview it, or click the copy icon to grab the URL. Paste it in an email, on your website, or in your social media bio — anyone who visits can pick a time and book!',
      },
    ],
    tips: [
      "Make sure you set a username in Settings first — your booking links use it.",
      "Connect Google Calendar to automatically block busy times.",
    ],
    href: "/dashboard/event-types",
  },
  {
    id: "events",
    title: "Events",
    icon: CalendarPlus,
    color: "#D83F87",
    summary:
      "Events are the meeting types you offer (e.g. \"30 min call\", \"1 hour consultation\"). Each event becomes a shareable booking page.",
    steps: [
      {
        title: "Creating an event",
        detail:
          'Click "New event" on the Events page. Fill in the title, duration, and location type. You can also add a description, set a booking window (how far in advance people can book), and choose which days of the week to allow.',
      },
      {
        title: "Event categories",
        detail:
          "Events can be One-on-One (default), Group (multiple attendees per slot), Round Robin (rotates among team members), or Collective (requires all team members to be free).",
      },
      {
        title: "Editing & managing",
        detail:
          "Each event card shows a toggle to activate/deactivate it, a \"Booking Page\" button to preview, a copy button for the link, and edit/delete options. Inactive events won't accept new bookings.",
      },
      {
        title: "Buffer times & minimum notice",
        detail:
          "You can set buffer time before and after meetings to avoid back-to-back calls. Minimum notice prevents last-minute bookings (e.g. require 2 hours notice).",
      },
    ],
    href: "/dashboard/event-types",
  },
  {
    id: "bookings",
    title: "Bookings",
    icon: CalendarCheck,
    color: "#818cf8",
    summary:
      "When someone books a time through your link, it appears here. You can view, confirm, reschedule, or cancel any booking.",
    steps: [
      {
        title: "Viewing bookings",
        detail:
          "The Bookings page shows all your meetings organized by status — upcoming confirmed ones, pending requests, completed past meetings, and cancelled ones. Use the tabs to filter.",
      },
      {
        title: "Managing a booking",
        detail:
          "Click on any booking to see details including attendee info, meeting link, time, and notes. You can reschedule (pick a new time), cancel (with optional message to attendee), or mark as complete.",
      },
      {
        title: "Automatic completion",
        detail:
          "Bookings are automatically marked as completed once their end time has passed, so you don't need to do anything manually.",
      },
    ],
    href: "/dashboard/bookings",
  },
  {
    id: "availability",
    title: "Availability",
    icon: Clock,
    color: "#34d399",
    summary:
      "Your availability controls when people can book meetings with you. Set your weekly hours and add date-specific overrides.",
    steps: [
      {
        title: "Weekly schedule",
        detail:
          "Set your working hours for each day of the week. Toggle individual days on/off and set start/end times. These are your default bookable hours.",
      },
      {
        title: "Date overrides",
        detail:
          "Need to block a specific date or change hours for one day? Add a date override. For example, mark Dec 25 as unavailable, or set shorter hours on a Friday.",
      },
      {
        title: "Per-event availability",
        detail:
          "When creating an event, you can choose which days from your schedule to include. For example, a \"Friday office hours\" event can be limited to Fridays only.",
      },
    ],
    href: "/dashboard/availability",
  },
  {
    id: "teams",
    title: "Teams",
    icon: Users,
    color: "#f59e0b",
    summary:
      "Create teams to let multiple people share scheduling. Great for sales teams, support rotations, or any group that meets with external people.",
    steps: [
      {
        title: "Creating a team",
        detail:
          "Click \"New team\", give it a name and optional description. You'll automatically become the owner.",
      },
      {
        title: "Adding members",
        detail:
          "Invite team members by their email address. They must have a ScheduleIt account. Members will appear in the team's routing and scheduling.",
      },
      {
        title: "Team events",
        detail:
          "Create events on the team — choose Round Robin (assigns bookings in rotation among members) or Collective (requires all members to be free). Team events get their own booking page at /team/[team-slug]/[event-slug].",
      },
    ],
    href: "/dashboard/teams",
  },
  {
    id: "integrations",
    title: "Integrations",
    icon: Plug,
    color: "#60a5fa",
    summary:
      "Connect external services to enhance your scheduling. Sync calendars, auto-create video meeting links, and more.",
    steps: [
      {
        title: "Google Calendar",
        detail:
          "Connect Google Calendar to automatically check for conflicts — busy events on your calendar will block those times from bookings. New bookings are also synced back to your calendar.",
      },
      {
        title: "Zoom (coming soon)",
        detail:
          "When connected, Zoom meeting links will be automatically generated for events that use video calls.",
      },
      {
        title: "Microsoft Teams (coming soon)",
        detail:
          "Similar to Zoom — auto-creates Teams meeting links for your bookings.",
      },
    ],
    href: "/dashboard/integrations",
  },
  {
    id: "analytics",
    title: "Analytics",
    icon: BarChart2,
    color: "#a78bfa",
    summary:
      "Track your booking trends, see which events are most popular, monitor your completion rate, and understand your scheduling patterns.",
    steps: [
      {
        title: "Dashboard stats",
        detail:
          "The main dashboard shows key numbers at a glance — total bookings, upcoming meetings this week, active events, and completion rate.",
      },
      {
        title: "Detailed analytics",
        detail:
          "The Analytics page provides charts and breakdowns: bookings over time, top events by bookings, status distribution (confirmed, completed, cancelled), and daily/weekly patterns.",
      },
    ],
    href: "/dashboard/analytics",
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    color: "#94a3b8",
    summary:
      "Manage your profile, set your username (used in booking links), update your timezone, and handle account actions.",
    steps: [
      {
        title: "Username",
        detail:
          "Your username is part of your booking URL (scheduleit.com/your-username/event-slug). Set it in Settings. It must be unique.",
      },
      {
        title: "Profile & timezone",
        detail:
          "Update your display name, profile picture, and timezone. Your timezone affects how availability slots are calculated for your calendar.",
      },
      {
        title: "Account deletion",
        detail:
          "If you ever need to delete your account, you can do so from the Danger Zone in Settings. This permanently removes all your data.",
      },
    ],
    href: "/dashboard/settings",
  },
];

// ─── Section Component ────────────────────────────────────────────────────────

function GuideSection({ section }: { section: GuideSection }) {
  const [expanded, setExpanded] = useState(section.id === "quick-start");
  const Icon = section.icon;

  return (
    <div className="rounded-2xl border border-border bg-bg-secondary overflow-hidden transition-colors hover:border-[#3e3e3e]">
      {/* Header — clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 px-6 py-5 text-left"
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${section.color}20` }}
        >
          <Icon className="h-5 w-5" style={{ color: section.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">{section.title}</h3>
          <p className="mt-0.5 text-xs text-text-muted line-clamp-1">
            {section.summary}
          </p>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-border px-6 py-5 space-y-4">
          <p className="text-sm text-text-muted leading-relaxed">
            {section.summary}
          </p>

          {/* Steps */}
          <div className="space-y-3">
            {section.steps.map((step, i) => (
              <div
                key={i}
                className="rounded-xl bg-bg-primary/60 border border-border/50 px-5 py-4"
              >
                <h4 className="text-sm font-medium text-white">{step.title}</h4>
                <p className="mt-1.5 text-xs text-text-muted leading-relaxed">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>

          {/* Tips */}
          {section.tips && section.tips.length > 0 && (
            <div className="rounded-xl bg-accent/5 border border-accent/20 px-5 py-4">
              <p className="text-xs font-semibold text-accent mb-2">
                💡 Pro Tips
              </p>
              <ul className="space-y-1.5">
                {section.tips.map((tip, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-text-muted"
                  >
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Link to section */}
          {section.href && (
            <Link
              href={section.href}
              className="inline-flex items-center gap-2 text-xs font-medium text-accent hover:underline"
            >
              Go to {section.title}
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Guide Page ──────────────────────────────────────────────────────────

export default function GuideClient() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
            <BookOpen className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">User Guide</h1>
            <p className="text-sm text-text-muted">
              Everything you need to know to get the most out of ScheduleIt.
            </p>
          </div>
        </div>
      </div>

      {/* How it works — visual flow */}
      <div className="rounded-2xl border border-border bg-bg-secondary px-6 py-5">
        <h2 className="text-sm font-semibold text-white mb-3">
          How ScheduleIt Works
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="rounded-full bg-accent/15 px-4 py-1.5 font-medium text-accent">
            Create Event
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
          <span className="rounded-full bg-accent/15 px-4 py-1.5 font-medium text-accent">
            Set Availability
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
          <span className="rounded-full bg-accent/15 px-4 py-1.5 font-medium text-accent">
            Share Booking Link
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
          <span className="rounded-full bg-emerald-500/15 px-4 py-1.5 font-medium text-emerald-400">
            Receive Bookings!
          </span>
        </div>
        <p className="mt-3 text-center text-xs text-text-muted">
          That&apos;s it — your invitees see your available times, pick a slot, and confirm. You get notified instantly.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {GUIDE_SECTIONS.map((section) => (
          <GuideSection key={section.id} section={section} />
        ))}
      </div>

      {/* Footer help */}
      <div className="rounded-2xl border border-border bg-bg-secondary px-6 py-5 text-center">
        <p className="text-sm text-text-muted">
          Still have questions? Reach out at{" "}
          <a
            href="mailto:support@scheduleit.com"
            className="font-medium text-accent hover:underline"
          >
            hs489819@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}
