import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, Video, MapPin, Globe } from "lucide-react";
import { db } from "@/lib/db";

interface PageProps {
  params: Promise<{ username: string }>;
}

function Avatar({ picture, image, name, size = 80 }: { picture: string | null; image: string | null; name: string | null; size?: number }) {
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
          className="rounded-full object-cover ring-4 ring-border"
        />
      );
    }
    return (
      <Image
        src={src}
        alt={name ?? "Avatar"}
        width={size}
        height={size}
        className="rounded-full object-cover ring-4 ring-border"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-accent font-bold text-white ring-4 ring-border"
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

function locationIcon(type: string) {
  switch (type) {
    case "GOOGLE_MEET":
    case "ZOOM":
    case "TEAMS":
      return <Video className="h-3.5 w-3.5" />;
    case "IN_PERSON":
      return <MapPin className="h-3.5 w-3.5" />;
    default:
      return <Globe className="h-3.5 w-3.5" />;
  }
}

function locationLabel(type: string) {
  switch (type) {
    case "GOOGLE_MEET": return "Google Meet";
    case "ZOOM": return "Zoom";
    case "TEAMS": return "Microsoft Teams";
    case "IN_PERSON": return "In person";
    case "PHONE": return "Phone call";
    default: return type;
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;

  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      image: true,
      picture: true,
      username: true,
      timezone: true,
      eventTypes: {
        where: { isActive: true },
        orderBy: { duration: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          duration: true,
          slug: true,
          locationType: true,
          color: true,
        },
      },
    },
  });

  if (!user) notFound();

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-16">
      <div className="mx-auto max-w-2xl">
        {/* Profile header */}
        <div className="mb-12 flex flex-col items-center text-center">
          <Avatar picture={user.picture} image={user.image} name={user.name} size={88} />
          <h1 className="mt-5 text-3xl font-bold text-white">{user.name}</h1>
          <p className="mt-1 text-sm text-text-muted">@{user.username}</p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
            <Globe className="h-3 w-3" />
            {user.timezone}
          </div>
          <p className="mt-4 max-w-md text-sm text-text-muted">
            Select an event type below to book a time.
          </p>
        </div>

        {/* Event types */}
        {user.eventTypes.length === 0 ? (
          <div className="rounded-xl border border-border bg-bg-secondary p-12 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-border" />
            <p className="text-sm font-medium text-white">No event types yet</p>
            <p className="mt-1 text-xs text-text-muted">
              {user.name} hasn&apos;t published any booking types yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {user.eventTypes.map((event) => (
              <Link
                key={event.id}
                href={`/${username}/${event.slug}`}
                className="group flex items-center justify-between rounded-xl border border-border bg-bg-secondary p-6 transition-all hover:border-accent hover:bg-[#44318D]"
              >
                <div className="flex items-start gap-4">
                  {/* Color dot */}
                  <div
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: event.color ?? "#D83F87" }}
                  />
                  <div>
                    <h2 className="text-base font-semibold text-white group-hover:text-accent transition-colors">
                      {event.title}
                    </h2>
                    {event.description && (
                      <p className="mt-1 text-sm text-text-muted line-clamp-2">
                        {event.description}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {durationLabel(event.duration)}
                      </span>
                      {event.locationType && (
                        <span className="flex items-center gap-1">
                          {locationIcon(event.locationType)}
                          {locationLabel(event.locationType)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ml-4 shrink-0 text-sm font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                  Book →
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-white transition-colors"
          >
            <Calendar className="h-3.5 w-3.5" />
            Powered by ScheduleIt
          </Link>
        </div>
      </div>
    </div>
  );
}
