"use client";

import { useMemo } from "react";
import type { DailyPush, MenuItem } from "@/lib/supabase";
import type { KarteSub } from "../types";
import type { HourBuckets } from "@/hooks/useAnalytics";
import type { PeakRow } from "../analytics";
import { formatDateLongDe, greetingLabel } from "../utils";

type Props = {
  userFirstName: string;
  restaurantName: string;
  viewsToday: number | null;
  viewsYesterday: number | null;
  weekSeries: number[];
  monthTotal: number;
  topItemsWeek: { name: string; count: number; views: number }[];
  menuItems: MenuItem[];
  peaksToday: PeakRow[];
  hourBuckets: HourBuckets;
  dailyPushes: DailyPush[];
  activeLanguagesCount: number;
  onGoKarte: (sub: KarteSub) => void;
  onOpenSettings: () => void;
};

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;
const CHART_W = 560;
const CHART_H = 145;

/** Bestimmt eine sinnvolle Y-Achsen-Skala (max + 4 Stops in 25er/50er/100er-Schritten). */
function buildYScale(maxValue: number): { max: number; stops: number[] } {
  const m = Math.max(maxValue, 1);
  // Aufrunden auf die nächste sinnvolle "schöne" Zahl.
  const candidates = [4, 8, 10, 20, 40, 60, 80, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000];
  const max = candidates.find((c) => c >= m) ?? Math.ceil(m / 100) * 100;
  return { max, stops: [max, Math.round((max * 2) / 3), Math.round(max / 3), 0] };
}

/** Catmull-Rom-Approximation als Cubic-Bezier — gibt eine geschmeidige Kurve. */
function buildSmoothPath(values: number[], max: number, w: number, h: number, padBottom: number): { line: string; area: string } {
  const n = values.length;
  if (n === 0) return { line: "", area: "" };
  const stepX = w / Math.max(1, n - 1);
  const usableH = h - padBottom - 6;
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
  const last = pts[pts.length - 1];
  const first = pts[0];
  const area = `${line} L ${last.x} ${h - padBottom} L ${first.x} ${h - padBottom} Z`;
  return { line, area };
}

function categoryOf(item: MenuItem | undefined): string {
  if (!item) return "—";
  return item.kategorie?.trim() || "—";
}

