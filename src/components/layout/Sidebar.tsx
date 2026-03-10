"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Calendar,
  Clock,
  LayoutDashboard,
  Link2,
  Settings,
  BarChart2,
  Users,
  Plug,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Event Types", href: "/dashboard/event-types", icon: Link2 },
  { label: "Bookings", href: "/dashboard/bookings", icon: Calendar },
  { label: "Availability", href: "/dashboard/availability", icon: Clock },
  { label: "Teams", href: "/dashboard/teams", icon: Users },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart2 },
  { label: "Integrations", href: "/dashboard/integrations", icon: Plug },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

interface SidebarUser {
  name: string;
  email: string;
  image: string | null;
}

interface SidebarProps {
  user?: SidebarUser;
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const initials =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : parts[0].slice(0, 2);
  return <>{initials.toUpperCase()}</>;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-[#2e2e2e] bg-[#181818]">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-[#2e2e2e] px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c4956a]">
            <Calendar className="h-4 w-4 text-[#ffffff]" />
          </div>
          <span className="text-lg font-bold text-[#ffffff]">ScheduleIt</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-[#c4956a] text-[#ffffff]"
                  : "text-[#9a9a9a] hover:bg-[#0c0c0c] hover:text-[#ffffff]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-[#2e2e2e] px-4 py-4">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          {/* Avatar */}
          {user?.image ? (
            user.image.startsWith("data:") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <Image
                src={user.image}
                alt={user.name}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
              />
            )
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c4956a] text-xs font-semibold text-[#ffffff]">
              <Initials name={user?.name ?? "U"} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#ffffff]">
              {user?.name ?? "User"}
            </p>
            <p className="truncate text-xs text-[#9a9a9a]">
              {user?.email ?? ""}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            className="text-[#9a9a9a] transition-colors hover:text-[#ffffff]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
