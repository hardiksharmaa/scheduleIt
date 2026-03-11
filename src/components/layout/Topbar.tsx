"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Bell, Search, Settings, LogOut } from "lucide-react";
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="flex h-16 items-center justify-between bg-transparent px-6 relative z-40">
      <div className="flex items-center gap-3">
        {title && (
          <h1 className="text-lg font-semibold text-text-light">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Search trigger */}
        <Button variant="ghost" size="icon" aria-label="Search">
          <Search className="h-4 w-4 text-text-muted" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4 text-text-muted" />
        </Button>

        {/* Avatar Dropdown Wrapper */}
        <div className="relative" ref={dropdownRef}>
          <div 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="cursor-pointer hover:ring-2 hover:ring-border rounded-full transition-all"
          >
            {user?.image ? (
              user.image.startsWith("data:") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={user.name}
                  className="ml-1 h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <Image
                  src={user.image}
                  alt={user.name}
                  width={32}
                  height={32}
                  className="ml-1 h-8 w-8 rounded-full object-cover"
                />
              )
            ) : (
              <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-text-light">
                <Initials name={user?.name ?? "U"} />
              </div>
            )}
          </div>

          {/* Custom Dropdown Modal */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-3 w-48 rounded-md bg-bg-secondary border border-border shadow-premium overflow-hidden z-50 origin-top-right animate-in fade-in duration-200">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-medium text-text-light truncate">
                  {user?.name ?? "User"}
                </p>
                <p className="text-xs text-text-muted truncate">
                  {user?.email ?? ""}
                </p>
              </div>
              
              <div className="py-1">
                <Link 
                  href="/dashboard/settings" 
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-text-light hover:bg-bg-primary transition-colors"
                >
                  <Settings className="h-4 w-4 text-text-muted" />
                  Settings
                </Link>
                
                <button 
                  onClick={() => {
                    setIsDropdownOpen(false);
                    signOut({ callbackUrl: "/" });
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors text-left"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
