"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Link2,
  ExternalLink,
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
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "react-toastify";

// ─── Types ────────────────────────────────────────────────────────────────────

type EventTypeKind = "ONE_ON_ONE" | "GROUP" | "ROUND_ROBIN" | "COLLECTIVE";
type LocationType = "GOOGLE_MEET" | "ZOOM" | "TEAMS" | "PHONE" | "IN_PERSON" | "OTHER";
type IntegrationProvider = "GOOGLE_CALENDAR" | "ZOOM" | "MICROSOFT_TEAMS";

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
  GOOGLE_MEET: "Google Meet (Coming soon)",
  ZOOM: "Zoom (Coming soon)",
  TEAMS: "Microsoft Teams (Coming soon)",
  PHONE: "Phone Call",
  IN_PERSON: "In Person",
  OTHER: "Other",
};

const DISABLED_LOCATIONS: LocationType[] = ["GOOGLE_MEET", "ZOOM", "TEAMS"];

const PRESET_COLORS = [
  "#D83F87",
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
  locationType: "PHONE",
  locationValue: "",
  bufferBefore: 0,
  bufferAfter: 0,
  minNotice: 0,
  maxBookings: "",
  maxAdvanceDays: "60",
  isActive: true,
  color: "#D83F87",
  slug: "",
  availabilityDays: [],
};

// ─── Toast ───────────────────────────────────────────────────────────────────

