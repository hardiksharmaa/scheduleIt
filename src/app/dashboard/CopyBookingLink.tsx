"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CopyBookingLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 border-[#2e2e2e] text-[#9a9a9a] hover:border-[#c4956a] hover:text-white"
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-[#c4956a]" />
          <span className="text-[#c4956a]">Copied!</span>
        </>
      ) : (
        <>
          <Link2 className="h-3.5 w-3.5" /> Copy link
        </>
      )}
    </Button>
  );
}
