"use client";

import { useState }    from "react";
import { useRouter }   from "next/navigation";

export function GoogleDisconnectButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    setLoading(true);
    try {
      await fetch("/api/integrations/google/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDisconnect}
      disabled={loading}
      style={{
        padding:          "6px 14px",
        borderRadius:     6,
        border:           "1px solid #3a3a3a",
        background:       "transparent",
        color:            "#A4B3B6",
        fontSize:         13,
        cursor:           loading ? "not-allowed" : "pointer",
        opacity:          loading ? 0.6 : 1,
        transition:       "border-color 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#ff6b6b";
        e.currentTarget.style.color       = "#ff6b6b";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#3a3a3a";
        e.currentTarget.style.color       = "#A4B3B6";
      }}
    >
      {loading ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
