# ScheduleIt — Calendly Clone: Project Task Checkpoints

> Each task is a self-contained checkpoint. Review and approve each one before moving to the next.

---

## TASK 1 — Project Scaffold & Design System ✅
**Status: COMPLETE**

- [x] Initialize Next.js 14 (App Router) + TypeScript
- [x] Configure TailwindCSS with custom color palette (`#37353E`, `#44444E`, `#715A5A`, `#D3DAD9`)
- [x] Install and configure Shadcn UI (Radix UI primitives + CVA)
- [x] Load Arvo font via `next/font/google`
- [x] Set up global layout: sidebar shell, topbar, main content area
- [x] Configure absolute imports, path aliases (`@/*`)
- [x] Set up ESLint + Prettier with tailwind plugin
- [x] Create placeholder pages: `/`, `/dashboard`, `/login` + all sub-pages
- [x] Verify app runs on `localhost:3000` with correct theme

**Deliverable:** ✅ Running app with correct colors, font, and layout shell.

---

## TASK 2 — Database Schema & Prisma Setup ✅
**Status: COMPLETE**

- [x] Connect Neon PostgreSQL via `DATABASE_URL`
- [x] Define all Prisma models:
  - `User`, `Account`, `Session`, `VerificationToken` (NextAuth)
  - `EventType` (with `EventTypeKind` + `LocationType` enums)
  - `Booking` (with `BookingStatus` enum, cancel/reschedule tokens)
  - `Availability`, `AvailabilityOverride`
  - `Team`, `TeamMember` (with `TeamRole` enum)
  - `CalendarIntegration` (with `IntegrationProvider` enum)
  - `AnalyticsSnapshot`
- [x] Run initial migration (`20260309203005_init_schema`)
- [x] Seed script with demo user, availability, 4 event types, 1 booking
- [x] Prisma client singleton at `src/lib/db.ts` using `@prisma/adapter-pg`
- [x] Database schema is in sync — `prisma migrate status` reports up to date

**Deliverable:** ✅ All tables exist in Neon with correct relations, indexes, and seed data.

---

## TASK 3 — Authentication (NextAuth + Google OAuth) ✅
**Status: COMPLETE**

- [x] Install and configure NextAuth with Prisma adapter (`@auth/prisma-adapter`)
- [x] Google OAuth provider setup
- [x] Credentials provider (email + bcrypt password)
- [x] Edge-safe middleware (`src/lib/auth.config.ts` + `src/middleware.ts`) — protects `/dashboard/*`
- [x] Auth session context available globally via `SessionProvider` in `providers.tsx`
- [x] Login page (`/login`) with Google button + email/password form + error handling
- [x] Register page (`/register`) with Google or email/password + auto sign-in
- [x] `POST /api/auth/register` route — creates hashed-password user
- [x] Post-login redirect to `/dashboard`
- [x] JWT strategy, `AUTH_SECRET` configured

**Deliverable:** ✅ Google OAuth + credentials login work, session persists, `/dashboard` redirects unauthenticated users to `/login`.

---

## TASK 4 — User Profile & Settings ✅
**Status: COMPLETE**

- [x] Profile settings page (`/dashboard/settings`) — full client form with live feedback
- [x] Fields: display name, avatar URL, email (read-only), username, timezone selector (50+ IANA zones)
- [x] Real-time username availability check with debounce (`GET /api/user/username-check`)
- [x] Username uniqueness enforced at API level
- [x] Avatar preview from URL; falls back to initials avatar
- [x] Timezone selector with current local time preview
- [x] API routes: `GET /api/user/profile`, `PATCH /api/user/profile` (Zod-validated)
- [x] Public booking URL page at `/{username}` — shows user profile + active event type cards
- [x] `/{username}` returns 404 for unknown usernames

**Deliverable:** ✅ User can update profile; `/{username}` shows the public booking page with event types.

---

## TASK 5 — Availability System ✅
**Status: COMPLETE**

- [x] Availability settings page (`/dashboard/availability`)
- [x] Weekly schedule UI (day + time range per day, toggle on/off)
- [x] Date override UI (mark specific dates unavailable or custom hours)
- [x] API routes:
  - `GET/PUT /api/availability`
  - `GET/POST/DELETE /api/availability/overrides`
