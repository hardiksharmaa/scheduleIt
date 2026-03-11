import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, Video, MapPin, Globe, Phone } from "lucide-react";
import { db } from "@/lib/db";
import BookingFlow from "./BookingFlow";

interface PageProps {
  params: Promise<{ username: string; slug: string }>;
}

function Avatar({
  picture,
  image,
  name,
  size = 64,
}: {
  picture: string | null;
  image: string | null;
  name: string | null;
  size?: number;
}) {
  const src = picture || image;
  const initials = (name ?? "?")
    .trim()
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (src) {
    if (src.startsWith("data:")) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? "Avatar"}
          style={{ width: size, height: size }}
          className="rounded-full object-cover ring-2 ring-border"
        />
      );
    }
    return (
      <Image
        src={src}
        alt={name ?? "Avatar"}
        width={size}
        height={size}
        className="rounded-full object-cover ring-2 ring-border"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-accent font-bold text-white ring-2 ring-border"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function locationDisplay(type: string, value: string | null) {
  switch (type) {
    case "GOOGLE_MEET":
      return { icon: <Video className="h-4 w-4" />, label: "Google Meet", detail: "A link will be provided on confirmation" };
    case "ZOOM":
      return { icon: <Video className="h-4 w-4" />, label: "Zoom", detail: "A link will be provided on confirmation" };
    case "TEAMS":
      return { icon: <Video className="h-4 w-4" />, label: "Microsoft Teams", detail: "A link will be provided on confirmation" };
    case "IN_PERSON":
      return { icon: <MapPin className="h-4 w-4" />, label: "In Person", detail: value ?? "" };
    case "PHONE":
      return { icon: <Phone className="h-4 w-4" />, label: "Phone Call", detail: value ?? "" };
    default:
      return { icon: <Globe className="h-4 w-4" />, label: "Other", detail: value ?? "" };
  }
}

export default async function EventTypeBookingPage({ params }: PageProps) {
  const { username, slug } = await params;

  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      image: true,
      picture: true,
      username: true,
      timezone: true,
    },
  });

  if (!user) notFound();

  const eventType = await db.eventType.findFirst({
    where: { userId: user.id, slug, isActive: true },
    select: {
      id: true,
      title: true,
      description: true,
      duration: true,
      kind: true,
      locationType: true,
      locationValue: true,
      minNotice: true,
      maxBookings: true,
      maxAdvanceDays: true,
      color: true,
    },
  });

  if (!eventType) notFound();

  const location = locationDisplay(eventType.locationType, eventType.locationValue);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Outer centering wrapper */}
      <div className="mx-auto min-h-screen max-w-5xl md:flex">

        {/* ── Left panel: host + event info ─────────────────────────────── */}
        <aside className="md:sticky md:top-0 md:h-screen md:w-[320px] md:shrink-0 md:overflow-y-auto"
          style={{ borderRight: "1px solid #44318D" }}>
          <div className="flex h-full flex-col justify-between px-8 py-12">
            <div>
              {/* Avatar + name */}
              <div className="mb-8 flex items-center gap-3">
                <Avatar picture={user.picture} image={user.image} name={user.name} size={42} />
                <div>
                  <p className="text-sm font-semibold text-white">{user.name}</p>
                  <p className="text-xs" style={{ color: "#A4B3B6" }}>@{user.username}</p>
                </div>
              </div>

              {/* Color bar + title */}
              <div className="flex items-start gap-3">
                <div
                  className="mt-2 h-full w-0.5 shrink-0 self-stretch rounded-full"
                  style={{ backgroundColor: eventType.color ?? "#D83F87", minHeight: 24 }}
                />
                <div>
                  <h1 className="text-2xl font-bold leading-snug text-white">
                    {eventType.title}
                  </h1>
                  {eventType.description && (
                    <p className="mt-2.5 text-sm leading-relaxed" style={{ color: "#A4B3B6" }}>
                      {eventType.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="my-7" style={{ borderTop: "1px solid #44318D" }} />

              {/* Meta */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-3 text-sm" style={{ color: "#A4B3B6" }}>
                  <Clock className="h-4 w-4 shrink-0" style={{ color: "#D83F87" }} />
                  <span>{durationLabel(eventType.duration)}</span>
                </div>
                <div className="flex items-start gap-3 text-sm" style={{ color: "#A4B3B6" }}>
                  <span className="mt-0.5 shrink-0" style={{ color: "#D83F87" }}>{location.icon}</span>
                  <div>
                    <span>{location.label}</span>
                    {location.detail && (
                      <p className="mt-0.5 text-xs" style={{ color: "#A4B3B6" }}>{location.detail}</p>
                    )}
                  </div>
                </div>
                {eventType.minNotice > 0 && (
                  <div className="flex items-center gap-3 text-sm" style={{ color: "#A4B3B6" }}>
                    <Globe className="h-4 w-4 shrink-0" style={{ color: "#D83F87" }} />
                    <span>
                      {eventType.minNotice < 60
                        ? `${eventType.minNotice} min`
                        : `${Math.round(eventType.minNotice / 60)}h`}{" "}
                      advance notice
                    </span>
                  </div>
                )}
                {eventType.maxBookings && (
                  <div className="flex items-center gap-3 text-sm" style={{ color: "#A4B3B6" }}>
                    <Calendar className="h-4 w-4 shrink-0" style={{ color: "#D83F87" }} />
                    <span>Up to {eventType.maxBookings} attendees</span>
                  </div>
                )}
              </div>
            </div>

            {/* Branding */}
            <div className="mt-12">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs transition-colors hover:text-white"
                style={{ color: "#A4B3B6" }}
              >
                <Calendar className="h-3 w-3" />
                Powered by ScheduleIt
              </Link>
            </div>
          </div>
        </aside>

        {/* ── Right panel: booking flow ──────────────────────────────────── */}
        <main className="flex flex-1 items-start justify-center px-6 py-12 md:px-10 md:py-12">
          <div className="w-full max-w-sm">
            <BookingFlow
              eventTypeId={eventType.id}
              eventTitle={eventType.title}
              duration={eventType.duration}
              hostName={user.name ?? "Host"}
              maxAdvanceDays={eventType.maxAdvanceDays}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
