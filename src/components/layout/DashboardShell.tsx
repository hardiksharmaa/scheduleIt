"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { WelcomeModal } from "@/app/dashboard/WelcomeModal";

interface DashboardUser {
  name: string;
  email: string;
  image: string | null;
}

export function DashboardShell({
  user,
  children,
  showWelcome = false,
}: {
  user: DashboardUser;
  children: React.ReactNode;
  showWelcome?: boolean;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-bg-secondary">
      <Sidebar
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar sits flush against the top/right matching Sidebar bg */}
        <Topbar
          user={user}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        />

        {/* Dashboard inner content panel */}
        <div className="flex-1 bg-bg-primary rounded-tl-3xl border-l border-t border-border/50 shadow-2xl overflow-hidden mr-0 mb-0 flex flex-col">
          <main className="flex-1 overflow-y-auto w-full p-6 md:p-8">
            {children}
          </main>
        </div>
      </div>
      {showWelcome && <WelcomeModal />}
    </div>
  );
}
