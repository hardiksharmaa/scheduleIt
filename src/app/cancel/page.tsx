"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, User, CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

interface BookingDetails {
  id: string;
  status: string;
  inviteeName: string;
  inviteeEmail: string;
  inviteeTimezone: string;
  startTime: string;
  endTime: string;
  eventType: { title: string; duration: number; color: string };
  host: { name: string };
}

function formatDateTime(iso: string, tz: string, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(new Date(iso));
}

export default function CancelPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    if (!t) { setError("Invalid cancellation link — no token provided."); setLoading(false); return; }

    fetch(`/api/bookings/cancel-token?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); }
        else { setBooking(data.booking); }
      })
      .catch(() => setError("Failed to load booking details."))
      .finally(() => setLoading(false));
  }, []);

  async function handleCancel() {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings/cancel-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to cancel."); return; }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  const tz = booking?.inviteeTimezone ?? "UTC";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16"
      style={{ background: "#0c0c0c" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center flex justify-center">
          <Logo size="md" />
        </div>

        <div className="rounded-2xl p-8" style={{ background: "#2A1B3D", border: "1px solid #44318D" }}>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mb-3" style={{ color: "#A4B3B6" }} />
              <p className="text-sm" style={{ color: "#A4B3B6" }}>Loading booking details…</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && !done && (
            <div className="flex flex-col items-center py-4 text-center">
              <XCircle className="h-12 w-12 mb-4" style={{ color: "#ef4444" }} />
              <h1 className="text-lg font-bold text-white mb-2">Something went wrong</h1>
              <p className="text-sm" style={{ color: "#A4B3B6" }}>{error}</p>
            </div>
          )}

          {/* Already cancelled */}
          {!loading && !error && booking?.status === "CANCELLED" && (
            <div className="flex flex-col items-center py-4 text-center">
              <CheckCircle className="h-12 w-12 mb-4" style={{ color: "#A4B3B6" }} />
              <h1 className="text-lg font-bold text-white mb-2">Already cancelled</h1>
              <p className="text-sm" style={{ color: "#A4B3B6" }}>This booking has already been cancelled.</p>
            </div>
          )}

          {/* Success */}
          {done && (
            <div className="flex flex-col items-center py-4 text-center">
              <CheckCircle className="h-12 w-12 mb-4" style={{ color: "#4ade80" }} />
              <h1 className="text-xl font-bold text-white mb-2">Booking cancelled</h1>
              <p className="text-sm mb-6" style={{ color: "#A4B3B6" }}>
                Your booking has been cancelled. A confirmation has been sent to {booking?.inviteeEmail}.
              </p>
              <Link href="/" className="text-sm font-medium hover:underline" style={{ color: "#D83F87" }}>
                Return home
              </Link>
            </div>
          )}

          {/* Confirm cancel form */}
          {!loading && !error && !done && booking && booking.status !== "CANCELLED" && (
            <>
              <div className="mb-6">
                <div className="mb-1 flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ background: booking.eventType.color }} />
                  <h1 className="text-lg font-bold text-white">Cancel this booking?</h1>
                </div>
                <p className="text-sm ml-5" style={{ color: "#A4B3B6" }}>
                  {booking.eventType.title} with {booking.host.name}
                </p>
              </div>

              {/* Booking details */}
              <div className="rounded-xl p-4 mb-6 space-y-3" style={{ background: "#0c0c0c", border: "1px solid #44318D" }}>
                <div className="flex items-center gap-2.5">
                  <User className="h-4 w-4 shrink-0" style={{ color: "#A4B3B6" }} />
                  <span className="text-sm text-white">{booking.inviteeName}</span>
                  <span style={{ color: "#A4B3B6" }}>·</span>
                  <span className="text-xs" style={{ color: "#666" }}>{booking.inviteeEmail}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-4 w-4 shrink-0" style={{ color: "#A4B3B6" }} />
                  <span className="text-sm" style={{ color: "#ccc" }}>
                    {formatDateTime(booking.startTime, tz, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 shrink-0" style={{ color: "#A4B3B6" }} />
                  <span className="text-sm" style={{ color: "#ccc" }}>
                    {formatDateTime(booking.startTime, tz, { hour: "numeric", minute: "2-digit", hour12: true })}
                    {" – "}
                    {formatDateTime(booking.endTime, tz, { hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" })}
                  </span>
                </div>
              </div>

              {/* Optional reason */}
              <div className="mb-6">
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#A4B3B6" }}>
                  Reason for cancelling (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Let us know why you're cancelling…"
                  className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1"
                  style={{
                    background: "#0c0c0c",
                    border: "1px solid #44318D",
                    color: "#fff",
                  }}
                />
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleCancel}
                  disabled={submitting}
                  className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
                  style={{ background: "#c4160a", color: "#fff" }}
                >
                  {submitting ? "Cancelling…" : "Confirm cancellation"}
                </button>
                <Link
                  href="/"
                  className="w-full rounded-lg py-2.5 text-sm font-medium text-center transition-colors hover:bg-[#2A1B3D]"
                  style={{ color: "#A4B3B6", border: "1px solid #44318D" }}
                >
                  Keep my booking
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
