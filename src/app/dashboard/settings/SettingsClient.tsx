"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { Loader2, Check, X, ExternalLink, Upload, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "react-toastify";

// ─── Timezone list ─────────────────────────────────────────────────────────────
const TIMEZONES = [
  { label: "UTC", value: "UTC" },
  { label: "GMT (GMT+0)", value: "GMT" },
  { label: "London (GMT+0/+1)", value: "Europe/London" },
  { label: "Dublin (GMT+0/+1)", value: "Europe/Dublin" },
  { label: "Lisbon (GMT+0/+1)", value: "Europe/Lisbon" },
  { label: "Paris (GMT+1/+2)", value: "Europe/Paris" },
  { label: "Berlin (GMT+1/+2)", value: "Europe/Berlin" },
  { label: "Rome (GMT+1/+2)", value: "Europe/Rome" },
  { label: "Amsterdam (GMT+1/+2)", value: "Europe/Amsterdam" },
  { label: "Madrid (GMT+1/+2)", value: "Europe/Madrid" },
  { label: "Stockholm (GMT+1/+2)", value: "Europe/Stockholm" },
  { label: "Warsaw (GMT+1/+2)", value: "Europe/Warsaw" },
  { label: "Zurich (GMT+1/+2)", value: "Europe/Zurich" },
  { label: "Athens (GMT+2/+3)", value: "Europe/Athens" },
  { label: "Helsinki (GMT+2/+3)", value: "Europe/Helsinki" },
  { label: "Istanbul (GMT+3)", value: "Europe/Istanbul" },
  { label: "Moscow (GMT+3)", value: "Europe/Moscow" },
  { label: "Dubai (GMT+4)", value: "Asia/Dubai" },
  { label: "Karachi (GMT+5)", value: "Asia/Karachi" },
  { label: "Kolkata (GMT+5:30)", value: "Asia/Kolkata" },
  { label: "Dhaka (GMT+6)", value: "Asia/Dhaka" },
  { label: "Bangkok (GMT+7)", value: "Asia/Bangkok" },
  { label: "Singapore (GMT+8)", value: "Asia/Singapore" },
  { label: "Hong Kong (GMT+8)", value: "Asia/Hong_Kong" },
  { label: "Shanghai (GMT+8)", value: "Asia/Shanghai" },
  { label: "Tokyo (GMT+9)", value: "Asia/Tokyo" },
  { label: "Seoul (GMT+9)", value: "Asia/Seoul" },
  { label: "Sydney (GMT+10/+11)", value: "Australia/Sydney" },
  { label: "Melbourne (GMT+10/+11)", value: "Australia/Melbourne" },
  { label: "Brisbane (GMT+10)", value: "Australia/Brisbane" },
  { label: "Auckland (GMT+12/+13)", value: "Pacific/Auckland" },
  { label: "Honolulu (GMT-10)", value: "Pacific/Honolulu" },
  { label: "Anchorage (GMT-9/-8)", value: "America/Anchorage" },
  { label: "Los Angeles / Seattle (GMT-8/-7)", value: "America/Los_Angeles" },
  { label: "Denver (GMT-7/-6)", value: "America/Denver" },
  { label: "Phoenix (GMT-7)", value: "America/Phoenix" },
  { label: "Chicago (GMT-6/-5)", value: "America/Chicago" },
  { label: "Mexico City (GMT-6/-5)", value: "America/Mexico_City" },
  { label: "New York / Miami (GMT-5/-4)", value: "America/New_York" },
  { label: "Toronto (GMT-5/-4)", value: "America/Toronto" },
  { label: "Bogota (GMT-5)", value: "America/Bogota" },
  { label: "Lima (GMT-5)", value: "America/Lima" },
  { label: "Santiago (GMT-4/-3)", value: "America/Santiago" },
  { label: "Caracas (GMT-4)", value: "America/Caracas" },
  { label: "Halifax (GMT-4/-3)", value: "America/Halifax" },
  { label: "São Paulo (GMT-3/-2)", value: "America/Sao_Paulo" },
  { label: "Buenos Aires (GMT-3)", value: "America/Argentina/Buenos_Aires" },
  { label: "Montevideo (GMT-3/-2)", value: "America/Montevideo" },
  { label: "St. John's (GMT-3:30/-2:30)", value: "America/St_Johns" },
  { label: "Cape Verde (GMT-1)", value: "Atlantic/Cape_Verde" },
  { label: "Casablanca (GMT+0/+1)", value: "Africa/Casablanca" },
  { label: "Cairo (GMT+2/+3)", value: "Africa/Cairo" },
  { label: "Nairobi (GMT+3)", value: "Africa/Nairobi" },
  { label: "Johannesburg (GMT+2)", value: "Africa/Johannesburg" },
  { label: "Lagos (GMT+1)", value: "Africa/Lagos" },
];

// ─── Types ─────────────────────────────────────────────────────────────────────
interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  username: string | null;
  image: string | null;    // OAuth URL
  picture: string | null;  // uploaded base64
  timezone: string;
}

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

