"use client";

import Image from "next/image";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopbarUser {
  name: string;
  email: string;
  image: string | null;
}

interface TopbarProps {
  title?: string;
  user?: TopbarUser;
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const initials =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : parts[0].slice(0, 2);
  return <>{initials.toUpperCase()}</>;
}

export function Topbar({ title, user }: TopbarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-[#2e2e2e] bg-[#181818] px-6">
      <div className="flex items-center gap-3">
        {title && (
          <h1 className="text-lg font-semibold text-[#ffffff]">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Search trigger */}
        <Button variant="ghost" size="icon" aria-label="Search">
          <Search className="h-4 w-4 text-[#9a9a9a]" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4 text-[#9a9a9a]" />
        </Button>

        {/* Avatar */}
        {user?.image ? (
          user.image.startsWith("data:") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name}
              className="ml-1 h-8 w-8 cursor-pointer rounded-full object-cover"
            />
          ) : (
            <Image
              src={user.image}
              alt={user.name}
              width={32}
              height={32}
              className="ml-1 h-8 w-8 cursor-pointer rounded-full object-cover"
            />
          )
        ) : (
          <div className="ml-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#c4956a] text-xs font-semibold text-[#ffffff]">
            <Initials name={user?.name ?? "U"} />
          </div>
        )}
      </div>
    </header>
  );
}
