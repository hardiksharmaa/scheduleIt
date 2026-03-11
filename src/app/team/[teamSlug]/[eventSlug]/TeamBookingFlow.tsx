"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Clock, Check, Loader2, Calendar, Globe,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "calendar" | "slots" | "form" | "confirmation";

interface Slot { start: string; end: string; }

interface BookingConfirmation { bookingId: string; startTime: string; endTime: string; }

export interface TeamBookingFlowProps {
  teamEventTypeId: string;
  eventTitle:      string;
  duration:        number;
  teamName:        string;
  maxAdvanceDays?: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_LABELS = ["S","M","T","W","T","F","S"];
const STEPS: Step[] = ["calendar","slots","form","confirmation"];
const STEP_LABELS: Record<Step,string> = { calendar:"Date", slots:"Time", form:"Details", confirmation:"Done" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(isoStr: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(isoStr));
}
function formatDateLong(dateStr: string) {
  const [y,m,d] = dateStr.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("en-US",{ weekday:"long", month:"long", day:"numeric" });
}
function daysInMonth(y: number, m: number) { return new Date(y,m,0).getDate(); }
function firstDayOfMonth(y: number, m: number) { return new Date(y,m-1,1).getDay(); }

// ─── Step Dots ────────────────────────────────────────────────────────────────

function StepDots({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="mb-8 flex items-center gap-3">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1.5">
          <div style={{ height: 2, borderRadius: 999, background: i <= idx ? "#D83F87" : "#44318D", width: i === idx ? 20 : 10, transition: "width 0.2s, background 0.2s" }} />
          <span style={{ fontSize: 11, fontWeight: i === idx ? 600 : 400, color: i === idx ? "#D83F87" : i < idx ? "#A4B3B6" : "#A4B3B6", transition: "color 0.2s" }}>
            {STEP_LABELS[s]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TeamBookingFlow({
  teamEventTypeId, eventTitle, teamName, maxAdvanceDays,
}: TeamBookingFlowProps) {
  const [step, setStep]               = useState<Step>("calendar");
  const [timezone, setTimezone]       = useState("UTC");
  const [today, setToday]             = useState({ year: 0, month: 0, day: 0 });
  const [viewYear, setViewYear]       = useState(0);
  const [viewMonth, setViewMonth]     = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [slots, setSlots]             = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError]   = useState<string | null>(null);
  const [form, setForm]               = useState({ name: "", email: "", notes: "" });
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(tz);
    const now = new Date();
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US",{ timeZone: tz, year:"numeric", month:"2-digit", day:"2-digit" })
        .formatToParts(now).map((p) => [p.type, p.value])
    );
    const y = parseInt(parts.year), m = parseInt(parts.month), d = parseInt(parts.day);
    setToday({ year: y, month: m, day: d });
    setViewYear(y);
    setViewMonth(m);
  }, []);

