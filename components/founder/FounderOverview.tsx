"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardToast } from "@/components/dashboard/DashboardToast";
import { authFetch } from "@/lib/auth-fetch";
import type { FounderDashboardData } from "@/lib/founder-types";
import { RestaurantsTab } from "./tabs/RestaurantsTab";
import { AnalyticsTab } from "./tabs/AnalyticsTab";
import { KontakteTab } from "./tabs/KontakteTab";
import { TodoTab } from "./tabs/TodoTab";
import { ProduktTabV2 } from "./tabs/ProduktTabV2";

type Tab = "overview" | "restaurants" | "analytics" | "pipeline" | "todo" | "produkte" | "einstellungen";

const NAV_ITEMS = [
  { kind: "tab" as const, key: "overview", label: "Übersicht", icon: "fa-solid fa-house" },
  { kind: "tab" as const, key: "restaurants", label: "Restaurants", icon: "fa-solid fa-store" },
  { kind: "tab" as const, key: "analytics", label: "Analytics", icon: "fa-solid fa-chart-line" },
  { kind: "tab" as const, key: "pipeline", label: "Pipeline", icon: "fa-solid fa-people-arrows" },
  { kind: "tab" as const, key: "todo", label: "To-Do", icon: "fa-solid fa-list-check" },
  { kind: "tab" as const, key: "produkte", label: "Produkte", icon: "fa-solid fa-box" },
  { kind: "tab" as const, key: "einstellungen", label: "Einstellungen", icon: "fa-solid fa-gear" },
];

const CHART_W = 720;
const CHART_H = 160;