function deltaPct(today: number | null, yesterday: number | null): { pct: number | null; trend: "up" | "down" | "flat" } {
  if (today == null || yesterday == null || yesterday === 0) {
    return { pct: null, trend: "flat" };
  }
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return { pct, trend: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

export function HomeTab({
  userFirstName,
  restaurantName,
  viewsToday,
  viewsYesterday,
  weekSeries,
  monthTotal,
  topItemsWeek,
  menuItems,
  peaksToday,
  hourBuckets,
  dailyPushes,
  activeLanguagesCount,
  onGoKarte,
  onOpenSettings,
}: Props) {
  const vt = viewsToday ?? 0;
  const weekTotal = weekSeries.reduce((a, b) => a + b, 0);
  const todayDelta = deltaPct(viewsToday, viewsYesterday);

  const nameToItem = useMemo(() => {
    const m = new Map<string, MenuItem>();
    for (const it of menuItems) m.set(it.name, it);
    return m;
  }, [menuItems]);

  const topItem = topItemsWeek[0] ?? null;

  const { max: yMax, stops: yStops } = useMemo(
    () => buildYScale(Math.max(0, ...(weekSeries.length ? weekSeries : [0]))),
    [weekSeries],
  );
  const series = weekSeries.length ? weekSeries : [0, 0, 0, 0, 0, 0, 0];
  const { line: chartLine, area: chartArea } = useMemo(
    () => buildSmoothPath(series, yMax, CHART_W, CHART_H, 16),
    [series, yMax],
  );

  const soldOutCount = menuItems.filter((m) => m.sold_out).length;
  const primaryDailyPush = dailyPushes[0] ?? null;

  // Peak-Buckets als Anteil vom Maximum (für Bar-Breite).
  const peakMax = Math.max(
    hourBuckets.morning,
    hourBuckets.midday,
    hourBuckets.evening,
    hourBuckets.night,
    1,
  );
  const peakRows = [
    {
      key: "morning" as const,
      label: "8–12 Uhr",
      sub: "Morgens",
      icon: "fa-solid fa-sun",
      tone: "blue" as const,
      count: hourBuckets.morning,
    },
    {
      key: "midday" as const,
      label: "12–15 Uhr",
      sub: "Mittags",
      icon: "fa-solid fa-fire",
      tone: "purple" as const,
      count: hourBuckets.midday,
    },
    {
      key: "evening" as const,
      label: "17–21 Uhr",
      sub: "Abends",
      icon: "fa-solid fa-fire",
      tone: "purple" as const,
      count: hourBuckets.evening,
    },
    {
      key: "night" as const,
      label: "21–24 Uhr",
      sub: "Nachts",
      icon: "fa-solid fa-moon",
      tone: "blue" as const,
      count: hourBuckets.night,
    },
  ];

  return (
    <div className="space-y-4">
      <header className="mb-2">
        <h2 className="qrave-font-display text-[22px] font-black leading-tight tracking-tight">
          Guten {greetingLabel()},{" "}
          <span style={{ color: "var(--qrave-accent-strong)" }}>{restaurantName || userFirstName}</span>
        </h2>
        <div className="mt-1 text-[12px]" style={{ color: "rgba(242,242,242,0.32)" }}>
          {formatDateLongDe()}
        </div>
      </header>

      {/* STAT-KARTEN */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <StatCard
          variant="hero"
          label="Aufrufe heute"
          valueLarge={vt.toLocaleString("de-DE")}
          delta={
            todayDelta.pct == null ? null : `${todayDelta.pct > 0 ? "+" : ""}${todayDelta.pct}% vs. gestern`
          }
          deltaTrend={todayDelta.trend}
        />
        <StatCard
          label="Diese Woche"
          valueLarge={weekTotal.toLocaleString("de-DE")}
          delta={null}
        />
        <StatCard
          label="Dieser Monat"
          valueLarge={monthTotal.toLocaleString("de-DE")}
          delta={null}
        />
        <StatCard
          label="Top Gericht"
          valueText={topItem?.name ?? "—"}
          delta={topItem ? `${topItem.count} Aufrufe` : "Noch keine Daten"}
          icon="fa-solid fa-fire"
          iconColor="#fb923c"
        />
      </section>

      {/* MAIN GRID: Line Chart + Top Gerichte */}
      <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px]" style={{ color: "rgba(242,242,242,0.3)" }}>
                Scans diese Woche
              </div>
              <div className="mt-1 flex items-center gap-2.5">
                <div className="qrave-font-display text-[36px] font-black leading-none tracking-[-2px]">
                  {weekTotal.toLocaleString("de-DE")}
                </div>
                {todayDelta.pct != null ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11px] font-semibold"
                    style={{
                      background: todayDelta.trend === "up" ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                      color: todayDelta.trend === "up" ? "#4ade80" : "#f87171",
                      border: `1px solid ${todayDelta.trend === "up" ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
                    }}
                  >
                    <i className={`fa-solid fa-arrow-${todayDelta.trend === "up" ? "up" : "down"} text-[10px]`} />
                    {todayDelta.pct > 0 ? "+" : ""}{todayDelta.pct}%
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <div className="flex flex-col justify-between pb-4">
              {yStops.map((s) => (
                <div
                  key={s}
                  className="w-7 text-right text-[9px]"
                  style={{ color: "rgba(242,242,242,0.22)" }}
                >
                  {s}
                </div>
              ))}
            </div>
            <div className="relative h-[160px] flex-1">
              <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="qrave-chart-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--qrave-accent)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="var(--qrave-accent)" stopOpacity="0" />
                  </linearGradient>
                  <filter id="qrave-chart-glow">
                    <feGaussianBlur stdDeviation="3" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {/* Gridlines */}
                {yStops.map((_, i) => {
                  const y = (i / (yStops.length - 1)) * (CHART_H - 16) + 6;
                  return (
                    <line
                      key={i}
                      x1="0"
                      y1={y}
                      x2={CHART_W}
                      y2={y}
                      stroke="rgba(255,255,255,0.04)"
                      strokeWidth="1"
                    />
                  );
                })}
                <path d={chartArea} fill="url(#qrave-chart-fill)" />
                <path
                  d={chartLine}
                  fill="none"
                  stroke="var(--qrave-accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#qrave-chart-glow)"
                />
                {series.map((v, i) => {
                  const stepX = CHART_W / Math.max(1, series.length - 1);
                  const x = i * stepX;
                  const usableH = CHART_H - 16 - 6;
                  const y = 6 + (1 - Math.min(1, v / yMax)) * usableH;
                  const isLast = i === series.length - 1;
                  return (
                    <g key={i}>
                      {isLast ? (
                        <>
                          <circle cx={x} cy={y} r={9} fill="rgba(147,51,234,0.18)" />
                          <circle cx={x} cy={y} r={5} fill="var(--qrave-accent)" filter="url(#qrave-chart-glow)" />
                        </>
                      ) : null}
                    </g>
                  );
                })}
                {WEEKDAY_LABELS.map((label, i) => {
                  const stepX = CHART_W / Math.max(1, WEEKDAY_LABELS.length - 1);
                  const x = Math.min(CHART_W - 14, Math.max(0, i * stepX));
                  return (
                    <text
                      key={label}
                      x={x}
                      y={CHART_H - 2}
                      fill="rgba(242,242,242,0.22)"
                      fontSize="9"
                      fontFamily="DM Sans"
                    >
                      {label}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-start justify-between">
            <div className="qrave-font-display text-[14px] font-bold">Top Gerichte</div>
            <button
              type="button"
              onClick={() => onGoKarte("menu")}
              className="text-[12px] font-medium"
              style={{ color: "color-mix(in srgb, var(--qrave-accent) 75%, white)" }}
            >
              Alle ansehen
            </button>
          </div>
          {topItemsWeek.length === 0 ? (
            <p className="text-[12px]" style={{ color: "rgba(242,242,242,0.4)" }}>
              Noch keine Daten dieser Woche.
            </p>
          ) : (
            topItemsWeek.slice(0, 5).map((row, i) => (
              <div
                key={`${row.name}-${i}`}
                className="flex items-center gap-3 border-b py-2.5 last:border-b-0 last:pb-0"
                style={{ borderColor: "rgba(255,255,255,0.05)" }}
              >
                <span
                  className="qrave-font-display w-4 text-[11px] font-bold"
                  style={{ color: "rgba(242,242,242,0.2)" }}
                >
                  #{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-[13px] font-medium">{row.name}</div>
                  <div className="text-[10px]" style={{ color: "rgba(242,242,242,0.28)" }}>
                    {categoryOf(nameToItem.get(row.name))}
                  </div>
                </div>
                <div
                  className="qrave-font-display text-[13px] font-bold"
                  style={{ color: "rgba(242,242,242,0.58)" }}
                >
                  {row.count}
                </div>
              </div>
            ))
          )}
        </Card>
      </section>

      {/* BOTTOM: Schnellzugriff + Peak-Zeiten */}
      <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card>
          <div className="mb-4 qrave-font-display text-[14px] font-bold">Schnellzugriff</div>
          <QuickAction
            icon="fa-solid fa-star"
            tone="purple"
            title="Tages-Special setzen"
            sub={primaryDailyPush ? `${primaryDailyPush.item_emoji} ${primaryDailyPush.item_name}` : "Noch nicht gesetzt"}
            onClick={() => onGoKarte("heute")}
          />
          <QuickAction
            icon="fa-solid fa-pen-to-square"
            tone="green"
            title="Gäste-Notiz"
            sub="Hinweis für heute setzen"
            onClick={() => onGoKarte("notiz")}
          />
          <QuickAction
            icon="fa-solid fa-ban"
            tone="orange"
            title="Ausverkauft markieren"
            sub={`${soldOutCount} ${soldOutCount === 1 ? "Gericht" : "Gerichte"} ausverkauft`}
            onClick={() => onGoKarte("menu")}
          />
          <QuickAction
            icon="fa-solid fa-language"
            tone="blue"
            title="Speisekarte übersetzen"
            sub={`${activeLanguagesCount} von 7 Sprachen aktiv`}
            onClick={onOpenSettings}
          />
        </Card>

        <Card>
          <div className="mb-5 qrave-font-display text-[14px] font-bold">Peak-Zeiten heute</div>
          {peakRows.map((p) => {
            const width = Math.max(2, Math.round((p.count / peakMax) * 100));
            const isHi = p.count > 0 && p.count >= peakMax * 0.7;
            return (
              <div key={p.key} className="mb-3.5 flex items-center gap-3 last:mb-0">
                <div
                  className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px]"
                  style={{
                    background:
                      p.tone === "purple"
                        ? "rgba(147,51,234,0.18)"
                        : "rgba(59,130,246,0.12)",
                  }}
                >
                  <i
                    className={p.icon}
                    style={{
                      color: p.tone === "purple" ? "#a855f7" : "#60a5fa",
                      fontSize: 12,
                    }}
                  />
                </div>
                <div className="w-[90px] shrink-0">
                  <div
                    className="text-[12px] font-medium leading-tight"
                    style={{ color: isHi ? "var(--qrave-accent-soft)" : undefined }}
                  >
                    {p.label}
                  </div>
                  <div className="text-[10px]" style={{ color: "rgba(242,242,242,0.28)" }}>
                    {p.sub}
                  </div>
                </div>
                <div className="flex-1">
                  <div
                    className="h-[6px] overflow-hidden rounded-[3px]"
                    style={{ background: "rgba(255,255,255,0.07)" }}
                  >
                    <div
                      className="h-full rounded-[3px] transition-[width] duration-300"
                      style={{
                        width: `${width}%`,
                        background: isHi
                          ? "linear-gradient(90deg, #9333ea, #a855f7)"
                          : "linear-gradient(90deg, #7c3aed, #9333ea)",
                        boxShadow: isHi ? "0 0 8px rgba(147,51,234,0.5)" : undefined,
                      }}
                    />
                  </div>
                </div>
                <div
                  className="qrave-font-display w-[30px] shrink-0 text-right text-[13px] font-bold"
                  style={{ color: isHi ? "var(--qrave-accent-soft)" : "rgba(242,242,242,0.55)" }}
                >
                  {p.count}
                </div>
              </div>
            );
          })}
        </Card>
      </section>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-[16px] p-[22px] transition"
      style={{
        background: "var(--qrave-dash-surface)",
        border: "1px solid var(--qrave-dash-border)",
      }}
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

function StatCard({
  variant,
  label,
  valueLarge,
  valueText,
  delta,
  deltaTrend,
  icon,
  iconColor,
}: {
  variant?: "hero";
  label: string;
  valueLarge?: string;
  valueText?: string;
  delta: string | null;
  deltaTrend?: "up" | "down" | "flat";
  icon?: string;
  iconColor?: string;
}) {
  const isHero = variant === "hero";
  return (
    <div
      className="relative overflow-hidden rounded-[14px] px-[22px] py-[20px] transition"
      style={
        isHero
          ? {
              background: "var(--qrave-hero-gradient)",
              border: "1px solid color-mix(in srgb, var(--qrave-accent) 30%, transparent)",
            }
          : {
              background: "var(--qrave-dash-surface)",
              border: "1px solid var(--qrave-dash-border)",
            }
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-[20%] right-[20%] top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)" }}
      />
      {isHero ? (
        <div
          aria-hidden
          className="pointer-events-none absolute h-[130px] w-[130px]"
          style={{
            top: -30,
            right: -30,
            background: "radial-gradient(circle, color-mix(in srgb, var(--qrave-accent) 45%, transparent) 0%, transparent 70%)",
          }}
        />
      ) : null}
      <div className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-[8px] border"
        style={
          isHero
            ? {
                background: "color-mix(in srgb, var(--qrave-accent) 20%, transparent)",
                borderColor: "color-mix(in srgb, var(--qrave-accent) 30%, transparent)",
                color: "var(--qrave-accent-strong)",
                fontSize: 11,
              }
            : {
                background: "rgba(255,255,255,0.06)",
                borderColor: "rgba(255,255,255,0.08)",
                color: iconColor ?? "rgba(242,242,242,0.35)",
                fontSize: 11,
              }
        }
      >
        <i className={icon ?? "fa-solid fa-arrow-up-right"} />
      </div>
      <div
        className="mb-[10px] text-[10px] font-medium uppercase tracking-[0.3px]"
        style={{
          color: isHero ? "rgba(200,160,255,0.4)" : "rgba(242,242,242,0.3)",
        }}
      >
        {label}
      </div>
      {valueLarge ? (
        <div
          className="qrave-font-display font-black leading-none"
          style={{
            fontSize: isHero ? 44 : 30,
            letterSpacing: isHero ? "-2px" : "-1.5px",
            color: isHero ? "var(--qrave-accent-soft)" : "#fff",
            marginBottom: 8,
          }}
        >
          {valueLarge}
        </div>
      ) : null}
      {valueText ? (
        <div
          className="qrave-font-display"
          style={{
            fontSize: 16,
            fontWeight: 900,
            letterSpacing: "-0.3px",
            color: "#fff",
            marginTop: 6,
            marginBottom: 8,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={valueText}
        >
          {valueText}
        </div>
      ) : null}
      {delta ? (
        <div
          className="flex items-center gap-1 text-[11px]"
          style={{
            color:
              isHero
                ? "rgba(200,160,255,0.55)"
                : deltaTrend === "up"
                  ? "#4ade80"
                  : deltaTrend === "down"
                    ? "#f87171"
                    : "rgba(242,242,242,0.3)",
          }}
        >
          {deltaTrend === "up" ? (
            <i className="fa-solid fa-arrow-trend-up" />
          ) : deltaTrend === "down" ? (
            <i className="fa-solid fa-arrow-trend-down" />
          ) : (
            <i className="fa-solid fa-eye" />
          )}
          {delta}
        </div>
      ) : null}
    </div>
  );
}

function QuickAction({
  icon,
  tone,
  title,
  sub,
  onClick,
}: {
  icon: string;
  tone: "purple" | "green" | "blue" | "orange";
  title: string;
  sub: string;
  onClick: () => void;
}) {
  const toneStyles: Record<typeof tone, { bg: string; color: string }> = {
    purple: { bg: "rgba(147,51,234,0.18)", color: "#a855f7" },
    green: { bg: "rgba(74,222,128,0.1)", color: "#4ade80" },
    blue: { bg: "rgba(59,130,246,0.12)", color: "#60a5fa" },
    orange: { bg: "rgba(251,146,60,0.12)", color: "#fb923c" },
  };
  const s = toneStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-2 flex w-full items-center gap-3 rounded-[11px] border px-3.5 py-[11px] text-left transition last:mb-0"
      style={{
        background: "rgba(255,255,255,0.03)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: s.bg, color: s.color, fontSize: 13 }}
      >
        <i className={icon} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium">{title}</div>
        <div className="truncate text-[10px]" style={{ color: "rgba(242,242,242,0.28)" }}>
          {sub}
        </div>
      </div>
      <i className="fa-solid fa-chevron-right text-[11px]" style={{ color: "rgba(242,242,242,0.18)" }} />
    </button>
  );
}
