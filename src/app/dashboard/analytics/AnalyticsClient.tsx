"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Calendar, Clock, Users, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, Loader2, RefreshCw, BarChart3,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Overview {
  total: number; confirmed: number; completed: number; cancelled: number;
  pending: number; avgDuration: number; completionRate: number;
  cancellationRate: number; uniqueInvitees: number; allTotal: number;
}
interface SeriesPoint   { date: string; confirmed: number; cancelled: number; completed: number }
interface HourlyPoint   { hour: number; count: number }
interface DowPoint      { day: string; count: number }
interface EventTypeRow  { title: string; color: string; count: number }
interface StatusRow     { status: string; count: number; color: string }
interface AnalyticsData {
  overview:        Overview;
  series:          SeriesPoint[];
  hourly:          HourlyPoint[];
  byDayOfWeek:     DowPoint[];
  byEventType:     EventTypeRow[];
  statusBreakdown: StatusRow[];
  range:           { from: string; to: string };
}

// ─── Preset ranges ─────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "7 days",  days: 7  },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year",  days: 365},
] as const;

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ─── Recharts theme helpers ─────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: "#2A1B3D",
  border: "1px solid #44318D",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
};
const AXIS_TICK_STYLE = { fill: "#A4B3B6", fontSize: 11 };
const GRID_COLOR = "#44318D";

