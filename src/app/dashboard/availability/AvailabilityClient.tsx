"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Check, X, Plus, Trash2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DaySchedule {
  id: string | null;
  dayOfWeek: number; // 0 = Sunday
  isActive: boolean;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
}

interface Override {
  id: string;
  date: string;      // "YYYY-MM-DD"
  isBlocked: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// 30-minute time slots from 00:00 to 23:30
const TIME_SLOTS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_SLOTS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDate(dateStr: string): string {
  // Parse as local date to avoid UTC-offset shifting
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Time select ──────────────────────────────────────────────────────────────

function TimeSelect({
  value,
  onChange,
  disabled,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  min?: string; // exclude slots <= min
}) {
  const slots = min ? TIME_SLOTS.filter((t) => t > min) : TIME_SLOTS;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="rounded-lg border border-[#2e2e2e] bg-[#0c0c0c] px-3 py-2 text-sm text-white outline-none focus:border-[#c4956a] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
    >
      {slots.map((t) => (
        <option key={t} value={t}>
          {formatTime(t)}
        </option>
      ))}
    </select>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
        checked ? "bg-[#c4956a]" : "bg-[#2e2e2e]"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ─── Day row ─────────────────────────────────────────────────────────────────

function DayRow({
  day,
  onChange,
}: {
  day: DaySchedule;
  onChange: (updated: DaySchedule) => void;
}) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-[#2e2e2e] last:border-0">
      {/* Toggle */}
      <Toggle
        checked={day.isActive}
        onChange={(v) => onChange({ ...day, isActive: v })}
      />

      {/* Day name */}
      <span
        className={`w-24 shrink-0 text-sm font-medium ${
          day.isActive ? "text-white" : "text-[#9a9a9a]"
        }`}
      >
        <span className="hidden sm:inline">{DAY_NAMES[day.dayOfWeek]}</span>
        <span className="sm:hidden">{DAY_SHORT[day.dayOfWeek]}</span>
      </span>

      {day.isActive ? (
        <div className="flex flex-wrap items-center gap-2">
          <TimeSelect
            value={day.startTime}
            onChange={(v) => onChange({ ...day, startTime: v })}
          />
          <span className="text-[#9a9a9a] text-sm">–</span>
          <TimeSelect
            value={day.endTime}
            onChange={(v) => onChange({ ...day, endTime: v })}
            min={day.startTime}
          />
          {day.startTime >= day.endTime && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="h-3 w-3" /> End must be after start
            </span>
          )}
        </div>
      ) : (
        <span className="text-sm text-[#9a9a9a]">Unavailable</span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AvailabilityClient() {
  // ── Weekly schedule state ─────────────────────────────────────────────────
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // ── Overrides state ───────────────────────────────────────────────────────
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(true);

  // New override form
  const [newDate, setNewDate] = useState("");
  const [newIsBlocked, setNewIsBlocked] = useState(true);
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("17:00");
  const [newReason, setNewReason] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadSchedule = useCallback(async () => {
    try {
      const res = await fetch("/api/availability");
      if (!res.ok) throw new Error("Failed to load schedule");
      const data = await res.json();
      setSchedule(data);
    } catch {
      setScheduleError("Could not load schedule. Please refresh.");
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  const loadOverrides = useCallback(async () => {
    try {
      const res = await fetch("/api/availability/overrides");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOverrides(data);
    } catch {
      // silent — overrides section will just show empty
    } finally {
      setOverridesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
    loadOverrides();
  }, [loadSchedule, loadOverrides]);

  // ── Save weekly schedule ──────────────────────────────────────────────────
  async function handleSaveSchedule() {
    // Validate: no active day with end <= start
    const hasInvalid = schedule.some((d) => d.isActive && d.startTime >= d.endTime);
    if (hasInvalid) {
      setScheduleError("Fix time errors before saving.");
      return;
    }

    setScheduleSaving(true);
    setScheduleError(null);
    setScheduleSuccess(false);

    try {
      const res = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });

      let data: { error?: unknown } = {};
      try { data = await res.json(); } catch { /* empty */ }

      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : "Failed to save. Please try again.";
        setScheduleError(msg);
      } else {
        setScheduleSuccess(true);
        setTimeout(() => setScheduleSuccess(false), 3000);
      }
    } catch {
      setScheduleError("Network error. Please check your connection.");
    } finally {
      setScheduleSaving(false);
    }
  }

  // ── Add override ──────────────────────────────────────────────────────────
  async function handleAddOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate) {
      setOverrideError("Please select a date.");
      return;
    }
    if (!newIsBlocked && newStartTime >= newEndTime) {
      setOverrideError("End time must be after start time.");
      return;
    }

    setOverrideSaving(true);
    setOverrideError(null);

    try {
      const res = await fetch("/api/availability/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newDate,
          isBlocked: newIsBlocked,
          startTime: newIsBlocked ? null : newStartTime,
          endTime: newIsBlocked ? null : newEndTime,
          reason: newReason || null,
        }),
      });

      let data: unknown;
      try { data = await res.json(); } catch { /* empty */ }

      if (!res.ok) {
        const d = data as { error?: string };
        setOverrideError(d?.error ?? "Failed to save override.");
      } else {
        const incoming = data as Override;
        setOverrides((prev) => {
          const filtered = prev.filter((o) => o.date !== incoming.date);
          return [...filtered, incoming].sort((a, b) => a.date.localeCompare(b.date));
        });
        // Reset form
        setNewDate("");
        setNewReason("");
        setNewIsBlocked(true);
        setNewStartTime("09:00");
        setNewEndTime("17:00");
      }
    } catch {
      setOverrideError("Network error.");
    } finally {
      setOverrideSaving(false);
    }
  }

  // ── Delete override ───────────────────────────────────────────────────────
  async function handleDeleteOverride(date: string) {
    setDeletingDate(date);
    try {
      const res = await fetch(`/api/availability/overrides?date=${date}`, { method: "DELETE" });
      if (res.ok) {
        setOverrides((prev) => prev.filter((o) => o.date !== date));
      }
    } finally {
      setDeletingDate(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Availability</h1>
        <p className="text-sm text-[#9a9a9a]">
          Set your weekly working hours and mark specific date exceptions.
        </p>
      </div>

      {/* ── Weekly schedule ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly hours</CardTitle>
          <CardDescription>
            Toggle days on/off and set your available time window for each day.
            Times are stored in your profile timezone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scheduleLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-[#c4956a]" />
            </div>
          ) : (
            <div>
              {schedule.map((day) => (
                <DayRow
                  key={day.dayOfWeek}
                  day={day}
                  onChange={(updated) =>
                    setSchedule((prev) =>
                      prev.map((d) => (d.dayOfWeek === updated.dayOfWeek ? updated : d))
                    )
                  }
                />
              ))}

              {/* Error / success */}
              {scheduleError && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {scheduleError}
                </div>
              )}
              {scheduleSuccess && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                  <Check className="h-4 w-4 shrink-0" />
                  Schedule saved successfully!
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleSaveSchedule}
                  disabled={scheduleSaving}
                  className="min-w-[120px] gap-2"
                >
                  {scheduleSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save schedule
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Date overrides ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Date overrides</CardTitle>
          <CardDescription>
            Block out specific dates (holidays, vacations) or set custom hours for a single day.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add override form */}
          <form onSubmit={handleAddOverride} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Date picker */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#9a9a9a]">Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-lg border border-[#2e2e2e] bg-[#0c0c0c] px-3 py-2 text-sm text-white outline-none focus:border-[#c4956a] transition-colors [color-scheme:dark]"
                />
              </div>

              {/* Type: blocked vs custom */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#9a9a9a]">Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewIsBlocked(true)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      newIsBlocked
                        ? "border-[#c4956a] bg-[#c4956a]/10 text-[#c4956a]"
                        : "border-[#2e2e2e] text-[#9a9a9a] hover:border-[#c4956a]/50"
                    }`}
                  >
                    Blocked
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewIsBlocked(false)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      !newIsBlocked
                        ? "border-[#c4956a] bg-[#c4956a]/10 text-[#c4956a]"
                        : "border-[#2e2e2e] text-[#9a9a9a] hover:border-[#c4956a]/50"
                    }`}
                  >
                    Custom hours
                  </button>
                </div>
              </div>
            </div>

            {/* Custom hours */}
            {!newIsBlocked && (
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#9a9a9a]">Start</label>
                  <TimeSelect value={newStartTime} onChange={setNewStartTime} />
                </div>
                <div className="mt-6 text-[#9a9a9a]">–</div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#9a9a9a]">End</label>
                  <TimeSelect value={newEndTime} onChange={setNewEndTime} min={newStartTime} />
                </div>
              </div>
            )}

            {/* Optional reason */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#9a9a9a]">
                Reason <span className="text-[#9a9a9a] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="e.g. Public holiday, vacation…"
                maxLength={200}
                className="w-full rounded-lg border border-[#2e2e2e] bg-[#0c0c0c] px-3 py-2 text-sm text-white placeholder:text-[#9a9a9a] outline-none focus:border-[#c4956a] transition-colors"
              />
            </div>

            {overrideError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {overrideError}
              </div>
            )}

            <Button type="submit" disabled={overrideSaving || !newDate} className="gap-2">
              {overrideSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add override
            </Button>
          </form>

          {/* Existing overrides list */}
          {overridesLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-[#9a9a9a]" />
            </div>
          ) : overrides.length === 0 ? (
            <p className="text-center text-sm text-[#9a9a9a] py-4">
              No date overrides yet.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#9a9a9a]">Upcoming overrides</p>
              {overrides.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-[#2e2e2e] bg-[#181818] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-white">{formatDate(o.date)}</span>
                      {o.isBlocked ? (
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400">
                          Blocked
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#c4956a]/15 px-2 py-0.5 text-xs text-[#c4956a]">
                          {formatTime(o.startTime!)} – {formatTime(o.endTime!)}
                        </span>
                      )}
                    </div>
                    {o.reason && (
                      <p className="mt-0.5 truncate text-xs text-[#9a9a9a]">{o.reason}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteOverride(o.date)}
                    disabled={deletingDate === o.date}
                    className="shrink-0 rounded p-1 text-[#9a9a9a] hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Remove override"
                  >
                    {deletingDate === o.date ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
