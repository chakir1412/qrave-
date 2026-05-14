"use client";

import { useMemo, useState } from "react";
import type { MenuItem } from "@/lib/supabase";
import type { KarteSub } from "../types";
import type { AnalyticsEventRow } from "../analytics";
import { formatDateLongDe, greetingLabel } from "../utils";
import { Hint } from "../Hint";
import { LineChart } from "@/components/shared/LineChart";

type Range = "7d" | "30d" | "month" | "custom";

type Props = {
  userFirstName: string;
  restaurantName: string;
  events: AnalyticsEventRow[];
  menuItems: MenuItem[];
  onGoKarte: (sub: KarteSub, options?: { filter?: "soldout" }) => void;
};

const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Liefert from (inkl.), to (exkl.) und die Anzahl der Tage. */
function computeRange(
  range: Range,
  customFrom: string,
  customTo: string,
): { from: Date; to: Date; days: number } {
  const today = startOfLocalDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (range === "7d") {
    const f = new Date(today);
    f.setDate(today.getDate() - 6);
    return { from: f, to: tomorrow, days: 7 };
  }
  if (range === "30d") {
    const f = new Date(today);
    f.setDate(today.getDate() - 29);
    return { from: f, to: tomorrow, days: 30 };
  }
  if (range === "month") {
    const f = new Date(today.getFullYear(), today.getMonth(), 1);
    const days = Math.max(1, Math.round((tomorrow.getTime() - f.getTime()) / 86400000));
    return { from: f, to: tomorrow, days };
  }
  // custom: native HTML5-Date-Inputs, ISO YYYY-MM-DD
  const f = customFrom ? new Date(`${customFrom}T00:00:00`) : new Date(today);
  const t = customTo ? new Date(`${customTo}T00:00:00`) : today;
  const end = new Date(t);
  end.setDate(end.getDate() + 1);
  if (end <= f) end.setDate(f.getDate() + 1);
  const days = Math.max(1, Math.round((end.getTime() - f.getTime()) / 86400000));
  return { from: f, to: end, days };
}

function previousRange(current: { from: Date; days: number }): { from: Date; to: Date; days: number } {
  const to = new Date(current.from);
  const from = new Date(to);
  from.setDate(to.getDate() - current.days);
  return { from, to, days: current.days };
}

type Aggregated = {
  totalSessions: number;
  series: number[];
  labels: string[];
  hourBuckets: { morning: number; midday: number; evening: number; night: number };
  topItems: { name: string; count: number; views: number }[];
};