- [x] Store in DB (`Availability`, `AvailabilityOverride`)
- [x] Times stored as HH:MM strings in user's profile timezone

**Deliverable:** ✅ User sets working hours; data persists in DB. Date overrides (blocked or custom hours) can be added and removed.

---

## TASK 6 — Event Types (CRUD) ✅
**Status: COMPLETE**

- [x] Event types list page (`/dashboard/event-types`)
- [x] Create/edit form: title, description, duration, location type, buffer time, min notice, slug, max bookings
- [x] Support 4 types: One-on-One, Group, Round Robin, Collective
- [x] API routes:
  - `POST /api/events/create`
  - `PATCH /api/events/update`
  - `DELETE /api/events/delete`
  - `GET /api/events`
- [x] Slug auto-generated from title, user-editable
- [x] Public URL: `/{username}/{slug}`

**Deliverable:** ✅ User can create event types; they appear in the list with share links.

---

## TASK 7 — Scheduling Algorithm & Slot Generation ✅
**Status: COMPLETE**

- [x] `lib/scheduler.ts` — DB-connected orchestrator
  - Loads user availability and overrides for the requested day
  - Converts HH:MM window times to UTC via timezone utilities
  - Loads existing CONFIRMED + PENDING bookings within window ± buffers
  - Delegates slot generation to pure `scheduler-core.ts`
  - Returns available slots as ISO strings
- [x] `lib/scheduler-core.ts` — pure, DB-free `generateSlots()` function
  - Accepts pre-resolved window, duration, buffer, minNotice, bookings
  - Handles buffer zones around existing bookings
  - Respects minimum advance-notice cutoff
- [x] `lib/timezone.ts` — pure Intl-based timezone utilities
  - `localToUtc(dateStr, timeStr, tz)` — full date-aware, handles eastward timezones and DST
  - `getDayOfWeek`, `utcToDateStr`, `utcToTimeStr`
- [x] `src/lib/__tests__/scheduler.test.ts` — 24 unit tests; **24/24 pass**
- [x] API route: `GET /api/slots?eventTypeId=&date=&timezone=` (no auth required)

**Deliverable:** ✅ Given a date and event type, API returns correct available time slots.

---

## TASK 8 — Public Booking Page ✅
**Status: COMPLETE**

