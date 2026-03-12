"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";

interface TooltipProps {
  content: string;
  children: ReactNode;
  /** Placement relative to the trigger element */
  side?: "top" | "bottom";
  /** Extra delay before showing (ms) */
  delayMs?: number;
}

export function Tooltip({ content, children, side = "top", delayMs = 300 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  const show = useCallback(() => {
    timer.current = setTimeout(() => setVisible(true), delayMs);
  }, [delayMs]);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
  }, []);

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1a1a2e] px-2.5 py-1.5 text-xs font-medium text-white shadow-lg border border-border ${
            side === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {content}
          {/* Arrow */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-[#1a1a2e] border-border ${
              side === "top"
                ? "top-full -mt-1 border-b border-r"
                : "bottom-full -mb-1 border-t border-l"
            }`}
          />
        </div>
      )}
    </div>
  );
}
