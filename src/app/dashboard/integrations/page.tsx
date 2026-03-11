import { redirect }    from "next/navigation";
import { CheckCircle2, Calendar } from "lucide-react";
import { auth }         from "@/lib/auth";
import { db }           from "@/lib/db";
import { GoogleDisconnectButton }        from "./GoogleDisconnectButton";
import { IntegrationDisconnectButton }   from "./IntegrationDisconnectButton";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getSuccessBanner(connected?: string | string[]) {
  if (connected === "google") return "Google Calendar connected! Busy times will now be blocked off automatically.";
  if (connected === "zoom")   return "Zoom connected! Zoom meetings will be created automatically on booking.";
  if (connected === "teams")  return "Microsoft Teams connected! Teams meetings will be created automatically on booking.";
  return null;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function IntegrationsPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;

  const [googleIntegration, zoomIntegration, teamsIntegration] = await Promise.all([
    db.calendarIntegration.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: "GOOGLE_CALENDAR" } },
      select: { isActive: true, updatedAt: true },
    }),
    db.calendarIntegration.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: "ZOOM" } },
      select: { isActive: true, updatedAt: true },
    }),
    db.calendarIntegration.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: "MICROSOFT_TEAMS" } },
      select: { isActive: true, updatedAt: true },
    }),
  ]);

  const isGoogleConnected = googleIntegration?.isActive === true;
  const isZoomConnected   = zoomIntegration?.isActive   === true;
  const isTeamsConnected  = teamsIntegration?.isActive  === true;

  const successMsg = getSuccessBanner(params.connected);
  const errorMsg   = typeof params.error === "string" ? params.error : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-light">Integrations</h1>
        <p className="mt-1 text-sm text-text-muted">
          Connect your calendar and conferencing tools to automate scheduling.
        </p>
      </div>

      {successMsg && (
        <div style={{ background: "#0f2a1a", border: "1px solid #1a5c30", borderRadius: 8,
          padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
          color: "#4ade80", fontSize: 14 }}>
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ background: "#2a0f0f", border: "1px solid #5c1a1a", borderRadius: 8,
          padding: "12px 16px", color: "#f87171", fontSize: 14 }}>
          Could not connect: <strong>{errorMsg.replace(/_/g, " ")}</strong>. Please try again.
        </div>
      )}

      {/* Calendar */}
      <section>
        <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "#A4B3B6",
          textTransform: "uppercase", marginBottom: 12 }}>
          Calendar
        </h2>
        {/* Google Calendar — Coming Soon */}
        <div style={{ background: "#2A1B3D", border: "1px solid #44318D", borderRadius: 10,
          padding: "20px 24px", display: "flex", alignItems: "start",
          justifyContent: "space-between", gap: 16, opacity: 0.6 }}>
          <div style={{ display: "flex", alignItems: "start", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#2A1B3D",
              border: "1px solid #44318D", display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0 }}>
              <Calendar size={18} color="#D83F87" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: "#ffffff" }}>Google Calendar</div>
              <div style={{ fontSize: 13, color: "#A4B3B6", marginTop: 2, lineHeight: 1.5 }}>
                Block off busy times and auto-generate Google Meet links on every booking.
              </div>
            </div>
          </div>
          <div style={{ flexShrink: 0, marginTop: 2 }}>
            <span style={{ display: "inline-block", padding: "5px 12px", borderRadius: 6,
              background: "#44318D", border: "1px solid #44318D",
              color: "#888888", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>
              Coming soon
            </span>
          </div>
        </div>
      </section>

      {/* Conferencing */}
      <section>
        <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "#A4B3B6",
          textTransform: "uppercase", marginBottom: 12 }}>
          Conferencing
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Google Meet — Coming Soon */}
          <div style={{ background: "#2A1B3D", border: "1px solid #44318D", borderRadius: 10,
            padding: "20px 24px", display: "flex", alignItems: "start",
            justifyContent: "space-between", gap: 16, opacity: 0.6 }}>
            <div style={{ display: "flex", alignItems: "start", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#2A1B3D",
                border: "1px solid #44318D", display: "flex", alignItems: "center",
                justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="5" fill="#00897B"/>
                  <path d="M15 10.5l3.5-2.5v8L15 13.5V10.5zM4 9h8.5A1.5 1.5 0 0 1 14 10.5v4A1.5 1.5 0 0 1 12.5 16H4A1.5 1.5 0 0 1 2.5 14.5v-4A1.5 1.5 0 0 1 4 9z" fill="white"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#ffffff" }}>Google Meet</div>
                <div style={{ fontSize: 13, color: "#A4B3B6", marginTop: 2, lineHeight: 1.5 }}>
                  Auto-generate Google Meet links. Requires Google Calendar to be connected.
                </div>
              </div>
            </div>
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              <span style={{ display: "inline-block", padding: "5px 12px", borderRadius: 6,
                background: "#44318D", border: "1px solid #44318D",
                color: "#888888", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>
                Coming soon
              </span>
            </div>
          </div>
          {/* Zoom — Coming Soon */}
          <div style={{ background: "#2A1B3D", border: "1px solid #44318D", borderRadius: 10,
            padding: "20px 24px", display: "flex", alignItems: "start",
            justifyContent: "space-between", gap: 16, opacity: 0.6 }}>
            <div style={{ display: "flex", alignItems: "start", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#2A1B3D",
                border: "1px solid #44318D", display: "flex", alignItems: "center",
                justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="5" fill="#2D8CFF"/>
                  <path d="M14.5 9.5v5l3.5 2V7.5l-3.5 2zM5 8h7.5A1.5 1.5 0 0 1 14 9.5v5A1.5 1.5 0 0 1 12.5 16H5A1.5 1.5 0 0 1 3.5 14.5v-5A1.5 1.5 0 0 1 5 8z" fill="white"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#ffffff" }}>Zoom</div>
                <div style={{ fontSize: 13, color: "#A4B3B6", marginTop: 2, lineHeight: 1.5 }}>
                  Automatically create Zoom meetings for video call event types.
                </div>
              </div>
            </div>
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              <span style={{ display: "inline-block", padding: "5px 12px", borderRadius: 6,
                background: "#44318D", border: "1px solid #44318D",
                color: "#888888", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>
                Coming soon
              </span>
            </div>
          </div>
          {/* Microsoft Teams — Coming Soon */}
          <div style={{ background: "#2A1B3D", border: "1px solid #44318D", borderRadius: 10,
            padding: "20px 24px", display: "flex", alignItems: "start",
            justifyContent: "space-between", gap: 16, opacity: 0.6 }}>
            <div style={{ display: "flex", alignItems: "start", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#2A1B3D",
                border: "1px solid #44318D", display: "flex", alignItems: "center",
                justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="5" fill="#5059C9"/>
                  <path d="M13.5 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm3 1H11a2 2 0 0 0-2 2v3h9v-3a2 2 0 0 0-2-2z" fill="white"/>
                  <path d="M8.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM7 12H4.5A1.5 1.5 0 0 0 3 13.5V16.5h5v-3A2 2 0 0 1 8.5 12z" fill="white" opacity=".75"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#ffffff" }}>Microsoft Teams</div>
                <div style={{ fontSize: 13, color: "#A4B3B6", marginTop: 2, lineHeight: 1.5 }}>
                  Automatically create Teams meetings for video call event types.
                </div>
              </div>
            </div>
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              <span style={{ display: "inline-block", padding: "5px 12px", borderRadius: 6,
                background: "#44318D", border: "1px solid #44318D",
                color: "#888888", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>
                Coming soon
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function IntegrationCard({
  icon, name, isConnected, connectedSince, description,
  connectHref, disconnectButton, setupNote,
}: {
  icon:             React.ReactNode;
  name:             string;
  isConnected:      boolean;
  connectedSince:   string | null;
  description:      string;
  connectHref:      string;
  disconnectButton: React.ReactNode;
  setupNote?:       string | null;
}) {
  return (
    <div style={{ background: "#2A1B3D", border: "1px solid #44318D", borderRadius: 10,
      padding: "20px 24px", display: "flex", alignItems: "start",
      justifyContent: "space-between", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "start", gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#2A1B3D",
          border: "1px solid #44318D", display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: "#ffffff" }}>{name}</div>
          <div style={{ fontSize: 13, color: "#A4B3B6", marginTop: 2, lineHeight: 1.5 }}>
            {isConnected ? (
              <>
                <span style={{ color: "#4ade80", fontWeight: 500 }}>● Connected</span>
                {connectedSince && <span style={{ color: "#A4B3B6", marginLeft: 8 }}>since {connectedSince}</span>}
                <div style={{ marginTop: 6, color: "#A4B3B6" }}>{description}</div>
              </>
            ) : (
              <>
                {description}
                {setupNote && <div style={{ marginTop: 4, fontSize: 11, color: "#A4B3B6" }}>{setupNote}</div>}
              </>
            )}
          </div>
        </div>
      </div>
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        {isConnected ? disconnectButton : (
          <a href={connectHref} style={{ display: "inline-block", padding: "7px 16px",
            borderRadius: 6, background: "#D83F87", color: "#000000", fontWeight: 600,
            fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}>
            Connect
          </a>
        )}
      </div>
    </div>
  );
}
