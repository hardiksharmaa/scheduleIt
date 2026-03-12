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
    sm: { text: "text-xl",   gap: "gap-2" },
    md: { text: "text-xl",     gap: "gap-2.5" },
    lg: { text: "text-2xl",    gap: "gap-3" },
  };

  const s = sizes[size];

  const content = (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
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
