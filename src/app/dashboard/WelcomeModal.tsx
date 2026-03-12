"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Link2,
  ArrowRight,
  X,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Small delay so the dashboard renders first
    const timer = setTimeout(() => setOpen(true), 500);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    setOpen(false);
    // Persist in DB so this never shows again, even on other browsers/devices
    fetch("/api/user/welcome-seen", { method: "POST" }).catch(() => {});
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-bg-secondary shadow-2xl">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-border hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-2 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#44318D]">
            <Calendar className="h-7 w-7 text-text-muted" />
          </div>
          <h2 className="text-xl font-bold text-white">
            Welcome to ScheduleIt
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            Get started in 3 simple steps to begin receiving bookings.
          </p>
        </div>

        {/* Steps */}
        <div className="px-8 py-6 space-y-4">
          {/* Step 1 */}
          <div className="flex items-start gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
              1
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-text-muted" />
                Create an Event
              </h3>
              <p className="mt-1 text-xs text-text-muted leading-relaxed">
                Set up a meeting type with a title, duration, and location. This becomes your shareable booking page.
              </p>
            </div>
          </div>

          {/* Connector */}
          <div className="ml-4 h-3 flex items-center">
            <div className="h-full w-0.5 rounded-full bg-border" />
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#44318D] text-sm font-bold text-text-muted">
              2
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-text-muted" />
                Set Your Availability
              </h3>
              <p className="mt-1 text-xs text-text-muted leading-relaxed">
                Define your weekly working hours so people can only book when you&apos;re free.
              </p>
            </div>
          </div>

          {/* Connector */}
          <div className="ml-4 h-3 flex items-center">
            <div className="h-full w-0.5 rounded-full bg-border" />
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#44318D] text-sm font-bold text-text-muted">
              3
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Link2 className="h-4 w-4 text-text-muted" />
                Share Your Booking Link
              </h3>
              <p className="mt-1 text-xs text-text-muted leading-relaxed">
                Copy your unique link and share it via email, website, or social media. People pick a time and you&apos;re booked.
              </p>
            </div>
          </div>
        </div>

        {/* Visual flow */}
        <div className="mx-8 rounded-xl bg-bg-primary/60 border border-border/50 px-4 py-3">
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="rounded-full bg-[#44318D] px-3 py-1 font-medium text-text-muted">
              Event
            </span>
            <ArrowRight className="h-3 w-3 text-text-muted" />
            <span className="rounded-full bg-[#44318D] px-3 py-1 font-medium text-text-muted">
              Hours
            </span>
            <ArrowRight className="h-3 w-3 text-text-muted" />
            <span className="rounded-full bg-[#44318D] px-3 py-1 font-medium text-text-muted">
              Link
            </span>
            <ArrowRight className="h-3 w-3 text-text-muted" />
            <span className="rounded-full bg-emerald-900/40 px-3 py-1 font-medium text-emerald-400">
              Booked
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-8 py-6">
          <Link
            href="/dashboard/guide"
            onClick={dismiss}
            className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-white transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Read full guide
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={dismiss}
              className="text-xs text-text-muted hover:text-white transition-colors"
            >
              Skip for now
            </button>
            <Link href="/dashboard/event-types" onClick={dismiss}>
              <Button
                size="sm"
                className="gap-2 bg-accent text-white hover:bg-[#b8306f]"
              >
                Get started
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