function buildYScale(maxValue: number): { max: number; stops: number[] } {
  const m = Math.max(maxValue, 1);
  const candidates = [10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const max = candidates.find((c) => c >= m) ?? Math.ceil(m / 100) * 100;
  return { max, stops: [max, Math.round((max * 2) / 3), Math.round(max / 3), 0] };
}

function buildSmoothPath(values: number[], max: number, w: number, h: number): { line: string; area: string } {
  const n = values.length;
  if (n === 0) return { line: "", area: "" };
  const padBottom = 18;
  const usableH = h - padBottom - 6;
  const stepX = w / Math.max(1, n - 1);
  const pts = values.map((v, i) => ({
    x: i * stepX,
    y: 6 + (1 - Math.min(1, v / max)) * usableH,
  }));
  if (pts.length === 1) {
    const p = pts[0];
    return { line: `M ${p.x} ${p.y}`, area: `M ${p.x} ${p.y} L ${p.x} ${h - padBottom} Z` };
  }
  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return { line, area: `${line} L ${pts[pts.length - 1].x} ${h - padBottom} L ${pts[0].x} ${h - padBottom} Z` };
}

type Props = {
  data: FounderDashboardData;
  initialLoadError?: string | null;
};

export function FounderOverview({ data, initialLoadError }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [restaurants, setRestaurants] = useState(data.restaurants);
  const [toast, setToast] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const liveRestaurants = useMemo(
    () => restaurants.filter((r) => r.aktiv === true && r.published !== false),
    [restaurants],
  );
  const pendingRestaurants = useMemo(
    () => restaurants.filter((r) => r.published === false),
    [restaurants],
  );

  // Sessions aus restaurant_analytics_daily aggregieren. Diese Tabelle
  // wird nightly per Cron befüllt und ist die authoritative Quelle für
  // tagesgenaue Aggregate (Berlin-Zeitzone).
  function todayBerlinIso(): string {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
  function shiftIso(iso: string, deltaDays: number): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + deltaDays);
    return d.toISOString().slice(0, 10);
  }

  const sessionsByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data.analyticsDaily30d) {
      m.set(r.day_berlin, (m.get(r.day_berlin) ?? 0) + (r.sessions_count ?? 0));
    }
    return m;
  }, [data.analyticsDaily30d]);

  const todayIso = todayBerlinIso();

  const sessionsToday = sessionsByDay.get(todayIso) ?? 0;

  // Diese Woche = letzte 7 Tage inkl. heute (rolling).
  const sessionsWeek = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      sum += sessionsByDay.get(shiftIso(todayIso, -i)) ?? 0;
    }
    return sum;
  }, [sessionsByDay, todayIso]);

  // 30-Tage-Series aus dem gleichen Daily-Aggregat.
  const series30 = useMemo(() => {
    const out: { label: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const iso = shiftIso(todayIso, -i);
      const [, m, d] = iso.split("-");
      out.push({
        label: `${parseInt(d, 10)}.${parseInt(m, 10)}.`,
        count: sessionsByDay.get(iso) ?? 0,
      });
    }
    return out;
  }, [sessionsByDay, todayIso]);

  const monthTotal = series30.reduce((a, b) => a + b.count, 0);
  const { max: yMax, stops: yStops } = buildYScale(Math.max(0, ...series30.map((s) => s.count)));
  const { line: chartLine, area: chartArea } = buildSmoothPath(
    series30.map((s) => s.count),
    yMax,
    CHART_W,
    CHART_H,
  );

  // Scans heute pro Restaurant — aus analyticsDaily30d gefiltert auf heute (Berlin).
  const scansTodayByRestaurant = useMemo(() => {
    const out = new Map<string, number>();
    for (const r of data.analyticsDaily30d) {
      if (r.day_berlin !== todayIso) continue;
      out.set(r.restaurant_id, (out.get(r.restaurant_id) ?? 0) + (r.sessions_count ?? 0));
    }
    return out;
  }, [data.analyticsDaily30d, todayIso]);

  // Scans pro Restaurant über die letzten 7 Tage — wird an die alte
  // RestaurantsTab als `sessionsWeekOverride` durchgereicht, damit die
  // "Scans/Wo"-Spalte korrekt aus dem Daily-Aggregat statt aus dem
  // gedeckelten scan_events-Window kommt.
  const sessionsWeekByRestaurant = useMemo(() => {
    const out = new Map<string, number>();
    for (const r of data.analyticsDaily30d) {
      const inRange = (() => {
        for (let i = 0; i < 7; i++) {
          if (r.day_berlin === shiftIso(todayIso, -i)) return true;
        }
        return false;
      })();
      if (!inRange) continue;
      out.set(r.restaurant_id, (out.get(r.restaurant_id) ?? 0) + (r.sessions_count ?? 0));
    }
    return out;
  }, [data.analyticsDaily30d, todayIso]);

  // Neue Registrierungen letzte 7 Tage
  const newLast7Days = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return restaurants.filter((r) => {
      const created = r.created_at ? new Date(r.created_at).getTime() : 0;
      return created > cutoff;
    }).length;
  }, [restaurants]);

  // Revenue-Potenzial: aktive Restaurants × 1500 Scans × CPM 40 € / 1000
  const revenuePotential = liveRestaurants.length * 1500 * (40 / 1000);

  async function handlePublish(restaurantId: string) {
    if (publishingId) return;
    setPublishingId(restaurantId);
    try {
      const res = await authFetch("/api/founder/publish-restaurant", {
        method: "POST",
        body: JSON.stringify({ restaurantId }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; alreadyPublished?: boolean; slug?: string }
        | null;
      if (!res.ok || !json?.ok) {
        setToast(json?.error ?? "Freischalten fehlgeschlagen");
        return;
      }
      setRestaurants((prev) =>
        prev.map((r) => (r.id === restaurantId ? { ...r, published: true, status: "live" } : r)),
      );
      setToast(json.alreadyPublished ? "✓ War schon freigeschaltet" : "✓ Restaurant freigeschaltet");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Freischalten fehlgeschlagen");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <DashboardShell
      variant="founder"
      activeTab={tab}
      onTabChange={(next) => setTab(next as Tab)}
      navItems={NAV_ITEMS}
      hideManageSection
      hideAiCta
      title="Founder"
      avatarLabel="F"
    >
      <div className="mx-auto w-full max-w-[1200px] px-5 pb-16 pt-6 md:px-8 md:pt-8">
        {initialLoadError ? (
          <div
            className="mb-4 rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: "rgba(248,113,113,0.4)",
              background: "rgba(248,113,113,0.1)",
              color: "#f87171",
            }}
            role="status"
          >
            {initialLoadError}
          </div>
        ) : null}

        {tab === "overview" ? (
          <div className="space-y-4">
            <header className="mb-2">
              <h2 className="qrave-font-display text-[22px] font-black leading-tight tracking-tight">
                Founder-<span style={{ color: "var(--qrave-accent-strong)" }}>Übersicht</span>
              </h2>
              <p className="mt-1 text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                {liveRestaurants.length} aktive Restaurants · {pendingRestaurants.length} pending
              </p>
            </header>

            {/* 4 Hero-Stat-Karten */}
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
              <HeroStatCard
                label="Aktive Restaurants"
                value={liveRestaurants.length.toLocaleString("de-DE")}
                sub={`${restaurants.length} gesamt`}
              />
              <StatCard
                label="Scans heute"
                value={sessionsToday.toLocaleString("de-DE")}
                sub="alle Restaurants"
                icon="fa-solid fa-arrow-up-right"
              />
              <StatCard
                label="Diese Woche"
                value={sessionsWeek.toLocaleString("de-DE")}
                sub="Mo–So"
                icon="fa-solid fa-calendar-week"
              />
              <StatCard
                label="Registrierungen"
                value={(pendingRestaurants.length + newLast7Days - pendingRestaurants.length).toLocaleString("de-DE")}
                sub={`${pendingRestaurants.length} pending · ${newLast7Days} in 7 T.`}
                icon="fa-solid fa-user-plus"
                accent={pendingRestaurants.length > 0}
              />
            </section>

            {/* Chart 30 Tage */}
            <section>
              <Card>
                <div className="mb-2 flex items-baseline justify-between">
                  <div>
                    <div className="text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                      Scans · letzte 30 Tage
                    </div>
                    <div className="qrave-font-display mt-1 text-[36px] font-black leading-none tracking-[-2px]">
                      {monthTotal.toLocaleString("de-DE")}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2.5">
                  <div className="flex flex-col justify-between pb-5">
                    {yStops.map((s, i) => (
                      <div key={`${s}-${i}`} className="w-9 text-right text-[11px] font-medium" style={{ color: "rgba(242,242,242,0.5)" }}>
                        {s}
                      </div>
                    ))}
                  </div>
                  <div className="relative h-[180px] flex-1">
                    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
                      <defs>
                        <linearGradient id="founder-chart-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--qrave-accent)" stopOpacity="0.32" />
                          <stop offset="100%" stopColor="var(--qrave-accent)" stopOpacity="0" />
                        </linearGradient>
                        <filter id="founder-chart-glow">
                          <feGaussianBlur stdDeviation="3" result="b" />
                          <feMerge>
                            <feMergeNode in="b" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      {yStops.map((_, i) => {
                        const y = (i / (yStops.length - 1)) * (CHART_H - 18) + 6;
                        return <line key={i} x1="0" y1={y} x2={CHART_W} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />;
                      })}
                      <path d={chartArea} fill="url(#founder-chart-fill)" />
                      <path
                        d={chartLine}
                        fill="none"
                        stroke="var(--qrave-accent)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#founder-chart-glow)"
                      />
                      {series30.map((s, i) => {
                        if (i % 5 !== 0 && i !== series30.length - 1) return null;
                        const stepX = CHART_W / Math.max(1, series30.length - 1);
                        const x = Math.min(CHART_W - 22, Math.max(0, i * stepX));
                        return (
                          <text key={`${s.label}-${i}`} x={x} y={CHART_H - 2} fill="rgba(242,242,242,0.5)" fontSize="11" fontFamily="DM Sans">
                            {s.label}
                          </text>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </Card>
            </section>

            {/* Pending + Revenue */}
            <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <div className="qrave-font-display text-[14px] font-bold">
                    Pending-Registrierungen
                    <span className="ml-2 text-[12px] font-normal" style={{ color: "rgba(242,242,242,0.5)" }}>
                      {pendingRestaurants.length}
                    </span>
                  </div>
                </div>
                {pendingRestaurants.length === 0 ? (
                  <p className="text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                    Keine offenen Registrierungen.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {pendingRestaurants.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 rounded-[12px] border px-3.5 py-2.5"
                        style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold">{r.name}</div>
                          <div className="truncate text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                            qrave.menu/{r.slug} · {r.email ?? "—"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handlePublish(r.id)}
                          disabled={publishingId === r.id}
                          className="rounded-[8px] px-3 py-1.5 text-[12px] font-bold transition disabled:opacity-50"
                          style={{
                            background: "var(--qrave-accent-gradient)",
                            color: "#fff",
                            boxShadow: "0 6px 20px rgba(29,78,216,0.4)",
                          }}
                        >
                          {publishingId === r.id ? "Schalte frei …" : "Freischalten"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <div className="qrave-font-display mb-1 text-[14px] font-bold">Revenue-Potenzial</div>
                <p className="text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                  Geschätzte monatliche Reichweite
                </p>
                <div className="qrave-font-display mt-3 text-[32px] font-black tracking-[-1.5px]" style={{ color: "var(--qrave-accent-soft)" }}>
                  {revenuePotential.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "rgba(242,242,242,0.5)" }}>
                  {liveRestaurants.length} Restaurants · Ø 1.500 Scans/Monat · CPM 40 €
                </p>
              </Card>
            </section>

            {/* Restaurants-Liste */}
            <section>
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <div className="qrave-font-display text-[14px] font-bold">Alle Restaurants</div>
                  <button
                    type="button"
                    onClick={() => setTab("restaurants")}
                    className="text-[12px] font-medium"
                    style={{ color: "color-mix(in srgb, var(--qrave-accent) 75%, white)" }}
                  >
                    Detail-Ansicht →
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {restaurants.slice(0, 12).map((r) => {
                    const isLive = r.aktiv === true && r.published !== false;
                    const scansToday = scansTodayByRestaurant.get(r.id) ?? 0;
                    return (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 rounded-[11px] border px-3.5 py-2.5"
                        style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}
                      >
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[10px] font-bold uppercase tracking-wider"
                          style={
                            isLive
                              ? {
                                  background: "rgba(74,222,128,0.12)",
                                  border: "1px solid rgba(74,222,128,0.25)",
                                  color: "#4ade80",
                                }
                              : {
                                  background: "rgba(251,146,60,0.12)",
                                  border: "1px solid rgba(251,146,60,0.25)",
                                  color: "#fb923c",
                                }
                          }
                        >
                          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: isLive ? "#4ade80" : "#fb923c" }} />
                          {isLive ? "live" : "pending"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold">{r.name}</div>
                          <Link
                            href={`https://qrave.menu/${r.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-[11px]"
                            style={{ color: "rgba(242,242,242,0.5)" }}
                          >
                            qrave.menu/{r.slug} ↗
                          </Link>
                        </div>
                        <div className="text-right">
                          <div className="qrave-font-display text-[14px] font-bold">
                            {scansToday.toLocaleString("de-DE")}
                          </div>
                          <div className="text-[10px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                            heute
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          </div>
        ) : null}

        {tab === "restaurants" ? (
          <RestaurantsTab
            restaurants={restaurants}
            scanEvents={data.scanEvents}
            restaurantExtras={data.restaurantExtras}
            restaurantTables={data.restaurantTables}
            isMobile={false}
            onRefresh={async () => undefined}
            sessionsWeekOverride={sessionsWeekByRestaurant}
          />
        ) : null}

        {tab === "analytics" ? (
          <AnalyticsTab data={data} isTablet={false} isDesktop={true} />
        ) : null}

        {tab === "pipeline" ? (
          <KontakteTab isMobile={false} onRefresh={async () => undefined} />
        ) : null}

        {tab === "todo" ? (
          <TodoTab isMobile={false} onRefresh={async () => undefined} todos={data.todos} />
        ) : null}

        {tab === "produkte" ? (
          <ProduktTabV2
            restaurants={restaurants}
            analyticsDaily30d={data.analyticsDaily30d}
            allMenuItems={data.allMenuItems}
          />
        ) : null}

        {tab === "einstellungen" ? (
          <Card>
            <div className="qrave-font-display mb-2 text-[16px] font-bold">Founder-Einstellungen</div>
            <p className="text-[13px]" style={{ color: "rgba(242,242,242,0.5)" }}>
              Noch keine Einstellungen verfügbar. Diese Seite wird in einer späteren Phase mit
              ENV-Status, Cron-Übersicht und Admin-Tools erweitert.
            </p>
          </Card>
        ) : null}
      </div>

      <DashboardToast message={toast} onHide={() => setToast(null)} />
    </DashboardShell>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-[16px] p-[22px] transition"
      style={{ background: "var(--qrave-dash-surface)", border: "1px solid var(--qrave-dash-border)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-[15%] right-[15%] top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function HeroStatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-[14px] px-[22px] py-[20px]"
      style={{
        background: "var(--qrave-hero-gradient)",
        border: "1px solid color-mix(in srgb, var(--qrave-accent) 30%, transparent)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-[20%] right-[20%] top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute h-[130px] w-[130px]"
        style={{
          top: -30,
          right: -30,
          background: "radial-gradient(circle, color-mix(in srgb, var(--qrave-accent) 45%, transparent) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-[8px] border"
        style={{
          background: "color-mix(in srgb, var(--qrave-accent) 20%, transparent)",
          borderColor: "color-mix(in srgb, var(--qrave-accent) 30%, transparent)",
          color: "var(--qrave-accent-strong)",
        }}
      >
        <i className="fa-solid fa-store text-[11px]" />
      </div>
      <div className="mb-[10px] text-[11px] font-medium uppercase tracking-[0.3px]" style={{ color: "rgba(191,219,254,0.6)" }}>
        {label}
      </div>
      <div className="qrave-font-display font-black leading-none" style={{ fontSize: 44, letterSpacing: "-2px", color: "var(--qrave-accent-soft)", marginBottom: 8 }}>
        {value}
      </div>
      <div className="text-[11px]" style={{ color: "rgba(191,219,254,0.7)" }}>
        {sub}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[14px] px-[22px] py-[20px]"
      style={{ background: "var(--qrave-dash-surface)", border: "1px solid var(--qrave-dash-border)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-[20%] right-[20%] top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)" }}
      />
      <div
        className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-[8px] border"
        style={{
          background: "rgba(255,255,255,0.06)",
          borderColor: "rgba(255,255,255,0.08)",
          color: accent ? "#fb923c" : "rgba(242,242,242,0.5)",
        }}
      >
        <i className={`${icon} text-[11px]`} />
      </div>
      <div className="mb-[10px] text-[11px] font-medium uppercase tracking-[0.3px]" style={{ color: "rgba(242,242,242,0.5)" }}>
        {label}
      </div>
      <div className="qrave-font-display font-black leading-none" style={{ fontSize: 30, letterSpacing: "-1.5px", color: "#f2f2f2", marginBottom: 8 }}>
        {value}
      </div>
      <div className="text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
        {sub}
      </div>
    </div>
  );
}
