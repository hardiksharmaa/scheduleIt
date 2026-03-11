"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Calendar, Clock, User, CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

// ─── Types ─────────────────────────────────────────────────────────────────

interface BookingDetails {
  id: string;
  status: string;
  inviteeName: string;
  inviteeEmail: string;
  inviteeTimezone: string;
  startTime: string;
  endTime: string;
  eventType: { id: string; title: string; duration: number; color: string; userId: string };
  host: { name: string; username: string };
}

interface Slot { start: string; end: string }

// ─── Constants ─────────────────────────────────────────────────────────────

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["S","M","T","W","T","F","S"];

function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function firstDayOfMonth(y: number, m: number) { return new Date(y, m - 1, 1).getDay(); }

function fmt(iso: string, tz: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(new Date(iso));
}
function fmtDate(iso: string, tz: string) {
  return fmt(iso, tz, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
function fmtTime(iso: string, tz: string) {
  return fmt(iso, tz, { hour: "numeric", minute: "2-digit", hour12: true });
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function ReschedulePage() {
  const [token, setToken] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calendar state
  const [timezone, setTimezone] = useState("UTC");
  const [today, setToday] = useState({ year: 0, month: 0, day: 0 });
  const [viewYear, setViewYear] = useState(0);
  const [viewMonth, setViewMonth] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Slots state
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ startTime: string; endTime: string } | null>(null);

  // Load token + booking
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(tz);
    const d = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d).split("-");
    const y = parseInt(parts[0]), m = parseInt(parts[1]), day = parseInt(parts[2]);
    setToday({ year: y, month: m, day });
    setViewYear(y); setViewMonth(m);

    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    if (!t) { setError("Invalid rescheduling link — no token provided."); setLoading(false); return; }

    fetch(`/api/bookings/reschedule?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setBooking(data.booking);
      })
      .catch(() => setError("Failed to load booking."))
      .finally(() => setLoading(false));
  }, []);

  // Load slots when date is picked
  const fetchSlots = useCallback(async (date: string) => {
    if (!booking) return;
    setSlotsLoading(true);
    setSlots([]); setSelectedSlot(null);
    try {
      const url = `/api/slots?eventTypeId=${booking.eventType.id}&date=${date}&timezone=${encodeURIComponent(timezone)}`;
      const res = await fetch(url);
      const data = await res.json();
      setSlots(res.ok ? (data.slots ?? []) : []);
    } finally {
      setSlotsLoading(false);
    }
  }, [booking, timezone]);

  useEffect(() => {
    if (selectedDate) fetchSlots(selectedDate);
  }, [selectedDate, fetchSlots]);

  // Calendar helpers
  const isPastDate = (y: number, m: number, d: number) => {
    if (today.year === 0) return false;
    if (y < today.year) return true;
    if (y === today.year && m < today.month) return true;
    if (y === today.year && m === today.month && d < today.day) return true;
    return false;
  };

  const maxBookableDate = useMemo(() => {
    if (today.year === 0 || !booking?.eventType) return null;
    const d = new Date(today.year, today.month - 1, today.day);
    d.setDate(d.getDate() + 60);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }, [today, booking]);

  const isBeyondMax = (y: number, m: number, d: number) => {
    if (!maxBookableDate) return false;
    if (y > maxBookableDate.year) return true;
    if (y === maxBookableDate.year && m > maxBookableDate.month) return true;
    if (y === maxBookableDate.year && m === maxBookableDate.month && d > maxBookableDate.day) return true;
    return false;
  };

  const canGoToPrev = today.year > 0 && (viewYear > today.year || (viewYear === today.year && viewMonth > today.month));
  const canGoToNext = useMemo(() => {
    if (!maxBookableDate) return true;
    const ny = viewMonth === 12 ? viewYear + 1 : viewYear;
    const nm = viewMonth === 12 ? 1 : viewMonth + 1;
    return !isBeyondMax(ny, nm, 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxBookableDate, viewYear, viewMonth]);

  const buildCells = () => {
    const total = daysInMonth(viewYear, viewMonth);
    const first = firstDayOfMonth(viewYear, viewMonth);
    const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
    const rem = cells.length % 7;
    if (rem) cells.push(...Array(7 - rem).fill(null));
    return cells;
  };

  async function handleSubmit() {
    if (!token || !selectedSlot) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, startTime: selectedSlot.start }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to reschedule."); }
      else setDone({ startTime: data.startTime, endTime: data.endTime });
    } finally {
      setSubmitting(false);
    }
  }

  const tz = booking?.inviteeTimezone ?? timezone;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ background: "#0c0c0c" }}>
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center flex justify-center">
          <Logo size="md" />
        </div>

        <div className="rounded-2xl p-8" style={{ background: "#2A1B3D", border: "1px solid #44318D" }}>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mb-3" style={{ color: "#A4B3B6" }} />
              <p className="text-sm" style={{ color: "#A4B3B6" }}>Loading booking…</p>
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

          {/* Success */}
          {done && booking && (
            <div className="flex flex-col items-center py-4 text-center">
              <CheckCircle className="h-12 w-12 mb-4" style={{ color: "#4ade80" }} />
              <h1 className="text-xl font-bold text-white mb-2">Booking rescheduled!</h1>
              <p className="text-sm mb-1" style={{ color: "#A4B3B6" }}>
                {booking.eventType.title} with {booking.host.name}
              </p>
              <p className="text-sm font-medium text-white mb-1">{fmtDate(done.startTime, tz)}</p>
              <p className="text-sm mb-6" style={{ color: "#A4B3B6" }}>
                {fmtTime(done.startTime, tz)} – {fmtTime(done.endTime, tz)}
              </p>
              <Link href="/" className="text-sm font-medium hover:underline" style={{ color: "#D83F87" }}>Return home</Link>
            </div>
          )}

          {/* Main reschedule flow */}
          {!loading && !error && !done && booking && (
            <>
              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ background: booking.eventType.color }} />
                  <h1 className="text-lg font-bold text-white">Reschedule</h1>
                </div>
                <p className="text-sm ml-5" style={{ color: "#A4B3B6" }}>
                  {booking.eventType.title} with {booking.host.name}
                </p>
              </div>

              {/* Current booking summary */}
              <div className="rounded-xl p-3 mb-6 space-y-2" style={{ background: "#0c0c0c", border: "1px solid #44318D" }}>
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#A4B3B6" }}>Current time</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: "#A4B3B6" }} />
                  <span className="text-sm" style={{ color: "#A4B3B6" }}>{fmtDate(booking.startTime, tz)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: "#A4B3B6" }} />
                  <span className="text-sm" style={{ color: "#A4B3B6" }}>
                    {fmtTime(booking.startTime, tz)} – {fmtTime(booking.endTime, tz)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 shrink-0" style={{ color: "#A4B3B6" }} />
                  <span className="text-sm" style={{ color: "#A4B3B6" }}>{booking.inviteeName}</span>
                </div>
              </div>

              {/* Calendar */}
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#A4B3B6" }}>Pick a new date</p>

              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => { if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }}
                  disabled={!canGoToPrev}
                  className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[#44318D] disabled:opacity-20 disabled:pointer-events-none"
                  style={{ color: "#A4B3B6" }}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold text-white">{MONTHS[viewMonth - 1]} {viewYear}</span>
                <button onClick={() => { if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }}
                  disabled={!canGoToNext}
                  className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[#44318D] disabled:opacity-20 disabled:pointer-events-none"
                  style={{ color: "#A4B3B6" }}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Day headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 }}>
                {DAY_LABELS.map((d, i) => (
                  <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: "#A4B3B6", padding: "0 0 4px" }}>{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 20 }}>
                {buildCells().map((day, idx) => {
                  if (!day) return <div key={`e-${idx}`} style={{ aspectRatio: "1/1" }} />;
                  const dateStr = `${viewYear}-${String(viewMonth).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                  const past = isPastDate(viewYear, viewMonth, day);
                  const beyond = isBeyondMax(viewYear, viewMonth, day);
                  const disabled = past || beyond;
                  const isToday = viewYear === today.year && viewMonth === today.month && day === today.day;
                  const isSelected = dateStr === selectedDate;
                  const bg = isSelected ? "#D83F87" : "transparent";
                  const fg = disabled ? "#44318D" : isSelected ? "#fff" : isToday ? "#fff" : "#A4B3B6";
                  const ring = isToday && !isSelected ? "inset 0 0 0 1px #D83F8744" : "none";

                  return (
                    <button key={dateStr} disabled={disabled}
                      onClick={() => { setSelectedDate(dateStr); setSelectedSlot(null); }}
                      style={{ aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: 7, fontSize: 12, fontWeight: isSelected || isToday ? 600 : 400,
                        background: bg, color: fg, cursor: disabled ? "default" : "pointer",
                        boxShadow: ring, border: "none", outline: "none", transition: "background 0.1s" }}
                      onMouseEnter={(e) => { if (!disabled && !isSelected) e.currentTarget.style.background = "#44318D"; }}
                      onMouseLeave={(e) => { if (!disabled && !isSelected) e.currentTarget.style.background = bg; }}
                    >{day}</button>
                  );
                })}
              </div>

              {/* Slots */}
              {selectedDate && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#A4B3B6" }}>
                    Available times — {fmt(selectedDate + "T12:00:00Z", tz, { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                  {slotsLoading && (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#A4B3B6" }} />
                    </div>
                  )}
                  {!slotsLoading && slots.length === 0 && (
                    <p className="text-sm text-center py-4" style={{ color: "#A4B3B6" }}>No available times on this day.</p>
                  )}
                  {!slotsLoading && slots.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-6">
                      {slots.map((s) => {
                        const isSel = selectedSlot?.start === s.start;
                        return (
                          <button key={s.start} onClick={() => setSelectedSlot(s)}
                            className="rounded-lg py-2 text-xs font-medium transition-colors"
                            style={isSel
                              ? { background: "#D83F87", color: "#000" }
                              : { background: "#2A1B3D", color: "#A4B3B6", border: "1px solid #44318D" }}>
                            {fmtTime(s.start, tz)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!selectedSlot || submitting}
                className="w-full rounded-xl py-3 text-sm font-semibold transition-opacity disabled:opacity-40"
                style={{ background: "#D83F87", color: "#000" }}
              >
                {submitting ? "Rescheduling…" : selectedSlot ? `Reschedule to ${fmtTime(selectedSlot.start, tz)}` : "Select a new time"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
