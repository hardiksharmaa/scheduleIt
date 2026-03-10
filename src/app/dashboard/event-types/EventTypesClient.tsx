"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Link2,
  Pencil,
  Trash2,
  Copy,
  Check,
  Loader2,
  Clock,
  Video,
  MapPin,
  Globe,
  Phone,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type EventTypeKind = "ONE_ON_ONE" | "GROUP" | "ROUND_ROBIN" | "COLLECTIVE";
type LocationType = "GOOGLE_MEET" | "ZOOM" | "TEAMS" | "PHONE" | "IN_PERSON" | "OTHER";

interface DaySchedule {
  dayOfWeek: number; // 0 = Sun … 6 = Sat
  isActive: boolean;
  startTime: string;
  endTime: string;
}

interface EventType {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration: number;
  kind: EventTypeKind;
  locationType: LocationType;
  locationValue: string | null;
  bufferBefore: number;
  bufferAfter: number;
  minNotice: number;
  maxBookings: number | null;
  maxAdvanceDays: number | null;
  isActive: boolean;
  color: string | null;
  availabilityDays: number[];
  createdAt: string;
}

interface FormState {
  title: string;
  description: string;
  duration: number;
  kind: EventTypeKind;
  locationType: LocationType;
  locationValue: string;
  bufferBefore: number;
  bufferAfter: number;
  minNotice: number;
  maxBookings: string; // keep as string for input
  maxAdvanceDays: string; // keep as string for input
  isActive: boolean;
  color: string;
  slug: string;
  availabilityDays: number[]; // empty = use all active days
}

// ─── Constants ───────────────────────────────────────────────────────────────

const KIND_LABELS: Record<EventTypeKind, string> = {
  ONE_ON_ONE: "One-on-One",
  GROUP: "Group",
  ROUND_ROBIN: "Round Robin",
  COLLECTIVE: "Collective",
};

const LOCATION_LABELS: Record<LocationType, string> = {
  GOOGLE_MEET: "Google Meet",
  ZOOM: "Zoom",
  TEAMS: "Microsoft Teams",
  PHONE: "Phone Call",
  IN_PERSON: "In Person",
  OTHER: "Other",
};

const PRESET_COLORS = [
  "#c4956a",
  "#6a9ec4",
  "#6ac47a",
  "#c46a6a",
  "#9a6ac4",
  "#c4b96a",
];

const DURATION_PRESETS = [15, 20, 30, 45, 60, 90, 120];