  const fetchSlots = useCallback(async (date: string) => {
    setSlotsLoading(true); setSlotsError(null); setSlots([]);
    try {
      const res = await fetch(
        `/api/slots/team?teamEventTypeId=${encodeURIComponent(teamEventTypeId)}&date=${date}&timezone=${encodeURIComponent(timezone)}`
      );
      const data = await res.json();
      if (res.ok) setSlots(data.slots ?? []);
      else setSlotsError(data.error ?? "Failed to load available times");
    } catch { setSlotsError("Network error — please try again"); }
    finally { setSlotsLoading(false); }
  }, [teamEventTypeId, timezone]);

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr); setSelectedSlot(null);
    setStep("slots"); fetchSlots(dateStr);
  };
  const handleSlotSelect = (slot: Slot) => {
    setSelectedSlot(slot); setSubmitError(null); setStep("form");
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true); setSubmitError(null);
    try {
      const res = await fetch("/api/bookings/create/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamEventTypeId,
          inviteeName:     form.name.trim(),
          inviteeEmail:    form.email.trim(),
          inviteeTimezone: timezone,
          startTime:       selectedSlot.start,
          notes:           form.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) { setConfirmation(data); setStep("confirmation"); }
      else setSubmitError(data.error ?? "Booking failed — please try again");
    } catch { setSubmitError("Network error — please try again"); }
    finally { setSubmitting(false); }
  };

  const isPastDate = (y: number, m: number, d: number) => {
    if (today.year === 0) return false;
    if (y < today.year) return true;
    if (y === today.year && m < today.month) return true;
    if (y === today.year && m === today.month && d < today.day) return true;
    return false;
  };
  const maxBookableDate = useMemo(() => {
    if (!maxAdvanceDays || today.year === 0) return null;
    const d = new Date(today.year, today.month - 1, today.day);
    d.setDate(d.getDate() + maxAdvanceDays);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }, [today, maxAdvanceDays]);
  const isBeyondMaxAdvance = (y: number, m: number, d: number) => {
    if (!maxBookableDate) return false;
    if (y > maxBookableDate.year) return true;
    if (y === maxBookableDate.year && m > maxBookableDate.month) return true;
    if (y === maxBookableDate.year && m === maxBookableDate.month && d > maxBookableDate.day) return true;
    return false;
  };
  const canGoToPrevMonth = today.year > 0 && (viewYear > today.year || (viewYear === today.year && viewMonth > today.month));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canGoToNextMonth = useMemo(() => {
    if (!maxBookableDate) return true;
    const ny = viewMonth === 12 ? viewYear + 1 : viewYear;
    const nm = viewMonth === 12 ? 1 : viewMonth + 1;
    return !isBeyondMaxAdvance(ny, nm, 1);
  }, [maxBookableDate, viewYear, viewMonth]);
  const goToPrevMonth = () => { if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1); } else setViewMonth((m) => m - 1); };
  const goToNextMonth = () => { if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1); } else setViewMonth((m) => m + 1); };

  const buildCalendarCells = () => {
    const totalDays = daysInMonth(viewYear, viewMonth);
    const firstDay  = firstDayOfMonth(viewYear, viewMonth);
    const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];
    const rem = cells.length % 7;
    if (rem !== 0) cells.push(...Array(7 - rem).fill(null));
    return cells;
  };

  return (
    <div>
      <StepDots current={step} />

      {/* Step 1 — Calendar */}
      {step === "calendar" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <button onClick={goToPrevMonth} disabled={!canGoToPrevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#44318D] disabled:pointer-events-none disabled:opacity-20"
              style={{ color: "#A4B3B6" }}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-white">{MONTHS[viewMonth - 1]} {viewYear}</span>
            <button onClick={goToNextMonth} disabled={!canGoToNextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#44318D] disabled:pointer-events-none disabled:opacity-20"
              style={{ color: "#A4B3B6" }}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
            {DAY_LABELS.map((d, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: "#A4B3B6", padding: "0 0 6px" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {buildCalendarCells().map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} style={{ aspectRatio: "1/1" }} />;
              const dateStr = `${viewYear}-${String(viewMonth).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const past    = isPastDate(viewYear, viewMonth, day);
              const beyond  = isBeyondMaxAdvance(viewYear, viewMonth, day);
              const disabled = past || beyond;
              const isToday    = viewYear === today.year && viewMonth === today.month && day === today.day;
              const isSelected = dateStr === selectedDate;
              const bg = isSelected ? "#D83F87" : "transparent";
              const fg = disabled ? "#44318D" : isSelected ? "#fff" : isToday ? "#fff" : "#A4B3B6";
              const ring = isToday && !isSelected ? "inset 0 0 0 1px #D83F8744" : "none";
              return (
                <button key={dateStr} disabled={disabled} onClick={() => handleDateSelect(dateStr)}
                  style={{ aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, fontSize: 13, fontWeight: isToday || isSelected ? 600 : 400, background: bg, color: fg, cursor: disabled ? "default" : "pointer", boxShadow: ring, transition: "background 0.12s, color 0.12s", border: "none", outline: "none" }}
                  onMouseEnter={(e) => { if (!disabled && !isSelected) e.currentTarget.style.background = "#44318D"; }}
                  onMouseLeave={(e) => { if (!disabled && !isSelected) e.currentTarget.style.background = bg; }}>
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex items-center gap-1.5 text-xs" style={{ color: "#A4B3B6" }}>
            <Globe className="h-3 w-3" /><span>{timezone}</span>
          </div>
        </div>
      )}

      {/* Step 2 — Slots */}
      {step === "slots" && (
        <div>
          <button onClick={() => setStep("calendar")} className="mb-5 flex items-center gap-1.5 text-xs transition-colors hover:text-white" style={{ color: "#A4B3B6" }}>
            <ChevronLeft className="h-3.5 w-3.5" />
            {selectedDate ? formatDateLong(selectedDate) : "Back"}
          </button>
          {slotsLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" style={{ color: "#D83F87" }} /></div>
          ) : slotsError ? (
            <div className="rounded-xl p-5 text-center" style={{ border: "1px solid #3a1a1a", background: "#1a0a0a" }}>
              <p className="text-sm" style={{ color: "#f87171" }}>{slotsError}</p>
              <button onClick={() => selectedDate && fetchSlots(selectedDate)} className="mt-3 rounded-lg px-4 py-2 text-xs text-white" style={{ background: "#44318D" }}>Try again</button>
            </div>
          ) : slots.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="mx-auto mb-3 h-7 w-7" style={{ color: "#44318D" }} />
              <p className="text-sm font-medium text-white">No available times</p>
              <p className="mt-1 text-xs" style={{ color: "#A4B3B6" }}>Try a different date</p>
              <button onClick={() => setStep("calendar")} className="mt-5 rounded-xl px-5 py-2.5 text-sm" style={{ border: "1px solid #44318D", color: "#A4B3B6" }}>Pick another date</button>
            </div>
          ) : (
            <div className="space-y-2">
              {slots.map((slot) => (
                <button key={slot.start} onClick={() => handleSlotSelect(slot)} className="w-full rounded-xl px-5 py-3.5 text-left transition-all" style={{ border: "1px solid #44318D", background: "transparent" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#D83F8755"; e.currentTarget.style.background = "#D83F870d"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#44318D"; e.currentTarget.style.background = "transparent"; }}>
                  <span className="block text-sm font-semibold text-white">{formatTime(slot.start, timezone)}</span>
                </button>
              ))}
            </div>
          )}
          {!slotsLoading && !slotsError && slots.length > 0 && (
            <div className="mt-5 flex items-center gap-1.5 text-xs" style={{ color: "#A4B3B6" }}>
              <Globe className="h-3 w-3" /><span>{timezone}</span>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Form */}
      {step === "form" && (
        <div>
          <button onClick={() => setStep("slots")} className="mb-5 flex items-center gap-1.5 text-xs transition-colors hover:text-white" style={{ color: "#A4B3B6" }}>
            <ChevronLeft className="h-3.5 w-3.5" />
            {selectedSlot ? `${formatTime(selectedSlot.start, timezone)}${selectedDate ? " · " + formatDateLong(selectedDate) : ""}` : "Back"}
          </button>
          <form onSubmit={handleSubmit} className="space-y-4">
            {([
              { key: "name", label: "Full name", type: "text", placeholder: "Jane Smith", required: true },
              { key: "email", label: "Email", type: "email", placeholder: "jane@example.com", required: true },
            ] as const).map(({ key, label, type, placeholder, required }) => (
              <div key={key}>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "#A4B3B6" }}>
                  {label} {required && <span style={{ color: "#D83F87" }}>*</span>}
                </label>
                <input type={type} required={required} autoFocus={key === "name"} value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
                  style={{ border: "1px solid #44318D", background: "transparent" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#D83F87")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#44318D")} />
              </div>
            ))}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "#A4B3B6" }}>
                Notes <span className="normal-case font-normal" style={{ color: "#A4B3B6" }}>(optional)</span>
              </label>
              <textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Anything you'd like to share beforehand?" className="w-full resize-none rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
                style={{ border: "1px solid #44318D", background: "transparent" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#D83F87")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#44318D")} />
            </div>
            {submitError && (
              <p className="rounded-xl px-4 py-3 text-sm" style={{ border: "1px solid #3a1a1a", background: "#1a0a0a", color: "#f87171" }}>{submitError}</p>
            )}
            <button type="submit" disabled={submitting}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "#D83F87" }}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm booking
            </button>
          </form>
        </div>
      )}

      {/* Step 4 — Confirmation */}
      {step === "confirmation" && confirmation && (
        <div>
          <div className="mb-6 flex items-start gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: "#D83F8718", boxShadow: "inset 0 0 0 1px #D83F8733" }}>
              <Check className="h-4 w-4" style={{ color: "#D83F87" }} />
            </div>
            <div className="pt-0.5">
              <p className="text-base font-bold text-white">You&apos;re booked!</p>
              <p className="mt-0.5 text-xs" style={{ color: "#A4B3B6" }}>
                Confirmation sent to <span style={{ color: "#A4B3B6" }}>{form.email}</span>
              </p>
            </div>
          </div>
          <div className="rounded-xl p-5" style={{ border: "1px solid #44318D" }}>
            <p className="text-sm font-semibold text-white">{eventTitle}</p>
            <p className="mt-0.5 text-xs" style={{ color: "#A4B3B6" }}>
              with <span style={{ color: "#D83F87" }}>{teamName}</span>
            </p>
            <div className="mt-4 space-y-2.5" style={{ borderTop: "1px solid #44318D", paddingTop: 16 }}>
              <div className="flex items-center gap-3 text-sm" style={{ color: "#A4B3B6" }}>
                <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: "#D83F87" }} />
                {selectedDate ? formatDateLong(selectedDate) : ""}
              </div>
              <div className="flex items-center gap-3 text-sm" style={{ color: "#A4B3B6" }}>
                <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: "#D83F87" }} />
                {formatTime(confirmation.startTime, timezone)} – {formatTime(confirmation.endTime, timezone)}
              </div>
              <div className="flex items-center gap-3 text-sm" style={{ color: "#A4B3B6" }}>
                <Globe className="h-3.5 w-3.5 shrink-0" style={{ color: "#D83F87" }} />
                {timezone}
              </div>
            </div>
          </div>

          {/* Add to Calendar download */}
          <a
            href={`/api/bookings/${confirmation.bookingId}/ics`}
            download="meeting.ics"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors hover:opacity-80"
            style={{ background: "#2A1B3D", border: "1px solid #44318D", color: "#D83F87" }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Add to Calendar (.ics)
          </a>
        </div>
      )}
    </div>
  );
}
