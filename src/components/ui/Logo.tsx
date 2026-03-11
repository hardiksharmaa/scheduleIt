import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  linkTo?: string;
  className?: string;
}

/**
 * Reusable ScheduleIt logo component.
 *
 * Renders a small calendar icon glyph + gradient brand text.
 * Three sizes: sm (sidebar), md (auth pages), lg (hero / marketing).
 */
export function Logo({ size = "md", linkTo = "/", className = "" }: LogoProps) {
  const sizes = {
    sm: { icon: 20, text: "text-base",   gap: "gap-2" },
    md: { icon: 24, text: "text-xl",     gap: "gap-2.5" },
    lg: { icon: 32, text: "text-2xl",    gap: "gap-3" },
  };

  const s = sizes[size];

  const content = (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      {/* Calendar icon glyph — custom SVG for brand consistency */}
      <span
        className="inline-flex items-center justify-center rounded-lg"
        style={{
          width: s.icon + 8,
          height: s.icon + 8,
          background: "linear-gradient(135deg, #D83F87, #44318D)",
          boxShadow: "0 2px 8px rgba(216, 63, 135, 0.35)",
        }}
      >
        <svg
          width={s.icon}
          height={s.icon}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Calendar body */}
          <rect
            x="3"
            y="4"
            width="18"
            height="18"
            rx="3"
            stroke="white"
            strokeWidth="1.8"
            fill="none"
          />
          {/* Top hooks */}
          <line x1="8" y1="2" x2="8" y2="6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="16" y1="2" x2="16" y2="6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          {/* Divider line */}
          <line x1="3" y1="10" x2="21" y2="10" stroke="white" strokeWidth="1.5" />
          {/* Check mark */}
          <path d="M8.5 15.5L11 18L16 13" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      {/* Brand name with gradient */}
      <span
        className={`${s.text} font-bold tracking-wide select-none`}
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #D83F87 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Schedule<span style={{ WebkitTextFillColor: "transparent", background: "linear-gradient(135deg, #D83F87, #E98074)", WebkitBackgroundClip: "text", backgroundClip: "text" }}>It</span>
      </span>
    </span>
  );

  if (linkTo) {
    return (
      <Link href={linkTo} className="inline-flex items-center no-underline">
        {content}
      </Link>
    );
  }

  return content;
}