- [x] Public booking page (no auth required) at `/{username}/{slug}`
- [x] Step 1: Calendar date picker — custom month grid, past dates disabled, month navigation
- [x] Step 2: Time slot selection — fetched from `GET /api/slots`, loading/empty/error states
- [x] Step 3: Guest form — name (required), email (required), notes (optional)
- [x] Step 4: Confirmation screen — shows date, time range, timezone, host name
- [x] Timezone auto-detected from browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`)
- [x] Step-progress indicator (dot trail) across all 4 steps
- [x] API route: `POST /api/bookings/create`
  - Validates fields with Zod
  - Rejects past slots
  - Conflict check: queries DB for overlapping CONFIRMED/PENDING bookings with same host
  - Creates booking with status `CONFIRMED`
  - Returns `{ bookingId, startTime, endTime }`

**Deliverable:** ✅ A guest can visit the public URL, pick a slot, submit, and see a confirmation.

---

## TASK 9 — Google Calendar Integration
**Goal:** Read calendar events for conflict detection; create events on booking.

- [x] OAuth2 flow to connect Google Calendar (`/dashboard/integrations`)
- [x] Store encrypted OAuth tokens in `CalendarIntegration` (AES-256-GCM)
- [x] On booking: create Google Calendar event with invitee as attendee
- [x] On slot generation: fetch busy times from Google Calendar and exclude them
- [x] Google Meet link auto-generated via Calendar event (set `conferenceData`)
- [x] Token refresh handling
- [x] API routes: `GET /api/integrations/google/connect`, `/callback`, `/disconnect`, `/status`

**Deliverable:** Connecting Google Calendar blocks off busy times and creates events on booking.

---

## TASK 10 — Email Notifications (Gmail API)
**Goal:** Send confirmation, reminder, cancellation, and reschedule emails.

- [x] Gmail API integration (reuse Google OAuth tokens)
- [x] Email templates (HTML):
  - Booking confirmation (host + guest)
  - 1-hour reminder
  - Cancellation notice
  - Reschedule confirmation
- [x] `src/lib/email.ts` — send email wrapper (`sendBookingConfirmationEmails`, `sendCancellationEmails`, `sendRescheduleEmails`, `sendReminderEmail`)
- [x] Trigger on booking create

**Deliverable:** Booking confirmation email sent to both host and guest on every booking.

---

## TASK 11 — Cancellation & Rescheduling ✅
**Goal:** Guests and hosts can cancel or reschedule bookings.

- [x] Cancel booking page (`/cancel?token=`) — `src/app/cancel/page.tsx`
- [x] Reschedule booking page (`/reschedule?token=`) — `src/app/reschedule/page.tsx`
- [x] Unique tokens stored on Booking (`cancelToken`, `rescheduleToken` — `@unique`)
- [x] On cancel: update booking status `CANCELLED`, delete calendar event, send cancellation email
- [x] On reschedule: date+slot picker, update booking + calendar event, send reschedule email
- [x] API routes:
  - `POST /api/bookings/cancel` (host-authenticated)
  - `GET /POST /api/bookings/cancel-token` (public, token-based)
  - `GET /POST /api/bookings/reschedule` (public, token-based)

**Deliverable:** Guest clicks cancel/reschedule link from email and can complete the flow. ✅

---

## TASK 12 — Zoom & Microsoft Teams Integration ✅
**Goal:** Auto-generate Zoom or Teams meeting links on booking.

- [x] Zoom OAuth integration (`/api/integrations/zoom/connect` → `/callback` → `/disconnect`)
- [x] On booking with Zoom location: call Zoom API → return `join_url`, `meeting_id`
- [x] Microsoft Teams: MS Graph API OAuth, create online meeting, return join URL
- [x] Meeting type determined by `EventType.locationType` (ZOOM / TEAMS / GOOGLE_MEET)
- [x] Fallback: Zoom/Teams creation errors are non-fatal; booking proceeds without a link
- [x] Integrations page updated — real Connect/Disconnect buttons for Zoom + Teams

**Deliverable:** Booking with Zoom or Teams location type creates a real meeting and returns a join link. ✅

---

## TASK 13 — Team Scheduling ✅
**Goal:** Teams with shared booking pages, round-robin, and collective events.

- [x] Team creation page (`/dashboard/teams`)
- [x] Add/remove members, assign roles (owner, member)
- [x] Round-robin logic:
  - Select host with fewest bookings in period
  - Random fallback
- [x] Collective event: check all members' availability simultaneously (intersection)
- [x] Team event type public URL: `/team/{teamSlug}/{eventSlug}`
- [x] API routes: `GET/POST /api/teams`, `GET/PATCH/DELETE /api/teams/[teamId]`, `GET/POST/DELETE /api/teams/[teamId]/members`, `GET/POST/DELETE /api/teams/[teamId]/event-types`
- [x] `GET /api/slots/team` — team slot generation
- [x] `POST /api/bookings/create/team` — team booking with RR/collective host assignment

**Deliverable:** A team round-robin booking page distributes meetings across members. ✅

---

## TASK 14 — Analytics Dashboard ✅
**Goal:** Host sees booking metrics and charts on the dashboard.

- [x] Analytics page (`/dashboard/analytics`)
- [x] Metrics: total events created, completed, rescheduled, cancelled
- [x] Charts (Recharts):
  - Bookings over time (area chart with confirmed/cancelled)
  - Popular meeting times (hourly bar chart)
  - Status breakdown (donut pie chart)
  - Top event types (progress bar list)
  - Busiest days (day-of-week bar chart)
- [x] Date range filter (7d / 30d / 90d / 1y presets)
- [x] API route: `GET /api/analytics?from=&to=`

**Deliverable:** Dashboard shows real charts populated from actual booking data.

---

## TASK 15 — Background Jobs (Upstash Redis) ⏭️ Skipped
**Decision:** Skipped in favour of a lightweight inline auto-complete.
`src/lib/autoComplete.ts` flips `CONFIRMED` bookings with `endTime < now` to `COMPLETED` on each page load — no Redis or QStash dependency needed.

- [~] Upstash Redis + QStash setup — **skipped**
- [x] Post-meeting status update → `autoCompleteExpiredBookings()` called in bookings page + analytics route

---