// ─── Toast Removed ────────────────────────────────────────────────────────────

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
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-bg-primary shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-text-muted transition-colors hover:text-white"
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
      <label className="block text-xs font-medium text-text-muted">{label}</label>
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
      className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-white placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent"
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
      className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent"
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
      className="w-full resize-none rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-white placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent"
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
  integrations,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSubmit: () => void;
  saving: boolean;
  isEdit: boolean;
  availability: DaySchedule[];
  integrations: { provider: IntegrationProvider; isActive: boolean }[];
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

  // Integration Status derived from selection
  const isMeetSelected = form.locationType === "GOOGLE_MEET";
  const isZoomSelected = form.locationType === "ZOOM";
  const isTeamsSelected = form.locationType === "TEAMS";

  const isMeetConnected = integrations.some(i => i.provider === "GOOGLE_CALENDAR" && i.isActive);
  const isZoomConnected = integrations.some(i => i.provider === "ZOOM" && i.isActive);
  const isTeamsConnected = integrations.some(i => i.provider === "MICROSOFT_TEAMS" && i.isActive);

  const isIntegrationMissing =
    (isMeetSelected && !isMeetConnected) ||
    (isZoomSelected && !isZoomConnected) ||
    (isTeamsSelected && !isTeamsConnected);

  return (
    <div className="space-y-4">
      {/* Title */}
      <Field label="Title *">
        <Input value={form.title} onChange={handleTitleChange} placeholder="30 Minute Meeting" />
      </Field>

      {/* Slug */}
      <Field label="Slug (URL)">
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-xs text-text-muted pointer-events-none">
            /
          </span>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
            placeholder="30-minute-meeting"
            className="w-full rounded-lg border border-border bg-bg-secondary py-2 pl-6 pr-3 text-sm text-white placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
      </Field>

      {/* Description */}
      <Field label="Description">
        <Textarea
          value={form.description}
          onChange={(v) => set("description", v)}
          placeholder="Brief description of this event…"
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
                      ? "bg-accent text-white"
                      : "bg-border text-text-muted hover:text-white"
                  }`}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>
        </Field>

        {/* Kind */}
        <Field label="Event Category">
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
            label,
            disabled: DISABLED_LOCATIONS.includes(value),
          }))}
        />
        {isIntegrationMissing && (
          <div className="mt-2 text-xs text-red-400">
            {isZoomSelected && "Connect Zoom first to use it for this event. "}
            {isMeetSelected && "Connect Google Calendar first to use Meet. "}
            {isTeamsSelected && "Connect Microsoft Teams first to use Teams. "}
            <Link href="/dashboard/integrations" className="underline hover:text-red-300">
              Go to Integrations
            </Link>
          </div>
        )}
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
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">Availability</p>
            <p className="text-xs text-text-muted">
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
              className="text-xs text-accent hover:underline"
            >
              Select all
            </button>
          )}
        </div>
        {availability.length > 0 ? (
          <div className="divide-y divide-border">
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
                      ? "bg-accent/10 hover:bg-accent/15"
                      : "hover:bg-[#44318D]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded text-xs font-medium transition-colors ${
                        isSelected && !isInactive
                          ? "bg-accent text-white"
                          : "bg-border text-text-muted"
                      }`}
                    >
                      {isSelected && !isInactive ? <Check className="h-3 w-3" /> : DAY_NAMES[day.dayOfWeek].charAt(0)}
                    </span>
                    <span className={`text-sm ${isSelected && !isInactive ? "text-white" : "text-text-muted"}`}>
                      {DAY_FULL[day.dayOfWeek]}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">
                    {isInactive ? "Off" : `${formatTime(day.startTime)} – ${formatTime(day.endTime)}`}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-xs text-text-muted">
            Set up your weekly hours in{" "}
            <Link href="/dashboard/availability" className="text-accent hover:underline">
              Availability settings
            </Link>{" "}
            first.
          </div>
        )}
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
        <div>
          <p className="text-sm text-white">Active</p>
          <p className="text-xs text-text-muted">Allow new bookings for this event</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.isActive}
          onClick={() => set("isActive", !form.isActive)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            form.isActive ? "bg-accent" : "bg-border"
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
          disabled={saving || !form.title.trim() || isIntegrationMissing}
          className="bg-accent text-white hover:bg-[#b8306f]"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : isEdit ? (
            "Save changes"
          ) : (
            "Create event"
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
  const [integrations, setIntegrations] = useState<{ provider: IntegrationProvider; isActive: boolean }[]>([]);

  // Deleting state (id → true)
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  // Copy link state
  const [copied, setCopied] = useState<string | null>(null);

  // Toast state removed in favor of react-toastify

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
          setIntegrations(data.integrations ?? []);
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
      color: et.color ?? "#D83F87",
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
            : "Failed to save event";
        toast.error(errMsg as string);
        return;
      }

      if (json.eventType) {
        if (editTarget) {
          setEventTypes((prev) => prev.map((e) => (e.id === editTarget.id ? json.eventType! : e)));
        } else {
          setEventTypes((prev) => [...prev, json.eventType!]);
        }
      }

      toast.success(editTarget ? "Event updated" : "Event created");
      closeModal();
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    setDeleting((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/events/delete?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setEventTypes((prev) => prev.filter((e) => e.id !== id));
      toast.success("Event deleted");
    } catch {
      toast.error("Failed to delete event");
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
      toast.error("Failed to update status");
    }
  }

  // ── Copy link ───────────────────────────────────────────────────────────────────

  function handleCopy(slug: string) {
    if (!username) {
      toast.error("Please set a username in Settings first.");
      return;
    }
    const url = `${window.location.origin}/${username}/${slug}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  }

  // ── Render ──────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Events</h1>
          <p className="text-sm text-text-muted">Create booking links and manage your event templates.</p>
        </div>
        <Button onClick={openCreate} className="bg-accent text-white hover:bg-[#b8306f]">
          <Plus className="mr-2 h-4 w-4" />
          New event
        </Button>
      </div>

      {/* Empty state */}
      {eventTypes.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Link2 className="mb-4 h-12 w-12 text-border" />
            <p className="text-sm font-medium text-white">No events yet</p>
            <p className="mt-1 text-xs text-text-muted">Create your first booking link to share with others.</p>
            <Button
              onClick={openCreate}
              className="mt-6 bg-accent text-white hover:bg-[#b8306f]"
            >
              <Plus className="mr-2 h-4 w-4" />
              New event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {eventTypes.map((et) => (
            <div
              key={et.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-bg-secondary px-5 py-4 transition-colors hover:border-[#3e3e3e]"
            >
              {/* Color indicator */}
              <div
                className="h-10 w-1 flex-shrink-0 rounded-full"
                style={{ backgroundColor: et.color ?? "#D83F87" }}
              />

              {/* Details */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{et.title}</span>
                  {!et.isActive && (
                    <span className="rounded-full bg-border px-2 py-0.5 text-xs text-text-muted">
                      Inactive
                    </span>
                  )}
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
                    {KIND_LABELS[et.kind]}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-muted">
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
                    <span className="text-accent">
                      /{username}/{et.slug}
                    </span>
                  )}
                </div>
                {et.description && (
                  <p className="mt-1 truncate text-xs text-text-muted">{et.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-2">
                {/* Active toggle */}
                <Tooltip content={et.isActive ? "Deactivate" : "Activate"}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={et.isActive}
                    onClick={() => handleToggleActive(et)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      et.isActive ? "bg-accent" : "bg-border"
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                        et.isActive ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </Tooltip>

                {/* View booking page link */}
                <Tooltip content="Open booking page in new tab">
                  <Link
                    href={username ? `/${username}/${et.slug}` : "#"}
                    target={username ? "_blank" : undefined}
                    onClick={(e) => {
                      if (!username) {
                        e.preventDefault();
                        toast.error("Please set a username in Settings first.");
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10 hover:border-accent"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Booking Page
                  </Link>
                </Tooltip>

                {/* Copy link */}
                <Tooltip content={copied === et.slug ? "Copied!" : "Copy booking link"}>
                  <button
                    type="button"
                    onClick={() => handleCopy(et.slug)}
                    className="rounded-lg p-2 text-text-muted transition-colors hover:bg-border hover:text-white"
                  >
                    {copied === et.slug ? (
                      <Check className="h-4 w-4 text-accent" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </Tooltip>

                {/* Edit */}
                <Tooltip content="Edit event">
                  <button
                    type="button"
                    onClick={() => openEdit(et)}
                    className="rounded-lg p-2 text-text-muted transition-colors hover:bg-border hover:text-white"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </Tooltip>

                {/* Delete */}
                <Tooltip content="Delete event">
                  <button
                    type="button"
                    onClick={() => handleDelete(et.id)}
                    disabled={deleting[et.id]}
                    className="rounded-lg p-2 text-text-muted transition-colors hover:bg-red-950 hover:text-red-400 disabled:opacity-50"
                  >
                    {deleting[et.id] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editTarget ? "Edit event" : "New event"}
      >
        <EventForm
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          saving={saving}
          isEdit={!!editTarget}
          availability={availability}
          integrations={integrations}
        />
      </Modal>
    </>
  );
}