function locationIcon(type: LocationType) {
  switch (type) {
    case "GOOGLE_MEET":
    case "ZOOM":
    case "TEAMS":
      return <Video className="h-3.5 w-3.5" />;
    case "IN_PERSON":
      return <MapPin className="h-3.5 w-3.5" />;
    case "PHONE":
      return <Phone className="h-3.5 w-3.5" />;
    default:
      return <Globe className="h-3.5 w-3.5" />;
  }
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

const BLANK_FORM: FormState = {
  title: "",
  description: "",
  duration: 30,
  kind: "ONE_ON_ONE",
  locationType: "ZOOM",
  locationValue: "",
  bufferBefore: 0,
  bufferAfter: 0,
  minNotice: 0,
  maxBookings: "",
  maxAdvanceDays: "60",
  isActive: true,
  color: "#c4956a",
  slug: "",
  availabilityDays: [],
};

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({
  msg,
  isError,
  onClose,
}: {
  msg: string;
  isError?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-xl ${
        isError ? "bg-red-900 text-red-100" : "bg-[#c4956a] text-white"
      }`}
    >
      {isError ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
      {msg}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#2e2e2e] bg-[#0c0c0c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2e2e2e] px-6 py-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-[#9a9a9a] transition-colors hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-[#9a9a9a]">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      min={min}
      max={max}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-sm text-white placeholder-[#9a9a9a] outline-none focus:border-[#c4956a] focus:ring-1 focus:ring-[#c4956a]"
    />
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-sm text-white outline-none focus:border-[#c4956a] focus:ring-1 focus:ring-[#c4956a]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-none rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-sm text-white placeholder-[#9a9a9a] outline-none focus:border-[#c4956a] focus:ring-1 focus:ring-[#c4956a]"
    />
  );
}

// ─── Create/Edit Form ─────────────────────────────────────────────────────────

function EventForm({
  form,
  setForm,
  onSubmit,
  saving,
  isEdit,
  availability,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSubmit: () => void;
  saving: boolean;
  isEdit: boolean;
  availability: DaySchedule[];
}) {
  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  // Auto-generate slug from title when not in edit mode
  const handleTitleChange = (v: string) => {
    set("title", v);
    if (!isEdit) set("slug", slugify(v));
  };

  const needsLocationValue = form.locationType === "IN_PERSON" || form.locationType === "PHONE" || form.locationType === "OTHER";

  // Days from saved availability (active and inactive)
  const activeDays = availability.filter((d) => d.isActive);
  // Which days are "selected" for this event — empty means all active
  const selectedDays = form.availabilityDays;
  const allActive = selectedDays.length === 0;

  function toggleDay(day: number) {
    const avDay = availability.find((d) => d.dayOfWeek === day);
    if (!avDay) return;
    if (allActive) {
      // First click on a day: switch from "all" to explicit set excluding this day
      const newSet = activeDays.filter((d) => d.dayOfWeek !== day).map((d) => d.dayOfWeek);
      setForm((prev) => ({ ...prev, availabilityDays: newSet }));
    } else {
      const isSelected = selectedDays.includes(day);
      const newSet = isSelected
        ? selectedDays.filter((d) => d !== day)
        : [...selectedDays, day].sort((a, b) => a - b);
      // If resulting set equals all active days, reset to [] ("all")
      const activeNums = activeDays.map((d) => d.dayOfWeek).sort((a, b) => a - b);
      const isDiff = JSON.stringify(newSet.sort((a, b) => a - b)) !== JSON.stringify(activeNums);
      setForm((prev) => ({ ...prev, availabilityDays: isDiff ? newSet : [] }));
    }
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <Field label="Title *">
        <Input value={form.title} onChange={handleTitleChange} placeholder="30 Minute Meeting" />
      </Field>

      {/* Slug */}
      <Field label="Slug (URL)">
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-xs text-[#9a9a9a] pointer-events-none">
            /
          </span>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
            placeholder="30-minute-meeting"
            className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] py-2 pl-6 pr-3 text-sm text-white placeholder-[#9a9a9a] outline-none focus:border-[#c4956a] focus:ring-1 focus:ring-[#c4956a]"
          />
        </div>
      </Field>

      {/* Description */}
      <Field label="Description">
        <Textarea
          value={form.description}
          onChange={(v) => set("description", v)}
          placeholder="Brief description of this event type…"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        {/* Duration */}
        <Field label="Duration (minutes) *">
          <div className="space-y-1">
            <Input
              type="number"
              value={form.duration}
              onChange={(v) => set("duration", Number(v))}
              min={5}
              max={480}
            />
            <div className="flex flex-wrap gap-1">
              {DURATION_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set("duration", d)}
                  className={`rounded px-2 py-0.5 text-xs transition-colors ${
                    form.duration === d
                      ? "bg-[#c4956a] text-white"
                      : "bg-[#2e2e2e] text-[#9a9a9a] hover:text-white"
                  }`}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>
        </Field>

        {/* Kind */}
        <Field label="Event Type">
          <Select<EventTypeKind>
            value={form.kind}
            onChange={(v) => set("kind", v)}
            options={(Object.entries(KIND_LABELS) as [EventTypeKind, string][]).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </Field>
      </div>

      {/* Location */}
      <Field label="Location">
        <Select<LocationType>
          value={form.locationType}
          onChange={(v) => set("locationType", v)}
          options={(Object.entries(LOCATION_LABELS) as [LocationType, string][]).map(([value, label]) => ({
            value,
            label: value === "GOOGLE_MEET" || value === "TEAMS" ? `${label} (Coming soon)` : label,
            disabled: value === "GOOGLE_MEET" || value === "TEAMS",
          }))}
        />
      </Field>

      {needsLocationValue && (
        <Field label={form.locationType === "PHONE" ? "Phone / Dial-in Instructions" : form.locationType === "IN_PERSON" ? "Address" : "Location Details"}>
          <Input
            value={form.locationValue}
            onChange={(v) => set("locationValue", v)}
            placeholder={form.locationType === "IN_PERSON" ? "123 Main St, City" : form.locationType === "PHONE" ? "+1 (555) 000-0000" : "Details…"}
          />
        </Field>
      )}

      {/* Booking window */}
      <Field label="Booking window (days)">
        <Input
          type="number"
          value={form.maxAdvanceDays}
          onChange={(v) => set("maxAdvanceDays", v)}
          placeholder="Unlimited"
          min={1}
          max={730}
        />
      </Field>



      {/* Availability days */}
      <div className="rounded-lg border border-[#2e2e2e] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#2e2e2e] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">Availability</p>
            <p className="text-xs text-[#9a9a9a]">
              {availability.length === 0
                ? "No availability saved yet — go to Availability settings first"
                : allActive
                ? "Using all active days from your schedule"
                : selectedDays.length === 0
                ? "No days selected — event won't be bookable"
                : `${selectedDays.length} day${selectedDays.length !== 1 ? "s" : ""} selected`}
            </p>
          </div>
          {activeDays.length > 0 && (
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, availabilityDays: [] }))}
              className="text-xs text-[#c4956a] hover:underline"
            >
              Select all
            </button>
          )}
        </div>
        {availability.length > 0 ? (
          <div className="divide-y divide-[#2e2e2e]">
            {availability.map((day) => {
              const isSelected = allActive ? day.isActive : selectedDays.includes(day.dayOfWeek);
              const isInactive = !day.isActive;
              return (
                <button
                  key={day.dayOfWeek}
                  type="button"
                  disabled={isInactive}
                  onClick={() => !isInactive && toggleDay(day.dayOfWeek)}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors ${
                    isInactive
                      ? "cursor-not-allowed opacity-40"
                      : isSelected
                      ? "bg-[#c4956a]/10 hover:bg-[#c4956a]/15"
                      : "hover:bg-[#1e1e1e]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded text-xs font-medium transition-colors ${
                        isSelected && !isInactive
                          ? "bg-[#c4956a] text-white"
                          : "bg-[#2e2e2e] text-[#9a9a9a]"
                      }`}
                    >
                      {isSelected && !isInactive ? <Check className="h-3 w-3" /> : DAY_NAMES[day.dayOfWeek].charAt(0)}
                    </span>
                    <span className={`text-sm ${isSelected && !isInactive ? "text-white" : "text-[#9a9a9a]"}`}>
                      {DAY_FULL[day.dayOfWeek]}
                    </span>
                  </div>
                  <span className="text-xs text-[#9a9a9a]">
                    {isInactive ? "Off" : `${formatTime(day.startTime)} – ${formatTime(day.endTime)}`}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-xs text-[#9a9a9a]">
            Set up your weekly hours in{" "}
            <a href="/dashboard/availability" className="text-[#c4956a] hover:underline">
              Availability settings
            </a>{" "}
            first.
          </div>
        )}
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between rounded-lg border border-[#2e2e2e] px-4 py-3">
        <div>
          <p className="text-sm text-white">Active</p>
          <p className="text-xs text-[#9a9a9a]">Allow new bookings for this event type</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.isActive}
          onClick={() => set("isActive", !form.isActive)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            form.isActive ? "bg-[#c4956a]" : "bg-[#2e2e2e]"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              form.isActive ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          onClick={onSubmit}
          disabled={saving || !form.title.trim()}
          className="bg-[#c4956a] text-white hover:bg-[#b07d52]"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : isEdit ? (
            "Save changes"
          ) : (
            "Create event type"
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EventTypesClient() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [availability, setAvailability] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EventType | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  // Deleting state (id → true)
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  // Copy link state
  const [copied, setCopied] = useState<string | null>(null);

  // Toast state
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);

  const showToast = (msg: string, isError = false) => setToast({ msg, isError });
  const closeToast = useCallback(() => setToast(null), []);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [evRes, profileRes, availRes] = await Promise.all([
          fetch("/api/events"),
          fetch("/api/user/profile"),
          fetch("/api/availability"),
        ]);

        if (evRes.ok) {
          const data = await evRes.json();
          setEventTypes(data.eventTypes ?? []);
        }
        if (profileRes.ok) {
          const data = await profileRes.json();
          setUsername(data.username ?? null);
        }
        if (availRes.ok) {
          const data = await availRes.json();
          // API returns the array directly
          setAvailability(Array.isArray(data) ? data : []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Open modal ────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditTarget(null);
    setForm(BLANK_FORM);
    setModalOpen(true);
  }

  function openEdit(et: EventType) {
    setEditTarget(et);
    setForm({
      title: et.title,
      description: et.description ?? "",
      duration: et.duration,
      kind: et.kind,
      locationType: et.locationType,
      locationValue: et.locationValue ?? "",
      bufferBefore: et.bufferBefore,
      bufferAfter: et.bufferAfter,
      minNotice: et.minNotice,
      maxBookings: et.maxBookings != null ? String(et.maxBookings) : "",
      maxAdvanceDays: et.maxAdvanceDays != null ? String(et.maxAdvanceDays) : "",
      isActive: et.isActive,
      color: et.color ?? "#c4956a",
      slug: et.slug,
      availabilityDays: et.availabilityDays ?? [],
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditTarget(null);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!form.title.trim()) return;

    setSaving(true);
    try {
      const payload = {
        ...(editTarget ? { id: editTarget.id } : {}),
        title: form.title.trim(),
        description: form.description.trim() || null,
        duration: form.duration,
        kind: form.kind,
        locationType: form.locationType,
        locationValue: form.locationValue.trim() || null,
        bufferBefore: form.bufferBefore,
        bufferAfter: form.bufferAfter,
        minNotice: form.minNotice,
        maxBookings: form.maxBookings ? parseInt(form.maxBookings) : null,
        maxAdvanceDays: form.maxAdvanceDays ? parseInt(form.maxAdvanceDays) : null,
        isActive: form.isActive,
        color: form.color,
        slug: form.slug.trim() || undefined,
        availabilityDays: form.availabilityDays,
      };

      const res = await fetch(editTarget ? "/api/events/update" : "/api/events/create", {
        method: editTarget ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let json: { eventType?: EventType; error?: unknown };
      try {
        json = await res.json();
      } catch {
        json = {};
      }

      if (!res.ok) {
        const errMsg =
          typeof json.error === "string"
            ? json.error
            : typeof json.error === "object" && json.error
            ? Object.values(json.error as Record<string, string[]>).flat().join("; ")
            : "Failed to save event type";
        showToast(errMsg, true);
        return;
      }

      if (json.eventType) {
        if (editTarget) {
          setEventTypes((prev) => prev.map((e) => (e.id === editTarget.id ? json.eventType! : e)));
        } else {
          setEventTypes((prev) => [...prev, json.eventType!]);
        }
      }

      showToast(editTarget ? "Event type updated" : "Event type created");
      closeModal();
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm("Delete this event type? This cannot be undone.")) return;
    setDeleting((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/events/delete?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setEventTypes((prev) => prev.filter((e) => e.id !== id));
      showToast("Event type deleted");
    } catch {
      showToast("Failed to delete event type", true);
    } finally {
      setDeleting((prev) => ({ ...prev, [id]: false }));
    }
  }

  // ── Toggle active ──────────────────────────────────────────────────────────────

  async function handleToggleActive(et: EventType) {
    try {
      const res = await fetch("/api/events/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: et.id, isActive: !et.isActive }),
      });
      if (!res.ok) throw new Error();
      setEventTypes((prev) =>
        prev.map((e) => (e.id === et.id ? { ...e, isActive: !e.isActive } : e))
      );
    } catch {
      showToast("Failed to update status", true);
    }
  }

  // ── Copy link ───────────────────────────────────────────────────────────────────

  function handleCopy(slug: string) {
    if (!username) return;
    const url = `${window.location.origin}/${username}/${slug}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  }

  // ── Render ──────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-[#c4956a]" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Event Types</h1>
          <p className="text-sm text-[#9a9a9a]">Create booking links and manage your event templates.</p>
        </div>
        <Button onClick={openCreate} className="bg-[#c4956a] text-white hover:bg-[#b07d52]">
          <Plus className="mr-2 h-4 w-4" />
          New event type
        </Button>
      </div>

      {/* Empty state */}
      {eventTypes.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Link2 className="mb-4 h-12 w-12 text-[#2e2e2e]" />
            <p className="text-sm font-medium text-white">No event types yet</p>
            <p className="mt-1 text-xs text-[#9a9a9a]">Create your first booking link to share with others.</p>
            <Button
              onClick={openCreate}
              className="mt-6 bg-[#c4956a] text-white hover:bg-[#b07d52]"
            >
              <Plus className="mr-2 h-4 w-4" />
              New event type
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {eventTypes.map((et) => (
            <div
              key={et.id}
              className="flex items-center gap-4 rounded-xl border border-[#2e2e2e] bg-[#181818] px-5 py-4 transition-colors hover:border-[#3e3e3e]"
            >
              {/* Color indicator */}
              <div
                className="h-10 w-1 flex-shrink-0 rounded-full"
                style={{ backgroundColor: et.color ?? "#c4956a" }}
              />

              {/* Details */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{et.title}</span>
                  {!et.isActive && (
                    <span className="rounded-full bg-[#2e2e2e] px-2 py-0.5 text-xs text-[#9a9a9a]">
                      Inactive
                    </span>
                  )}
                  <span className="rounded-full border border-[#2e2e2e] px-2 py-0.5 text-xs text-[#9a9a9a]">
                    {KIND_LABELS[et.kind]}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#9a9a9a]">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {durationLabel(et.duration)}
                  </span>
                  <span className="flex items-center gap-1">
                    {locationIcon(et.locationType)}
                    {LOCATION_LABELS[et.locationType]}
                  </span>
                  {et.maxBookings && (
                    <span>Max {et.maxBookings} bookings</span>
                  )}
                  {username && (
                    <span className="text-[#c4956a]">
                      /{username}/{et.slug}
                    </span>
                  )}
                </div>
                {et.description && (
                  <p className="mt-1 truncate text-xs text-[#9a9a9a]">{et.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-shrink-0 items-center gap-2">
                {/* Active toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={et.isActive}
                  title={et.isActive ? "Deactivate" : "Activate"}
                  onClick={() => handleToggleActive(et)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    et.isActive ? "bg-[#c4956a]" : "bg-[#2e2e2e]"
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                      et.isActive ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>

                {/* Copy link */}
                {username && (
                  <button
                    type="button"
                    title="Copy booking link"
                    onClick={() => handleCopy(et.slug)}
                    className="rounded-lg p-2 text-[#9a9a9a] transition-colors hover:bg-[#2e2e2e] hover:text-white"
                  >
                    {copied === et.slug ? (
                      <Check className="h-4 w-4 text-[#c4956a]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                )}

                {/* Edit */}
                <button
                  type="button"
                  title="Edit"
                  onClick={() => openEdit(et)}
                  className="rounded-lg p-2 text-[#9a9a9a] transition-colors hover:bg-[#2e2e2e] hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                </button>

                {/* Delete */}
                <button
                  type="button"
                  title="Delete"
                  onClick={() => handleDelete(et.id)}
                  disabled={deleting[et.id]}
                  className="rounded-lg p-2 text-[#9a9a9a] transition-colors hover:bg-red-950 hover:text-red-400 disabled:opacity-50"
                >
                  {deleting[et.id] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editTarget ? "Edit event type" : "New event type"}
      >
        <EventForm
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          saving={saving}
          isEdit={!!editTarget}
          availability={availability}
        />
      </Modal>

      {/* Toast */}
      {toast && (
        <Toast msg={toast.msg} isError={toast.isError} onClose={closeToast} />
      )}
    </>
  );
}
