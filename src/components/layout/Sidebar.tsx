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
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Events", href: "/dashboard/event-types", icon: Link2 },
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
  isOpen?: boolean;
  onClose?: () => void;
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const initials =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : parts[0].slice(0, 2);
  return <>{initials.toUpperCase()}</>;
}

import { Logo } from "@/components/ui/Logo";

export function Sidebar({ user, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-bg-secondary">
      {/* Header — mobile gets a close button */}
      <div className="flex h-16 items-center justify-between px-6 mx-7">
        <Logo size="sm" />
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden text-text-muted hover:text-text-light transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5 mx-9" />
          </button>
        )}
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
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-accent text-text-light"
                  : "text-text-muted hover:bg-bg-primary hover:text-text-light"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-border px-4 py-4">
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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-text-light">
              <Initials name={user?.name ?? "U"} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-light">
              {user?.name ?? "User"}
            </p>
            <p className="truncate text-xs text-text-muted">
              {user?.email ?? ""}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            title="Sign out"
            className="text-text-muted transition-colors hover:text-text-light"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop — always visible */}
      <div className="hidden lg:block">{sidebarContent}</div>

      {/* Mobile/Tablet — overlay drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Drawer */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-transform duration-300 ease-out",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  );
}