function aggregateForRange(events: AnalyticsEventRow[], from: Date, to: Date, days: number): Aggregated {
  const sessions = new Set<string>();
  const seriesByDay = new Map<string, Set<string>>();
  const itemDetail = new Map<string, number>();
  const itemView = new Map<string, number>();
  const morning = new Set<string>();
  const midday = new Set<string>();
  const evening = new Set<string>();
  const night = new Set<string>();

  for (const e of events) {
    const t = new Date(e.created_at);
    if (t < from || t >= to) continue;
    const sk = (e.session_id ?? "").trim() || `row:${e.created_at}-${e.item_id ?? ""}`;
    sessions.add(sk);

    const dk = dayKey(startOfLocalDay(t));
    let s = seriesByDay.get(dk);
    if (!s) {
      s = new Set();
      seriesByDay.set(dk, s);
    }
    s.add(sk);

    const h = t.getHours();
    if (h >= 8 && h < 12) morning.add(sk);
    else if (h >= 12 && h < 15) midday.add(sk);
    else if (h >= 17 && h < 21) evening.add(sk);
    else if (h >= 21 && h < 24) night.add(sk);

    const name = e.item_name?.trim() ?? "";
    if (name) {
      if (e.event_type === "item_detail") itemDetail.set(name, (itemDetail.get(name) ?? 0) + 1);
      else if (e.event_type === "item_view") itemView.set(name, (itemView.get(name) ?? 0) + 1);
    }
  }

  const series: number[] = [];
  const labels: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    series.push(seriesByDay.get(dayKey(d))?.size ?? 0);
    labels.push(formatAxisLabel(d, days));
  }

  const topItems = [...itemDetail.entries()]
    .map(([name, clicks]) => ({ name, count: clicks, views: itemView.get(name) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalSessions: sessions.size,
    series,
    labels,
    hourBuckets: {
      morning: morning.size,
      midday: midday.size,
      evening: evening.size,
      night: night.size,
    },
    topItems,
  };
}

function formatAxisLabel(d: Date, totalDays: number): string {
  if (totalDays <= 7) return WEEKDAY_SHORT[d.getDay()];
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

function categoryOf(item: MenuItem | undefined): string {
  if (!item) return "—";
  return item.kategorie?.trim() || "—";
}

function deltaPct(current: number, previous: number): { pct: number | null; trend: "up" | "down" | "flat" } {
  if (previous === 0) {
    if (current === 0) return { pct: null, trend: "flat" };
    return { pct: null, trend: "up" }; // unendlich — kein Prozentwert sinnvoll
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct, trend: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: "7d", label: "7 Tage" },
  { key: "30d", label: "30 Tage" },
  { key: "month", label: "Dieser Monat" },
  { key: "custom", label: "Benutzerdefiniert" },
];

const RANGE_LABEL: Record<Range, string> = {
  "7d": "letzte 7 Tage",
  "30d": "letzte 30 Tage",
  month: "diesen Monat",
  custom: "Zeitraum",
};

export function HomeTab({
  userFirstName,
  restaurantName,
  events,
  menuItems,
  onGoKarte,
}: Props) {
  const [range, setRange] = useState<Range>("7d");
  const today = startOfLocalDay(new Date());
  const defaultFrom = useMemo(() => {
    const f = new Date(today);
    f.setDate(today.getDate() - 6);
    return toIso(f);
  }, [today]);
  const [customFrom, setCustomFrom] = useState<string>(defaultFrom);
  const [customTo, setCustomTo] = useState<string>(toIso(today));

  const rangeInfo = useMemo(
    () => computeRange(range, customFrom, customTo),
    [range, customFrom, customTo],
  );
  const prevRange = useMemo(() => previousRange(rangeInfo), [rangeInfo]);

  const current = useMemo(
    () => aggregateForRange(events, rangeInfo.from, rangeInfo.to, rangeInfo.days),
    [events, rangeInfo],
  );
  const previous = useMemo(
    () => aggregateForRange(events, prevRange.from, prevRange.to, prevRange.days),
    [events, prevRange],
  );

  const totalDelta = deltaPct(current.totalSessions, previous.totalSessions);
  const avgPerDay = rangeInfo.days > 0 ? Math.round(current.totalSessions / rangeInfo.days) : 0;
  const peakDay = useMemo(() => {
    let best = 0;
    let bestIdx = 0;
    current.series.forEach((v, i) => {
      if (v > best) {
        best = v;
        bestIdx = i;
      }
    });
    return { value: best, label: current.labels[bestIdx] ?? "—" };
  }, [current.series, current.labels]);

  const nameToItem = useMemo(() => {
    const m = new Map<string, MenuItem>();
    for (const it of menuItems) m.set(it.name, it);
    return m;
  }, [menuItems]);

  const topItem = current.topItems[0] ?? null;

  // Meistgeklickte Items: bis zu 6 items mit Balken; alle View-to-Click-Rates.
  const popularItems = useMemo(() => {
    return current.topItems.slice(0, 6).map((row) => {
      const rate = row.views > 0 ? Math.round((row.count / row.views) * 100) : null;
      return {
        name: row.name,
        category: categoryOf(nameToItem.get(row.name)),
        clicks: row.count,
        views: row.views,
        rate,
      };
    });
  }, [current.topItems, nameToItem]);

  const peakAvg = {
    morning: rangeInfo.days > 0 ? current.hourBuckets.morning / rangeInfo.days : 0,
    midday: rangeInfo.days > 0 ? current.hourBuckets.midday / rangeInfo.days : 0,
    evening: rangeInfo.days > 0 ? current.hourBuckets.evening / rangeInfo.days : 0,
    night: rangeInfo.days > 0 ? current.hourBuckets.night / rangeInfo.days : 0,
  };
  const peakMax = Math.max(peakAvg.morning, peakAvg.midday, peakAvg.evening, peakAvg.night, 0.0001);

  const peakRows = [
    { key: "morning" as const, label: "8–12 Uhr", sub: "Morgens", icon: "fa-solid fa-sun", tone: "blue" as const, value: peakAvg.morning },
    { key: "midday" as const, label: "12–15 Uhr", sub: "Mittags", icon: "fa-solid fa-fire", tone: "purple" as const, value: peakAvg.midday },
    { key: "evening" as const, label: "17–21 Uhr", sub: "Abends", icon: "fa-solid fa-fire", tone: "purple" as const, value: peakAvg.evening },
    { key: "night" as const, label: "21–24 Uhr", sub: "Nachts", icon: "fa-solid fa-moon", tone: "blue" as const, value: peakAvg.night },
  ];

  const hasData = current.totalSessions > 0;

  return (
    <div className="space-y-4">
      <header className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="qrave-font-display text-[22px] font-black leading-tight tracking-tight">
            Guten {greetingLabel()},{" "}
            <span style={{ color: "var(--qrave-accent-strong)" }}>{restaurantName || userFirstName}</span>
          </h2>
          <div className="mt-1 text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
            {formatDateLongDe()}
          </div>
        </div>
        <RangePicker
          range={range}
          onRangeChange={setRange}
          customFrom={customFrom}
          customTo={customTo}
          onCustomChange={(f, t) => {
            setCustomFrom(f);
            setCustomTo(t);
          }}
        />
      </header>

      {/* STAT-KARTEN */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <StatCard
          variant="hero"
          label={`Aufrufe · ${RANGE_LABEL[range]}`}
          valueLarge={current.totalSessions.toLocaleString("de-DE")}
          delta={
            totalDelta.pct == null
              ? previous.totalSessions === 0 && current.totalSessions > 0
                ? "Vorperiode ohne Daten"
                : null
              : `${totalDelta.pct > 0 ? "+" : ""}${totalDelta.pct}% vs. Vorperiode`
          }
          deltaTrend={totalDelta.trend}
        />
        <StatCard
          label="Aufrufe / Tag (Ø)"
          valueLarge={avgPerDay.toLocaleString("de-DE")}
          delta={`über ${rangeInfo.days} ${rangeInfo.days === 1 ? "Tag" : "Tage"}`}
        />
        <StatCard
          label="Stärkster Tag"
          valueLarge={peakDay.value.toLocaleString("de-DE")}
          delta={peakDay.value > 0 ? peakDay.label : "Keine Daten"}
        />
        <StatCard
          label="Top Gericht"
          valueText={topItem?.name ?? "—"}
          delta={topItem ? `${topItem.count} Klicks` : "Noch keine Daten"}
          icon="fa-solid fa-fire"
          iconColor="#fb923c"
        />
      </section>

      {/* MAIN GRID: Line Chart + Top Gerichte */}
      <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                Scans · {RANGE_LABEL[range]}
              </div>
              <div className="mt-1 flex items-center gap-2.5">
                <div className="qrave-font-display text-[36px] font-black leading-none tracking-[-2px]">
                  {current.totalSessions.toLocaleString("de-DE")}
                </div>
                {totalDelta.pct != null ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11px] font-semibold"
                    style={{
                      background: totalDelta.trend === "up" ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                      color: totalDelta.trend === "up" ? "#4ade80" : "#f87171",
                      border: `1px solid ${totalDelta.trend === "up" ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
                    }}
                  >
                    <i className={`fa-solid fa-arrow-${totalDelta.trend === "up" ? "up" : "down"} text-[10px]`} />
                    {totalDelta.pct > 0 ? "+" : ""}
                    {totalDelta.pct}%
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <LineChart
              data={current.series.map((value, i) => ({
                label: current.labels[i] ?? "",
                value,
              }))}
              color="#9333ea"
              className="h-[170px] md:h-[220px]"
              emptyLabel="Noch keine Scans in diesem Zeitraum."
              skipZeros
            />
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-start justify-between">
            <div className="qrave-font-display flex items-center gap-2 text-[14px] font-bold">
              Top Gerichte
              <Hint text="Sortiert nach Klicks (Item-Modal geöffnet). Prozent rechts ist die View-to-Click-Rate: wie oft Gäste das Item ansehen → wie oft sie es anklicken." />
            </div>
            <button
              type="button"
              onClick={() => onGoKarte("menu")}
              className="text-[12px] font-medium"
              style={{ color: "color-mix(in srgb, var(--qrave-accent) 75%, white)" }}
            >
              Alle ansehen
            </button>
          </div>
          {current.topItems.length === 0 ? (
            <p className="text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
              Noch keine Daten · {RANGE_LABEL[range]}.
            </p>
          ) : (
            current.topItems.map((row, i) => {
              const hasViews = row.views > 0;
              const rate = hasViews ? Math.round((row.count / row.views) * 100) : null;
              return (
                <div
                  key={`${row.name}-${i}`}
                  className="flex items-center gap-3 border-b py-2.5 last:border-b-0 last:pb-0"
                  style={{ borderColor: "rgba(255,255,255,0.05)" }}
                >
                  <span
                    className="qrave-font-display w-4 text-[11px] font-bold"
                    style={{ color: "rgba(242,242,242,0.32)" }}
                  >
                    #{i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{row.name}</div>
                    <div className="text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                      {categoryOf(nameToItem.get(row.name))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="qrave-font-display text-[13px] font-bold"
                      style={{ color: "rgba(242,242,242,0.7)" }}
                    >
                      {row.count}
                    </div>
                    <div
                      className="text-[10.5px] font-semibold"
                      style={{
                        color: rate == null ? "rgba(242,242,242,0.4)" : rate >= 30 ? "#4ade80" : rate < 15 ? "#f87171" : "rgba(242,242,242,0.6)",
                      }}
                    >
                      {rate == null ? "—" : `${rate}%`}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </section>

      {/* BOTTOM: Meistgeklickte (mit View-to-Click-Balken) + Peak-Zeiten */}
      <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card>
          <div className="qrave-font-display mb-1 flex items-center gap-2 text-[14px] font-bold">
            Meistgeklickte Gerichte
            <Hint text="View-to-Click: wie oft ein Item angesehen wurde vs. wie oft Gäste das Item geöffnet haben. Niedrig (<15%) deutet auf schlecht performende Items hin." />
          </div>
          <div className="mb-4 text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
            View-to-Click Rate · {RANGE_LABEL[range]}
          </div>
          {popularItems.length === 0 ? (
            <p className="text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
              Noch keine Klick-Daten in diesem Zeitraum.
            </p>
          ) : (
            popularItems.map((it, idx) => {
              const rate = it.rate;
              const barColor =
                rate == null
                  ? "rgba(242,242,242,0.25)"
                  : rate >= 30
                    ? "linear-gradient(90deg, #4ade80, #22c55e)"
                    : rate < 15
                      ? "linear-gradient(90deg, #f87171, #ef4444)"
                      : "linear-gradient(90deg, #facc15, #eab308)";
              const rateColor =
                rate == null
                  ? "rgba(242,242,242,0.5)"
                  : rate >= 30
                    ? "#4ade80"
                    : rate < 15
                      ? "#f87171"
                      : "#facc15";
              const fillWidth = rate == null ? 0 : Math.min(100, Math.max(2, rate));
              return (
                <div
                  key={`${it.name}-${idx}`}
                  className="mb-3 border-b pb-3 last:mb-0 last:border-b-0 last:pb-0"
                  style={{ borderColor: "rgba(255,255,255,0.05)" }}
                >
                  <div className="mb-1.5 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{it.name}</div>
                      <div className="text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                        {it.category}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className="qrave-font-display text-[14px] font-bold"
                        style={{ color: rateColor }}
                      >
                        {rate == null ? "—" : `${rate}%`}
                      </div>
                      <div className="text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                        {it.clicks} Klicks · {it.views} Views
                      </div>
                    </div>
                  </div>
                  <div
                    className="h-[6px] overflow-hidden rounded-[3px]"
                    style={{ background: "rgba(255,255,255,0.07)" }}
                  >
                    <div
                      className="h-full rounded-[3px] transition-[width] duration-300"
                      style={{ width: `${fillWidth}%`, background: barColor }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </Card>

        <Card>
          <div className="qrave-font-display mb-5 flex items-center gap-2 text-[14px] font-bold">
            Peak-Zeiten · Ø {RANGE_LABEL[range]}
            <Hint text="Wann scannen Gäste am häufigsten? Werte sind Sessions pro Tag im gewählten Zeitraum, gemittelt." />
          </div>
          {!hasData ? (
            <p className="text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
              Noch keine Scans in diesem Zeitraum.
            </p>
          ) : (
            peakRows.map((p) => {
              const width = Math.max(2, Math.round((p.value / peakMax) * 100));
              const isHi = p.value > 0 && p.value >= peakMax * 0.7;
              const display = p.value >= 10 ? Math.round(p.value).toString() : p.value.toFixed(1);
              return (
                <div key={p.key} className="mb-3.5 flex items-center gap-3 last:mb-0">
                  <div
                    className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px]"
                    style={{
                      background: p.tone === "purple" ? "rgba(147,51,234,0.18)" : "rgba(59,130,246,0.12)",
                    }}
                  >
                    <i
                      className={p.icon}
                      style={{ color: p.tone === "purple" ? "#a855f7" : "#60a5fa", fontSize: 12 }}
                    />
                  </div>
                  <div className="w-[110px] shrink-0">
                    <div
                      className="text-[12px] font-medium leading-tight"
                      style={{ color: isHi ? "var(--qrave-accent-soft)" : undefined }}
                    >
                      {p.label}
                    </div>
                    <div className="text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                      {p.sub}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="h-[6px] overflow-hidden rounded-[3px]" style={{ background: "rgba(255,255,255,0.07)" }}>
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
                    className="qrave-font-display w-[36px] shrink-0 text-right text-[13px] font-bold"
                    style={{ color: isHi ? "var(--qrave-accent-soft)" : "rgba(242,242,242,0.7)" }}
                    title="Sessions pro Tag (Ø)"
                  >
                    {display}
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </section>
    </div>
  );
}

function RangePicker({
  range,
  onRangeChange,
  customFrom,
  customTo,
  onCustomChange,
}: {
  range: Range;
  onRangeChange: (r: Range) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Hint text="Wähle den Zeitraum, über den alle Zahlen, Charts und Peak-Zeiten ausgewertet werden." placement="bottom" />
      <div className="flex gap-1.5">
        {RANGE_OPTIONS.map((opt) => {
          const active = range === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onRangeChange(opt.key)}
              className="rounded-[8px] border px-3 py-1.5 text-[11px] font-semibold transition"
              style={
                active
                  ? {
                      borderColor: "color-mix(in srgb, var(--qrave-accent) 40%, transparent)",
                      background: "color-mix(in srgb, var(--qrave-accent) 20%, transparent)",
                      color: "var(--qrave-accent-soft)",
                    }
                  : {
                      borderColor: "rgba(255,255,255,0.08)",
                      background: "transparent",
                      color: "rgba(242,242,242,0.5)",
                    }
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {range === "custom" ? (
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomChange(e.target.value, customTo)}
            className="rounded-[8px] border px-2 py-1.5 text-[11px]"
            style={{
              borderColor: "rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "#f2f2f2",
            }}
          />
          <span>bis</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomChange(customFrom, e.target.value)}
            className="rounded-[8px] border px-2 py-1.5 text-[11px]"
            style={{
              borderColor: "rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "#f2f2f2",
            }}
          />
        </div>
      ) : null}
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
      <div
        className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-[8px] border"
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
                color: iconColor ?? "rgba(242,242,242,0.5)",
                fontSize: 11,
              }
        }
      >
        <i className={icon ?? "fa-solid fa-arrow-up-right"} />
      </div>
      <div
        className="mb-[10px] text-[11px] font-medium uppercase tracking-[0.3px]"
        style={{ color: isHero ? "rgba(216,180,254,0.6)" : "rgba(242,242,242,0.5)" }}
      >
        {label}
      </div>
      {valueLarge ? (
        <div
          className="qrave-font-display font-black leading-none"
          style={{
            fontSize: isHero ? 44 : 30,
            letterSpacing: isHero ? "-2px" : "-1.5px",
            color: isHero ? "var(--qrave-accent-soft)" : "#f2f2f2",
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
            color: "#f2f2f2",
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
            color: isHero
              ? "rgba(216,180,254,0.7)"
              : deltaTrend === "up"
                ? "#4ade80"
                : deltaTrend === "down"
                  ? "#f87171"
                  : "rgba(242,242,242,0.5)",
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

