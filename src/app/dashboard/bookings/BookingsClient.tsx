"use client";

import { useState } from "react";
import { Calendar, Clock, MapPin, Mail, User, ExternalLink, XCircle, CheckCircle, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SerializedBooking {
  id: string;
  inviteeName: string;
  inviteeEmail: string;
  inviteeTimezone: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  location: string | null;
  cancelToken: string | null;
  eventType: {
    title: string;
    color: string;
    duration: number;
    teamName?: string | null;
  };
}

interface Props {
  upcoming: SerializedBooking[];
  cancelled: SerializedBooking[];
  completed: SerializedBooking[];
  stats: { upcoming: number; completed: number; cancelled: number; total: number };
  initialView: "upcoming" | "cancelled" | "completed";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function formatTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function StatusBadge({ status }: { status: string }) {
  if (status === "CONFIRMED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: "#0d2d1a", color: "#4ade80" }}>
        <CheckCircle className="h-3 w-3" /> Confirmed
      </span>
    );
  }
  if (status === "CANCELLED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: "#2d1010", color: "#f87171" }}>
        <XCircle className="h-3 w-3" /> Cancelled
      </span>
    );
  }
  if (status === "COMPLETED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: "#0d1a2d", color: "#60a5fa" }}>
        <CheckCircle className="h-3 w-3" /> Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: "#1e1a0a", color: "#fbbf24" }}>
      <AlertCircle className="h-3 w-3" /> {status}
    </span>
  );
}

function BookingCard({ booking, onCancel }: {
  booking: SerializedBooking;
  onCancel: (id: string) => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const tz = booking.inviteeTimezone ?? "UTC";
  const isPast = new Date(booking.startTime) < new Date();
  const canCancel = booking.status === "CONFIRMED" && !isPast;

  async function handleCancel() {
    if (!confirm(`Cancel booking with ${booking.inviteeName}?`)) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id, cancelledBy: "host" }),
      });
      if (res.ok) onCancel(booking.id);
      else {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Failed to cancel booking");
      }
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div
      className="rounded-xl p-4 transition-colors"
      style={{
        background: "#111",
        border: "1px solid #1e1e1e",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: color bar + info */}
        <div className="flex items-start gap-3 min-w-0">
          {/* color bar */}
          <div
            className="mt-1 h-4 w-1 shrink-0 rounded-full"
            style={{ background: booking.eventType.color }}
          />
          <div className="min-w-0">
            {/* Event title + status */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-white truncate">
                {booking.eventType.title}
              </span>
              {booking.eventType.teamName && (
                <span
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold"
                  style={{ background: "#c4956a22", color: "#c4956a", border: "1px solid #c4956a44" }}
                >
                  👥 {booking.eventType.teamName}
                </span>
              )}
              <StatusBadge status={booking.status} />
            </div>

            {/* Invitee */}
            <div className="flex items-center gap-1.5 mb-2">
              <User className="h-3.5 w-3.5 shrink-0" style={{ color: "#6a6a6a" }} />
              <span className="text-sm" style={{ color: "#9a9a9a" }}>{booking.inviteeName}</span>
              <span style={{ color: "#444" }}>·</span>
              <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: "#6a6a6a" }} />
              <span className="text-xs truncate" style={{ color: "#6a6a6a" }}>{booking.inviteeEmail}</span>
            </div>

            {/* Date + time */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: "#6a6a6a" }} />
                <span className="text-xs" style={{ color: "#9a9a9a" }}>
                  {formatDate(booking.startTime, tz)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: "#6a6a6a" }} />
                <span className="text-xs" style={{ color: "#9a9a9a" }}>
                  {formatTime(booking.startTime, tz)} – {formatTime(booking.endTime, tz)}
                  <span className="ml-1" style={{ color: "#555" }}>({booking.eventType.duration} min)</span>
                </span>
              </div>
              {booking.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "#6a6a6a" }} />
                  {booking.location.startsWith("http") ? (
                    <a
                      href={booking.location}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs hover:underline"
                      style={{ color: "#c4956a" }}
                    >
                      Join meeting <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-xs" style={{ color: "#9a9a9a" }}>{booking.location}</span>
                  )}
                </div>
              )}
            </div>

            {booking.notes && (
              <p className="mt-2 text-xs italic" style={{ color: "#666" }}>
                &ldquo;{booking.notes}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Right: action buttons */}
        {canCancel && (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[#2a1212] disabled:opacity-50"
              style={{ border: "1px solid #3a1a1a", color: "#ef4444" }}
            >
              {cancelling ? "Cancelling…" : "Cancel"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BookingsClient({ upcoming, cancelled, completed, stats, initialView }: Props) {
  const [view, setView] = useState<"upcoming" | "cancelled" | "completed">(initialView);
  const [upcomingList, setUpcomingList] = useState(upcoming);
  const [cancelledList, setCancelledList] = useState(cancelled);
  const [completedList, setCompletedList] = useState(completed);

  function handleCancel(id: string) {
    const booking = upcomingList.find((b) => b.id === id);
    if (booking) {
      setUpcomingList((prev) => prev.filter((b) => b.id !== id));
      setCancelledList((prev) => [{ ...booking, status: "CANCELLED" }, ...prev]);
    }
  }

  const displayed =
    view === "upcoming" ? upcomingList
    : view === "cancelled" ? cancelledList
    : completedList;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Bookings</h1>
        <p className="text-sm" style={{ color: "#9a9a9a" }}>
          View and manage your upcoming and past bookings.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: stats.total, color: "#9a9a9a" },
          { label: "Upcoming", value: stats.upcoming, color: "#c4956a" },
          { label: "Completed", value: stats.completed, color: "#4ade80" },
          { label: "Cancelled", value: stats.cancelled, color: "#f87171" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-4"
            style={{ background: "#111", border: "1px solid #1e1e1e" }}
          >
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#555" }}>
              {s.label}
            </p>
            <p className="mt-1 text-2xl font-bold" style={{ color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 rounded-xl p-1"
        style={{ background: "#111", border: "1px solid #1e1e1e", width: "fit-content" }}
      >
        {(["upcoming", "cancelled", "completed"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className="rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors"
            style={
              view === tab
                ? { background: "#1e1e1e", color: "#fff" }
                : { color: "#6a6a6a" }
            }
          >
            {tab === "upcoming"
              ? `Upcoming (${upcomingList.length})`
              : tab === "cancelled"
              ? `Cancelled (${cancelledList.length})`
              : `Completed (${completedList.length})`}
          </button>
        ))}
      </div>

      {/* Booking list */}
      {displayed.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl py-20"
          style={{ background: "#111", border: "1px solid #1e1e1e" }}
        >
          <Calendar className="mb-3 h-10 w-10" style={{ color: "#333" }} />
          <p className="text-sm font-medium" style={{ color: "#555" }}>
            {view === "upcoming" ? "No upcoming bookings" : view === "cancelled" ? "No cancelled bookings" : "No completed bookings yet"}
          </p>
          {view === "upcoming" && (
            <p className="mt-1 text-xs" style={{ color: "#444" }}>
              Share your booking link to start receiving bookings.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((b) => (
            <BookingCard key={b.id} booking={b} onCancel={handleCancel} />
          ))}
        </div>
      )}
    </div>
  );
}