// ─── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, accent, trend, trendLabel,
}: {
  label:       string;
  value:       string | number;
  sub?:        string;
  icon:        React.ElementType;
  accent:      string;
  trend?:      "up" | "down" | "neutral";
  trendLabel?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: "#2A1B3D", border: "1px solid #44318D" }}
    >
      {/* accent glow */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10"
        style={{ background: accent, filter: "blur(20px)" }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#A4B3B6" }}>
          {label}
        </span>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: accent + "22", border: `1px solid ${accent}33` }}
        >
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight text-white">{value}</p>
        {sub && <p className="mt-0.5 text-xs" style={{ color: "#A4B3B6" }}>{sub}</p>}
      </div>
      {trendLabel && (
        <div className="flex items-center gap-1">
          {trend === "up"   && <TrendingUp   className="h-3.5 w-3.5" style={{ color: "#4ade80" }} />}
          {trend === "down" && <TrendingDown  className="h-3.5 w-3.5" style={{ color: "#f87171" }} />}
          <span className="text-xs" style={{ color: trend === "up" ? "#4ade80" : trend === "down" ? "#f87171" : "#A4B3B6" }}>
            {trendLabel}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "#2A1B3D", border: "1px solid #44318D" }}>
      <div className="mb-5">
        <p className="text-sm font-semibold text-white">{title}</p>
        {sub && <p className="mt-0.5 text-xs" style={{ color: "#A4B3B6" }}>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Custom tooltip ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-semibold" style={{ color: "#A4B3B6" }}>{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-xs text-white">
            {p.name}: <strong>{formatter ? formatter(p.value) : p.value}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Donut label ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DonutLabel({ cx, cy, total }: any) {
  return (
    <>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#fff" fontSize={22} fontWeight={700}>{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#A4B3B6" fontSize={11}>total</text>
    </>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────────

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center py-12" style={{ color: "#A4B3B6" }}>
      <BarChart3 className="mb-2 h-8 w-8" />
      <p className="text-xs">No data for this period</p>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function AnalyticsClient() {
  const today    = new Date();
  const [days, setDays]       = useState<7 | 30 | 90 | 365>(30);
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchData = useCallback(async (d: number) => {
    setLoading(true); setError(null);
    try {
      const to   = toDateStr(today);
      const from = toDateStr(new Date(today.getTime() - d * 24 * 60 * 60_000));
      const res  = await fetch(`/api/analytics?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load analytics");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchData(days); }, [days, fetchData]);

  const ov = data?.overview;

  // Format series dates for display — shorten labels when range is large
  const seriesFormatted = (data?.series ?? []).map((p) => ({
    ...p,
    label: days <= 30
      ? new Date(p.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
      : new Date(p.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
  }));

  // Thin the series tick labels to avoid clutter
  const tickEvery = days <= 30 ? 4 : days <= 90 ? 7 : 30;

  // Format hour labels
  const hourlyFormatted = (data?.hourly ?? []).map((p) => ({
    ...p,
    label: p.hour === 0 ? "12am" : p.hour < 12 ? `${p.hour}am` : p.hour === 12 ? "12pm" : `${p.hour - 12}pm`,
  }));

  // Max hourly for bar fill intensity
  const maxHourly = Math.max(...(data?.hourly ?? []).map((h) => h.count), 1);

  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="mt-0.5 text-sm" style={{ color: "#A4B3B6" }}>
            Booking metrics and trends for your account
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Range presets */}
          <div className="flex overflow-hidden rounded-xl" style={{ border: "1px solid #44318D" }}>
            {PRESETS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days as 7 | 30 | 90 | 365)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: days === p.days ? "#D83F87" : "transparent",
                  color:      days === p.days ? "#fff"    : "#A4B3B6",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchData(days)}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-[#44318D] disabled:opacity-50"
            style={{ border: "1px solid #44318D" }}
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} style={{ color: "#A4B3B6" }} />
          </button>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#2a1010", border: "1px solid #3a1a1a", color: "#f87171" }}>
          {error}
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {loading && !data && (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#D83F87" }} />
        </div>
      )}

      {data && (
        <>
          {/* ── Stat cards ───────────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total bookings"
              value={ov!.total}
              sub={`${ov!.allTotal} all-time`}
              icon={Calendar}
              accent="#D83F87"
            />
            <StatCard
              label="Unique guests"
              value={ov!.uniqueInvitees}
              sub="Distinct invitees"
              icon={Users}
              accent="#818cf8"
            />
            <StatCard
              label="Avg duration"
              value={ov!.avgDuration > 0 ? `${ov!.avgDuration}m` : "—"}
              sub="Per meeting"
              icon={Clock}
              accent="#34d399"
            />
            <StatCard
              label="Completion rate"
              value={`${ov!.completionRate}%`}
              sub={`${ov!.cancellationRate}% cancelled`}
              icon={ov!.completionRate >= 70 ? CheckCircle2 : XCircle}
              accent={ov!.completionRate >= 70 ? "#4ade80" : "#f87171"}
              trend={ov!.completionRate >= 70 ? "up" : "down"}
              trendLabel={ov!.completionRate >= 70 ? "Healthy completion" : "High cancellations"}
            />
          </div>

          {/* ── Secondary stats row ──────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl px-5 py-4 flex items-center gap-4"
              style={{ background: "#2A1B3D", border: "1px solid #44318D" }}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "#D83F8722", border: "1px solid #D83F8733" }}>
                <CheckCircle2 className="h-4 w-4" style={{ color: "#D83F87" }} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#A4B3B6" }}>Confirmed</p>
                <p className="text-xl font-bold text-white">{ov!.confirmed}</p>
              </div>
            </div>
            <div className="rounded-2xl px-5 py-4 flex items-center gap-4"
              style={{ background: "#2A1B3D", border: "1px solid #44318D" }}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "#4ade8022", border: "1px solid #4ade8033" }}>
                <TrendingUp className="h-4 w-4" style={{ color: "#4ade80" }} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#A4B3B6" }}>Completed</p>
                <p className="text-xl font-bold text-white">{ov!.completed}</p>
              </div>
            </div>
            <div className="rounded-2xl px-5 py-4 flex items-center gap-4"
              style={{ background: "#2A1B3D", border: "1px solid #44318D" }}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "#f8717122", border: "1px solid #f8717133" }}>
                <XCircle className="h-4 w-4" style={{ color: "#f87171" }} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#A4B3B6" }}>Cancelled</p>
                <p className="text-xl font-bold text-white">{ov!.cancelled}</p>
              </div>
            </div>
          </div>

          {/* ── Bookings over time ──────────────────────────────────────── */}
          <Section
            title="Bookings over time"
            sub={`Bookings received per day — last ${days} days`}
          >
            {ov!.total === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={seriesFormatted} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradConfirmed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#D83F87" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#D83F87" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="gradCancelled" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f87171" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={AXIS_TICK_STYLE}
                    tickLine={false}
                    axisLine={false}
                    interval={tickEvery - 1}
                  />
                  <YAxis
                    tick={AXIS_TICK_STYLE}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: "#A4B3B6", paddingTop: 8 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Area
                    type="monotone"
                    dataKey="confirmed"
                    name="Confirmed"
                    stroke="#D83F87"
                    strokeWidth={2}
                    fill="url(#gradConfirmed)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#D83F87" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cancelled"
                    name="Cancelled"
                    stroke="#f87171"
                    strokeWidth={1.5}
                    fill="url(#gradCancelled)"
                    dot={false}
                    activeDot={{ r: 3, fill: "#f87171" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Section>

          {/* ── Two charts row ──────────────────────────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-2">

            {/* Peak booking hours */}
            <Section
              title="Peak booking hours"
              sub="When guests most often book (UTC)"
            >
              {ov!.total === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={hourlyFormatted} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <CartesianGrid stroke={GRID_COLOR} strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} interval={2} />
                    <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Bookings" radius={[3, 3, 0, 0]}>
                      {hourlyFormatted.map((entry) => (
                        <Cell
                          key={entry.hour}
                          fill={`rgba(196,149,106,${0.2 + 0.8 * (entry.count / maxHourly)})`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Section>

            {/* Status breakdown donut */}
            <Section
              title="Status breakdown"
              sub="Distribution of booking outcomes"
            >
              {data.statusBreakdown.length === 0 ? <EmptyChart /> : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="60%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.statusBreakdown}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        strokeWidth={0}
                        labelLine={false}
                        label={<DonutLabel total={ov!.total} />}
                      >
                        {data.statusBreakdown.map((entry) => (
                          <Cell key={entry.status} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        itemStyle={{ color: "#fff", fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2.5">
                    {data.statusBreakdown.map((s) => (
                      <div key={s.status} className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                        <div>
                          <p className="text-xs font-medium text-white">{s.status}</p>
                          <p className="text-xs" style={{ color: "#A4B3B6" }}>
                            {s.count} · {ov!.total > 0 ? Math.round((s.count / ov!.total) * 100) : 0}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          </div>

          {/* ── Two charts row 2 ────────────────────────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-2">

            {/* Day of week */}
            <Section
              title="Busiest days"
              sub="Bookings by day of the week"
            >
              {ov!.total === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.byDayOfWeek} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <CartesianGrid stroke={GRID_COLOR} strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="day" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                    <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Bookings" fill="#818cf8" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Section>

            {/* Top event types */}
            <Section
              title="Top event types"
              sub="Most booked event types (excluding cancellations)"
            >
              {data.byEventType.length === 0 ? <EmptyChart /> : (
                <div className="space-y-3">
                  {data.byEventType.map((et, i) => {
                    const max = data.byEventType[0].count || 1;
                    const pct = Math.round((et.count / max) * 100);
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: et.color }} />
                            <span className="truncate text-xs font-medium text-white">{et.title}</span>
                          </div>
                          <span className="shrink-0 text-xs tabular-nums" style={{ color: "#A4B3B6" }}>
                            {et.count}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full" style={{ background: "#44318D" }}>
                          <div
                            className="h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: et.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>

          {/* ── Footer note ─────────────────────────────────────────────── */}
          <p className="text-center text-xs" style={{ color: "#A4B3B6" }}>
            Showing data from{" "}
            {new Date(data.range.from).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
            {" "}to{" "}
            {new Date(data.range.to).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
            {" · "}Hourly chart uses UTC
          </p>
        </>
      )}
    </div>
  );
}
