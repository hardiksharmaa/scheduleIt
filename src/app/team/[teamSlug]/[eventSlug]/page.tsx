import { notFound }         from "next/navigation";
import Image               from "next/image";
import { Calendar, Clock, Video, MapPin, Globe, Phone, Users } from "lucide-react";
import { db }              from "@/lib/db";
import TeamBookingFlow     from "./TeamBookingFlow";

interface PageProps {
  params: Promise<{ teamSlug: string; eventSlug: string }>;
}

function Avatar({
  image, name, size = 28,
}: { image: string | null; name: string | null; size?: number }) {
  const initials = (name ?? "?").trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  if (image) {
    if (image.startsWith("data:")) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={image} alt={name ?? ""} style={{ width: size, height: size }} className="rounded-full object-cover ring-1 ring-border" />;
    }
    return (
      <Image src={image} alt={name ?? ""} width={size} height={size}
        className="rounded-full object-cover ring-1 ring-border" style={{ width: size, height: size }} />
    );
  }
  return (
    <div className="flex items-center justify-center rounded-full bg-accent font-semibold text-white ring-1 ring-border"
      style={{ width: size, height: size, fontSize: size * 0.38 }}>
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
    case "GOOGLE_MEET": return { icon: <Video className="h-3.5 w-3.5" />, label: "Google Meet", detail: "Link provided on confirmation" };
    case "ZOOM":        return { icon: <Video className="h-3.5 w-3.5" />, label: "Zoom", detail: "Link provided on confirmation" };
    case "TEAMS":       return { icon: <Video className="h-3.5 w-3.5" />, label: "Microsoft Teams", detail: "Link provided on confirmation" };
    case "IN_PERSON":   return { icon: <MapPin className="h-3.5 w-3.5" />, label: value ?? "In person", detail: null };
    case "PHONE":       return { icon: <Phone className="h-3.5 w-3.5" />, label: "Phone call", detail: value ?? null };
    default:            return { icon: <Globe className="h-3.5 w-3.5" />, label: value ?? type, detail: null };
  }
}

function kindLabel(kind: string) {
  switch (kind) {
    case "ROUND_ROBIN": return "Round robin";
    case "COLLECTIVE":  return "Collective";
    case "GROUP":       return "Group";
    default:            return "One-on-one";
  }
}

export default async function TeamBookingPage({ params }: PageProps) {
  const { teamSlug, eventSlug } = await params;

  // Load team + event type
  const team = await db.team.findUnique({
    where: { slug: teamSlug },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!team) notFound();

  const eventType = await db.eventType.findFirst({
    where: { teamId: team.id, slug: eventSlug, isActive: true },
    select: {
      id: true, title: true, description: true, duration: true,
      kind: true, locationType: true, locationValue: true,
      color: true, maxAdvanceDays: true,
    },
  });
  if (!eventType) notFound();

  const loc = locationDisplay(eventType.locationType, eventType.locationValue);

  return (
    <div style={{ minHeight: "100vh", background: "#0c0c0c", color: "#fff" }}>
      <div className="mx-auto max-w-2xl px-4 py-12 md:py-16">
        {/* Team header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "#2A1B3D", border: "1px solid #44318D" }}>
              <Users className="h-7 w-7" style={{ color: "#D83F87" }} />
            </div>
          </div>
          <h1 className="text-xl font-bold text-white">{team.name}</h1>
          {team.description && (
            <p className="mt-1 text-sm" style={{ color: "#A4B3B6" }}>{team.description}</p>
          )}
          {/* Team member avatars */}
          <div className="mt-3 flex items-center justify-center gap-1">
            {team.members.slice(0, 6).map((m) => (
              <Avatar key={m.userId} image={m.user.image} name={m.user.name} size={26} />
            ))}
            {team.members.length > 6 && (
              <span className="ml-1 text-xs" style={{ color: "#A4B3B6" }}>+{team.members.length - 6}</span>
            )}
          </div>
        </div>

        {/* Event type card + booking flow */}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #44318D" }}>
          {/* Event info sidebar */}
          <div style={{ background: "#2A1B3D", borderBottom: "1px solid #44318D", padding: "24px 28px" }}>
            <div className="flex items-start gap-3">
              <div className="h-3 w-1 rounded-full mt-1.5 shrink-0" style={{ background: eventType.color ?? "#D83F87" }} />
              <div>
                <h2 className="text-lg font-bold text-white">{eventType.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs" style={{ color: "#A4B3B6" }}>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" style={{ color: "#D83F87" }} />
                    {durationLabel(eventType.duration)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {loc.icon}
                    {loc.label}
                    {loc.detail && <span style={{ color: "#A4B3B6" }}>· {loc.detail}</span>}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {kindLabel(eventType.kind)}
                  </span>
                </div>
                {eventType.description && (
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "#A4B3B6" }}>
                    {eventType.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Booking flow */}
          <div style={{ background: "#0e0e0e", padding: "28px" }}>
            <TeamBookingFlow
              teamEventTypeId={eventType.id}
              eventTitle={eventType.title}
              duration={eventType.duration}
              teamName={team.name}
              maxAdvanceDays={eventType.maxAdvanceDays}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