// ─── Canvas resize helper ──────────────────────────────────────────────────────
function resizeImageToBase64(file: File, maxPx = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Avatar display ────────────────────────────────────────────────────────────
function AvatarDisplay({
  picture,
  image,
  name,
  size = 72,
}: {
  picture: string | null;
  image: string | null;
  name: string | null;
  size?: number;
}) {
  const src = picture || image;
  const initials = ((name ?? "U").trim().split(" ").map((p) => p[0]).slice(0, 2).join("")).toUpperCase();

  if (src) {
    // For base64 data URLs we can't use next/image (no hostname), use a plain img
    if (src.startsWith("data:")) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? "Avatar"}
          style={{ width: size, height: size }}
          className="rounded-full object-cover"
        />
      );
    }
    return (
      <Image
        src={src}
        alt={name ?? "Avatar"}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full bg-accent font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SettingsClient() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [timezone, setTimezone] = useState("UTC");

  // Picture state: null = unchanged, string = new base64, "CLEAR" = remove
  const [pendingPicture, setPendingPicture] = useState<string | null | "CLEAR">(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Username check
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Load profile
  useEffect(() => {
    fetch("/api/user/profile")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load profile");
        return data as UserProfile;
      })
      .then((data) => {
        setProfile(data);
        setName(data.name ?? "");
        setUsername(data.username ?? "");
        setTimezone(data.timezone ?? "UTC");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Username availability debounce
  const checkUsername = useCallback(
    (val: string) => {
      if (usernameTimer.current) clearTimeout(usernameTimer.current);
      if (!val) { setUsernameStatus("idle"); return; }
      if (!/^[a-z0-9_-]{3,40}$/.test(val)) { setUsernameStatus("invalid"); return; }
      if (val === profile?.username) { setUsernameStatus("available"); return; }
      setUsernameStatus("checking");
      usernameTimer.current = setTimeout(async () => {
        const res = await fetch(`/api/user/username-check?username=${encodeURIComponent(val)}`);
        const data = await res.json();
        setUsernameStatus(data.available ? "available" : "taken");
      }, 500);
    },
    [profile?.username]
  );

  function handleUsernameChange(val: string) {
    const lower = val.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    setUsername(lower);
    checkUsername(lower);
  }

  // File picker handler
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSaveError("Please select an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSaveError("Image must be under 10 MB before compression.");
      return;
    }
    setUploadingPic(true);
    setSaveError(null);
    try {
      const base64 = await resizeImageToBase64(file, 300);
      setPendingPicture(base64);
      setPicturePreview(base64);
    } catch {
      setSaveError("Failed to process image. Please try another file.");
    } finally {
      setUploadingPic(false);
      // reset so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleRemovePicture() {
    setPendingPicture("CLEAR");
    setPicturePreview(null);
  }

  // Determine what avatar to show in the preview
  // Fall back to session image (Google OAuth URL) when DB hasn't loaded yet
  const displayPicture =
    pendingPicture === "CLEAR"
      ? null
      : pendingPicture !== null
      ? picturePreview
      : profile?.picture ?? null;

  const displayImage = displayPicture
    ? null
    : (profile?.image ?? session?.user?.image ?? null);

  // Save profile
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (usernameStatus === "taken" || usernameStatus === "invalid") return;

    setSaving(true);
    setSaveError(null);

    const body: Record<string, unknown> = {
      name: name || undefined,
      username: username || undefined,
      timezone,
    };

    if (pendingPicture === "CLEAR") {
      body.picture = null;
    } else if (pendingPicture !== null) {
      body.picture = pendingPicture;
    }

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        // non-JSON body (unexpected server crash)
      }

      if (!res.ok) {
        // Handle both string errors { error: "msg" } and field errors { error: { field: ["msg"] } }
        const err = data.error;
        let msg: string;
        if (typeof err === "string") {
          msg = err;
        } else if (err && typeof err === "object") {
          const first = Object.values(err as Record<string, string[]>)[0];
          msg = Array.isArray(first) ? first[0] : String(first);
        } else {
          msg = `Server error (${res.status}). Please try again.`;
        }
        setSaveError(msg);
        toast.error(msg);
      } else {
        // Refresh profile (non-picture fields); keep picture preview as-is
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                ...data,
                picture:
                  pendingPicture === "CLEAR"
                    ? null
                    : pendingPicture !== null
                    ? pendingPicture
                    : prev.picture,
              }
            : prev
        );
        setPendingPicture(null);
        toast.success("Profile saved successfully!");
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Network error. Please check your connection.");
    } finally {
      setSaving(false);
    }
  }

  // Delete account
  async function handleDeleteAccount() {
    if (deleteInput !== "delete my account") return;
    setDeleting(true);
    const res = await fetch("/api/user/profile", { method: "DELETE" });
    if (res.ok) {
      await signOut({ callbackUrl: "/" });
    } else {
      setDeleting(false);
      setSaveError("Failed to delete account. Please try again.");
      toast.error("Failed to delete account. Please try again.");
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  const publicUrl = username
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${username}`
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-text-muted">Manage your profile and public booking URL.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* ── Profile card ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your public name and avatar shown on booking pages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar upload */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <AvatarDisplay
                  picture={displayPicture}
                  image={displayImage}
                  name={(name || profile?.name || session?.user?.name) ?? null}
                  size={72}
                />
                {/* Upload overlay */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPic}
                  title="Upload photo"
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
                >
                  {uploadingPic ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : (
                    <Upload className="h-5 w-5 text-white" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-white">
                  {(name || profile?.name || session?.user?.name) ?? "Your name"}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPic}
                    className="text-xs text-accent hover:underline disabled:opacity-50"
                  >
                    {uploadingPic ? "Processing…" : "Upload photo"}
                  </button>
                  {(displayPicture || profile?.picture) && pendingPicture !== "CLEAR" && (
                    <>
                      <span className="text-border">·</span>
                      <button
                        type="button"
                        onClick={handleRemovePicture}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
                <p className="text-xs text-text-muted">
                  JPG, PNG or GIF — resized to 300×300. Stored in DB, never in your session token.
                </p>
              </div>
            </div>

            {/* Display name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-muted">
                Display name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                maxLength={100}
                className="w-full rounded-lg border border-border bg-bg-primary px-4 py-2.5 text-sm text-white placeholder:text-text-muted outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-muted">Email</label>
              <input
                type="email"
                value={profile?.email ?? session?.user?.email ?? ""}
                readOnly
                className="w-full cursor-not-allowed rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-muted outline-none"
              />
              <p className="mt-1 text-xs text-text-muted">Email cannot be changed.</p>
            </div>
          </CardContent>
        </Card>

        {/* ── Booking URL card ───────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Your booking URL</CardTitle>
            <CardDescription>
              Your public page will be at{" "}
              <span className="text-accent">scheduleit.com/{"{username}"}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-muted">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm text-text-muted">
                  scheduleit.com/
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="yourname"
                  maxLength={40}
                  className="w-full rounded-lg border border-border bg-bg-primary py-2.5 pl-[138px] pr-10 text-sm text-white placeholder:text-text-muted outline-none focus:border-accent transition-colors"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-text-muted" />}
                  {usernameStatus === "available" && <Check className="h-4 w-4 text-green-400" />}
                  {(usernameStatus === "taken" || usernameStatus === "invalid") && (
                    <X className="h-4 w-4 text-red-400" />
                  )}
                </div>
              </div>
              {usernameStatus === "taken" && (
                <p className="mt-1 text-xs text-red-400">That username is already taken.</p>
              )}
              {usernameStatus === "invalid" && (
                <p className="mt-1 text-xs text-red-400">
                  3–40 chars — lowercase letters, numbers, hyphens and underscores only.
                </p>
              )}
              {usernameStatus === "available" && username && (
                <p className="mt-1 text-xs text-green-400">Username is available!</p>
              )}
            </div>

            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
              >
                {publicUrl}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </CardContent>
        </Card>

        {/* ── Timezone card ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Timezone</CardTitle>
            <CardDescription>
              Availability and booking times are displayed in this timezone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="mb-1.5 block text-sm font-medium text-text-muted">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg-primary px-4 py-2.5 text-sm text-white outline-none focus:border-accent transition-colors"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-muted">
              Now:{" "}
              {new Date().toLocaleTimeString("en-US", {
                timeZone: timezone,
                timeZoneName: "short",
              })}
            </p>
          </CardContent>
        </Card>

        {/* ── Feedback + Save ────────────────────────────────────────────── */}
        {saveError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {saveError}
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={
              saving ||
              uploadingPic ||
              usernameStatus === "taken" ||
              usernameStatus === "invalid" ||
              usernameStatus === "checking"
            }
            className="min-w-[130px] gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>

      {/* ── Danger zone ────────────────────────────────────────────────────── */}
      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="text-red-400">Danger zone</CardTitle>
          <CardDescription>Irreversible actions — proceed with caution.</CardDescription>
        </CardHeader>
        <CardContent>
          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-white">Delete account</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  Permanently deletes your account, event types, bookings and all data. Cannot be undone.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="ml-4 shrink-0 gap-2"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete account
              </Button>
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border border-red-500/30 bg-red-500/5 px-5 py-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                <div>
                  <p className="text-sm font-semibold text-red-400">
                    This will permanently delete your account.
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    All your event types, bookings, availability settings and integrations will be
                    removed. This action <strong className="text-white">cannot be undone</strong>.
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">
                  Type{" "}
                  <span className="rounded bg-border px-1 py-0.5 font-mono text-white">
                    delete my account
                  </span>{" "}
                  to confirm
                </label>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="delete my account"
                  className="w-full rounded-lg border border-red-500/30 bg-bg-primary px-4 py-2.5 text-sm text-white placeholder:text-text-muted outline-none focus:border-red-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteInput !== "delete my account" || deleting}
                  onClick={handleDeleteAccount}
                  className="gap-2"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Yes, delete my account
                </Button>
                <button
                  type="button"
                  onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }}
                  className="text-sm text-text-muted hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

