"use client";

import { useState } from "react";
import {
  Users, Plus, Trash2, UserPlus, UserMinus, ExternalLink,
  ChevronLeft, Loader2, Copy, Check, Calendar,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamUser {
  id: string; name: string | null; email: string | null; image: string | null; username: string | null;
}
interface TeamMember {
  userId: string; role: "OWNER" | "MEMBER"; joinedAt: string; user: TeamUser;
}
interface TeamEventType {
  id: string; title: string; slug: string; duration: number;
  kind: string; locationType: string; color: string | null; isActive: boolean;
  team: { slug: string };
}
interface Team {
  id: string; name: string; slug: string; description: string | null; ownerId: string;
  createdAt: string;
  members: TeamMember[];
  eventTypes: TeamEventType[];
  myRole: "OWNER" | "MEMBER";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function kindBadge(kind: string) {
  const map: Record<string, { label: string; color: string }> = {
    ROUND_ROBIN: { label: "Round robin", color: "#2d6a9f" },
    COLLECTIVE:  { label: "Collective",  color: "#5c6e2d" },
    ONE_ON_ONE:  { label: "1-on-1",      color: "#555"    },
    GROUP:       { label: "Group",       color: "#7a4d2a" },
  };
  const meta = map[kind] ?? { label: kind, color: "#555" };
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: meta.color + "33", color: meta.color, border: `1px solid ${meta.color}55`, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {meta.label}
    </span>
  );
}

function durationLabel(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function MemberAvatar({ user, size = 30 }: { user: TeamUser; size?: number }) {
  const initials = (user.name ?? user.email ?? "?").trim().split(" ").map((p) => p[0]).slice(0,2).join("").toUpperCase();
  if (user.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.image} alt={user.name ?? ""} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "1px solid #2a2a2a" }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#c4956a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 600, color: "#fff", border: "1px solid #2a2a2a" }}>
      {initials}
    </div>
  );
}

// ─── COPY BUTTON ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} title="Copy link"
      className="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-[#2a2a2a]"
      style={{ color: copied ? "#4ade80" : "#9a9a9a" }}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TeamsClient({
  initialTeams, userId,
}: {
  initialTeams: Team[];
  userId:       string;
}) {
  const [teams, setTeams]           = useState<Team[]>(initialTeams);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [view, setView]             = useState<"list" | "detail">("list");

  // ── Create team form ───────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [creating, setCreating]     = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true); setCreateError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createForm.name.trim(), description: createForm.description.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setTeams((prev) => [data.team, ...prev]);
        setCreateForm({ name: "", description: "" });
        setShowCreate(false);
      } else {
        setCreateError(typeof data.error === "string" ? data.error : "Failed to create team");
      }
    } catch { setCreateError("Network error"); }
    finally { setCreating(false); }
  };

  // ── Delete team ────────────────────────────────────────────────────────────
  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm("Delete this team? All members and event types will be removed.")) return;
    const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    if (res.ok) {
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      if (selectedTeam?.id === teamId) { setSelectedTeam(null); setView("list"); }
    }
  };

  // ── Add member ─────────────────────────────────────────────────────────────
  const [addEmail, setAddEmail]     = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    setAddingMember(true); setAddMemberError(null);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        const updated = { ...selectedTeam, members: [...selectedTeam.members, data.member] };
        setSelectedTeam(updated);
        setTeams((prev) => prev.map((t) => t.id === selectedTeam.id ? updated : t));
        setAddEmail("");
      } else {
        setAddMemberError(typeof data.error === "string" ? data.error : "Failed to add member");
      }
    } catch { setAddMemberError("Network error"); }
    finally { setAddingMember(false); }
  };

  // ── Remove member ──────────────────────────────────────────────────────────
  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeam) return;
    if (!confirm("Remove this member from the team?")) return;
    const res = await fetch(`/api/teams/${selectedTeam.id}/members?userId=${memberId}`, { method: "DELETE" });
    if (res.ok) {
      const updated = { ...selectedTeam, members: selectedTeam.members.filter((m) => m.userId !== memberId) };
      setSelectedTeam(updated);
      setTeams((prev) => prev.map((t) => t.id === selectedTeam.id ? updated : t));
    }
  };

  // ── Create event type ──────────────────────────────────────────────────────
  const [showNewEvent, setShowNewEvent]   = useState(false);
  const [eventForm, setEventForm]         = useState({ title: "", duration: "30", kind: "ROUND_ROBIN", locationType: "ZOOM" });
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [createEventError, setCreateEventError] = useState<string | null>(null);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    setCreatingEvent(true); setCreateEventError(null);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/event-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:        eventForm.title.trim(),
          duration:     parseInt(eventForm.duration),
          kind:         eventForm.kind,
          locationType: eventForm.locationType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const updated = { ...selectedTeam, eventTypes: [data.eventType, ...selectedTeam.eventTypes] };
        setSelectedTeam(updated);
        setTeams((prev) => prev.map((t) => t.id === selectedTeam.id ? updated : t));
        setEventForm({ title: "", duration: "30", kind: "ROUND_ROBIN", locationType: "GOOGLE_MEET" });
        setShowNewEvent(false);
      } else {
        setCreateEventError(typeof data.error === "string" ? data.error : "Failed to create event type");
      }
    } catch { setCreateEventError("Network error"); }
    finally { setCreatingEvent(false); }
  };

  // ── Delete event type ──────────────────────────────────────────────────────
  const handleDeleteEvent = async (eventId: string) => {
    if (!selectedTeam) return;
    if (!confirm("Delete this event type?")) return;
    const res = await fetch(`/api/teams/${selectedTeam.id}/event-types?id=${eventId}`, { method: "DELETE" });
    if (res.ok) {
      const updated = { ...selectedTeam, eventTypes: selectedTeam.eventTypes.filter((e) => e.id !== eventId) };
      setSelectedTeam(updated);
      setTeams((prev) => prev.map((t) => t.id === selectedTeam.id ? updated : t));
    }
  };

  const openTeam = (team: Team) => { setSelectedTeam(team); setView("detail"); };

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER — List
  // ════════════════════════════════════════════════════════════════════════════

  if (view === "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Teams</h1>
            <p className="mt-1 text-sm" style={{ color: "#9a9a9a" }}>
              Create teams for round-robin or collective bookings.
            </p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
            style={{ background: "#c4956a" }}>
            <Plus className="h-4 w-4" /> New team
          </button>
        </div>

        {/* Create team form */}
        {showCreate && (
          <div className="rounded-2xl p-6" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
            <h2 className="mb-4 text-base font-semibold text-white">Create a team</h2>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "#555" }}>
                  Team name <span style={{ color: "#c4956a" }}>*</span>
                </label>
                <input required value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Engineering team" autoFocus
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none"
                  style={{ border: "1px solid #2a2a2a", background: "transparent" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#c4956a")}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = "#2a2a2a")} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "#555" }}>
                  Description <span className="normal-case font-normal" style={{ color: "#333" }}>(optional)</span>
                </label>
                <input value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Book with our team"
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none"
                  style={{ border: "1px solid #2a2a2a", background: "transparent" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#c4956a")}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = "#2a2a2a")} />
              </div>
              {createError && <p className="text-sm" style={{ color: "#f87171" }}>{createError}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={creating}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "#c4956a" }}>
                  {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create
                </button>
                <button type="button" onClick={() => { setShowCreate(false); setCreateError(null); }}
                  className="rounded-xl px-5 py-2.5 text-sm" style={{ border: "1px solid #2a2a2a", color: "#9a9a9a" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Teams list */}
        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl py-20"
            style={{ background: "#111", border: "1px solid #1e1e1e" }}>
            <Users className="mb-3 h-10 w-10" style={{ color: "#333" }} />
            <p className="text-sm font-medium" style={{ color: "#555" }}>No teams yet</p>
            <p className="mt-1 text-xs" style={{ color: "#444" }}>Create a team to enable round-robin or collective bookings.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {teams.map((team) => (
              <button key={team.id} onClick={() => openTeam(team)}
                className="w-full rounded-xl p-5 text-left transition-colors hover:bg-[#161616]"
                style={{ background: "#111", border: "1px solid #1e1e1e" }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
                      <Users className="h-5 w-5" style={{ color: "#c4956a" }} />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{team.name}</p>
                      {team.description && <p className="mt-0.5 text-sm" style={{ color: "#9a9a9a" }}>{team.description}</p>}
                      <div className="mt-2 flex items-center gap-3 text-xs" style={{ color: "#555" }}>
                        <span>{team.members.length} member{team.members.length !== 1 ? "s" : ""}</span>
                        <span>·</span>
                        <span>{team.eventTypes.length} event type{team.eventTypes.length !== 1 ? "s" : ""}</span>
                        {team.myRole === "OWNER" && (
                          <><span>·</span><span style={{ color: "#c4956a" }}>Owner</span></>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Member avatars */}
                  <div className="flex shrink-0 items-center">
                    {team.members.slice(0, 4).map((m) => (
                      <div key={m.userId} style={{ marginLeft: -6 }}>
                        <MemberAvatar user={m.user} size={26} />
                      </div>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER — Detail
  // ════════════════════════════════════════════════════════════════════════════

  if (!selectedTeam) return null;
  const isOwner = selectedTeam.ownerId === userId;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => { setView("list"); setShowNewEvent(false); setAddEmail(""); setAddMemberError(null); }}
            className="mb-3 flex items-center gap-1 text-xs transition-colors hover:text-white" style={{ color: "#9a9a9a" }}>
            <ChevronLeft className="h-3.5 w-3.5" /> All teams
          </button>
          <h1 className="text-xl font-bold text-white">{selectedTeam.name}</h1>
          {selectedTeam.description && <p className="mt-0.5 text-sm" style={{ color: "#9a9a9a" }}>{selectedTeam.description}</p>}
          <p className="mt-1 text-xs" style={{ color: "#444" }}>scheduleit.app/team/{selectedTeam.slug}</p>
        </div>
        {isOwner && (
          <button onClick={() => handleDeleteTeam(selectedTeam.id)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-[#2a1212]"
            style={{ border: "1px solid #3a1a1a", color: "#ef4444" }}>
            <Trash2 className="h-3.5 w-3.5" /> Delete team
          </button>
        )}
      </div>

      {/* Members */}
      <section className="rounded-2xl" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "#1e1e1e" }}>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: "#c4956a" }} />
            <span className="text-sm font-semibold text-white">Members</span>
            <span className="text-xs" style={{ color: "#555" }}>{selectedTeam.members.length}</span>
          </div>
        </div>

        <div className="divide-y" style={{ borderColor: "#1a1a1a" }}>
          {selectedTeam.members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <MemberAvatar user={m.user} size={32} />
                <div>
                  <p className="text-sm font-medium text-white">{m.user.name ?? m.user.email}</p>
                  {m.user.name && <p className="text-xs" style={{ color: "#555" }}>{m.user.email}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 10, fontWeight: 600, color: m.role === "OWNER" ? "#c4956a" : "#555", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {m.role}
                </span>
                {isOwner && m.userId !== selectedTeam.ownerId && (
                  <button onClick={() => handleRemoveMember(m.userId)}
                    className="rounded p-1 transition-colors hover:bg-[#2a1212]" style={{ color: "#666" }} title="Remove member">
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add member form (owner only) */}
        {isOwner && (
          <div className="border-t px-5 py-4" style={{ borderColor: "#1e1e1e" }}>
            <form onSubmit={handleAddMember} className="flex items-center gap-2">
              <input type="email" required value={addEmail} onChange={(e) => setAddEmail(e.target.value)}
                placeholder="Add member by email…"
                className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                style={{ border: "1px solid #2a2a2a", background: "transparent" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#c4956a")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "#2a2a2a")} />
              <button type="submit" disabled={addingMember}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ background: "#1e1e1e", border: "1px solid #2a2a2a" }}>
                {addingMember ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                Add
              </button>
            </form>
            {addMemberError && <p className="mt-2 text-xs" style={{ color: "#f87171" }}>{addMemberError}</p>}
          </div>
        )}
      </section>

      {/* Event types */}
      <section className="rounded-2xl" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "#1e1e1e" }}>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" style={{ color: "#c4956a" }} />
            <span className="text-sm font-semibold text-white">Event types</span>
            <span className="text-xs" style={{ color: "#555" }}>{selectedTeam.eventTypes.length}</span>
          </div>
          {isOwner && (
            <button onClick={() => setShowNewEvent((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1e1e1e]"
              style={{ border: "1px solid #2a2a2a" }}>
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          )}
        </div>

        {/* Create event type form */}
        {showNewEvent && isOwner && (
          <div className="border-b px-5 py-5" style={{ borderColor: "#1e1e1e", background: "#0e0e0e" }}>
            <form onSubmit={handleCreateEvent} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider" style={{ color: "#555" }}>
                    Title <span style={{ color: "#c4956a" }}>*</span>
                  </label>
                  <input required value={eventForm.title} onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="30 min team meeting" autoFocus
                    className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                    style={{ border: "1px solid #2a2a2a", background: "transparent" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#c4956a")}
                    onBlur={(e)  => (e.currentTarget.style.borderColor = "#2a2a2a")} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider" style={{ color: "#555" }}>Duration (min)</label>
                  <input type="number" min={5} max={480} required value={eventForm.duration}
                    onChange={(e) => setEventForm((f) => ({ ...f, duration: e.target.value }))}
                    className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                    style={{ border: "1px solid #2a2a2a", background: "transparent" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#c4956a")}
                    onBlur={(e)  => (e.currentTarget.style.borderColor = "#2a2a2a")} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider" style={{ color: "#555" }}>Type</label>
                  <select value={eventForm.kind} onChange={(e) => setEventForm((f) => ({ ...f, kind: e.target.value }))}
                    className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                    style={{ border: "1px solid #2a2a2a", background: "#111" }}>
                    <option value="ROUND_ROBIN">Round robin</option>
                    <option value="COLLECTIVE">Collective</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider" style={{ color: "#555" }}>Location</label>
                  <select value={eventForm.locationType} onChange={(e) => setEventForm((f) => ({ ...f, locationType: e.target.value }))}
                    className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                    style={{ border: "1px solid #2a2a2a", background: "#111" }}>
                    <option value="GOOGLE_MEET" disabled>Google Meet (Coming soon)</option>
                    <option value="ZOOM">Zoom</option>
                    <option value="TEAMS" disabled>Microsoft Teams (Coming soon)</option>
                    <option value="PHONE">Phone</option>
                    <option value="IN_PERSON">In person</option>
                  </select>
                </div>
              </div>
              {createEventError && <p className="text-xs" style={{ color: "#f87171" }}>{createEventError}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={creatingEvent}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "#c4956a" }}>
                  {creatingEvent && <Loader2 className="h-3 w-3 animate-spin" />} Create
                </button>
                <button type="button" onClick={() => { setShowNewEvent(false); setCreateEventError(null); }}
                  className="rounded-xl px-4 py-2 text-sm" style={{ border: "1px solid #2a2a2a", color: "#9a9a9a" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Event list */}
        {selectedTeam.eventTypes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12" style={{ color: "#444" }}>
            <Calendar className="mb-2 h-7 w-7" />
            <p className="text-sm">No event types yet</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "#1a1a1a" }}>
            {selectedTeam.eventTypes.map((et) => {
              const shareUrl = `${appUrl}/team/${selectedTeam.slug}/${et.slug}`;
              return (
                <div key={et.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: et.color ?? "#c4956a" }} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{et.title}</span>
                        {kindBadge(et.kind)}
                      </div>
                      <p className="mt-0.5 text-xs" style={{ color: "#555" }}>
                        {durationLabel(et.duration)}
                        {" · "}
                        <span style={{ color: "#444" }}>/team/{selectedTeam.slug}/{et.slug}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <CopyButton text={shareUrl} />
                    <a href={shareUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-[#2a2a2a]"
                      style={{ color: "#9a9a9a" }}>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {isOwner && (
                      <button onClick={() => handleDeleteEvent(et.id)}
                        className="rounded p-1 transition-colors hover:bg-[#2a1212]" style={{ color: "#666" }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
