"use client";

import { useEffect, useMemo, useState } from "react";
import type { MenuItem } from "@/lib/supabase";
import type { KarteSub } from "../types";
import { isLikelyDrinkCategory } from "../analytics";
import {
  formatDateLongDe,
  greetingLabel,
} from "../utils";
import { dash } from "../constants";
import type { DailyPush } from "@/lib/supabase";
import type { PeakRow } from "../analytics";

type InsightPeriod = "week" | "month" | "all";

type Props = {
  slideClass: string;
  userFirstName: string;
  restaurantName: string;
  viewsToday: number | null;
  viewsYesterday: number | null;
  weekSeries: number[];
  topItemsWeek: { name: string; count: number }[];
  menuItems: MenuItem[];
  peaksToday: PeakRow[];
  dailyPush: DailyPush | null;
  onGoKarte: (sub: KarteSub) => void;
};

function useAnimatedCount(target: number, durationMs: number): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = Math.max(0, target);
    let raf = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setV(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return v;
}

function buildChartPath(values: number[], w: number, h: number): { line: string; fill: string } {
  if (values.length === 0) return { line: "", fill: "" };
  const max = Math.max(1, ...values);
  const pad = 8;
  const step = (w - pad * 2) / (values.length - 1 || 1);
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - (v / max) * (h - pad * 2);
    return { x, y };
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const fill = `${line} L ${pts[pts.length - 1]?.x.toFixed(1) ?? 0} ${h} L ${pts[0]?.x.toFixed(1) ?? 0} ${h} Z`;
  return { line, fill };
}

export function HomeTab({
  slideClass,
  userFirstName,
  restaurantName,
  viewsToday,
  viewsYesterday,
  weekSeries,
  topItemsWeek,
  menuItems,
  peaksToday,
  dailyPush,
  onGoKarte,
}: Props) {
  const [chartReady, setChartReady] = useState(false);
  const [insightPeriod, setInsightPeriod] = useState<InsightPeriod>("week");
  const [top3Mode, setTop3Mode] = useState<"food" | "drink">("food");

  const vt = viewsToday ?? 0;
  const animatedViews = useAnimatedCount(vt, 1000);

  const pctVsYesterday = useMemo(() => {
    if (viewsToday === null || viewsYesterday === null || viewsYesterday === 0) return null;
    return Math.round(((viewsToday - viewsYesterday) / viewsYesterday) * 100);
  }, [viewsToday, viewsYesterday]);

  const { line: lineD, fill: fillD } = useMemo(
    () => buildChartPath(weekSeries.length ? weekSeries : [0, 0, 0, 0, 0, 0, 0], 300, 100),
    [weekSeries],
  );

  useEffect(() => {
    const t = requestAnimationFrame(() => setChartReady(true));
    return () => cancelAnimationFrame(t);
  }, [lineD]);

  const nameToItem = useMemo(() => {
    const m = new Map<string, MenuItem>();
    for (const it of menuItems) m.set(it.name, it);
    return m;
  }, [menuItems]);

  const topFood = useMemo(() => {
    for (const row of topItemsWeek) {
      const mi = nameToItem.get(row.name);
      if (!mi || !isLikelyDrinkCategory(mi.kategorie)) return row.name;
    }
    return topItemsWeek[0]?.name ?? "—";
  }, [topItemsWeek, nameToItem]);

  const topDrink = useMemo(() => {
    for (const row of topItemsWeek) {
      const mi = nameToItem.get(row.name);
      if (mi && isLikelyDrinkCategory(mi.kategorie)) return row.name;
    }
    return topItemsWeek.find((r) => isLikelyDrinkCategory(nameToItem.get(r.name)?.kategorie))
      ?.name ?? "—";
  }, [topItemsWeek, nameToItem]);

  const top3List = useMemo(() => {
    const filtered = topItemsWeek.filter((r) => {
      const mi = nameToItem.get(r.name);
      if (top3Mode === "drink") return mi ? isLikelyDrinkCategory(mi.kategorie) : false;
      return mi ? !isLikelyDrinkCategory(mi.kategorie) : true;
    });
    return filtered.slice(0, 3);
  }, [topItemsWeek, top3Mode, nameToItem]);

  const klickRows = useMemo(() => {
    const max = Math.max(1, ...topItemsWeek.slice(0, 4).map((r) => r.count));
    return topItemsWeek.slice(0, 4).map((r) => {
      const w = Math.round((r.count / max) * 100);
      let level: "hi" | "md" | "lo" = "md";
      if (w >= 85) level = "hi";
      else if (w < 35) level = "lo";
      return { ...r, w, level };
    });
  }, [topItemsWeek]);

  const peakRows =
    peaksToday.length > 0
      ? peaksToday
      : [
          { label: "12–13h", count: 0 },
          { label: "18–19h", count: 0 },
        ];
  const peakMax = Math.max(1, ...peakRows.map((p) => p.count));

  const weekTotal = weekSeries.reduce((a, b) => a + b, 0);

  const insightTitle =
    insightPeriod === "week"
      ? "Diese Woche"
      : insightPeriod === "month"
        ? "Dieser Monat"
        : "Gesamt";

  return (
    <div className={slideClass}>
      <section className="px-5 pt-5">
        <h1 className="text-[22px] font-black leading-tight tracking-tight">
          Guten {greetingLabel()},{" "}
          <span style={{ color: dash.or }}>{userFirstName}</span>
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: dash.mu }}>
          {restaurantName}
        </p>
        <p className="mt-1 text-xs" style={{ color: dash.mu }}>
          {formatDateLongDe()}
        </p>
      </section>

      <section
        className="relative mx-5 mt-4 overflow-hidden rounded-[20px] border px-[22px] py-5"
        style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full"
          style={{ background: "radial-gradient(circle,rgba(232,80,2,.18) 0%,transparent 70%)" }}
        />
        <div className="relative flex items-center justify-between">
          <div>
            <div
              className="mb-1 text-[11px] font-medium uppercase tracking-wider"
              style={{ color: dash.mu }}
            >
              Aufrufe heute
            </div>
            <div className="text-[64px] font-black leading-none tracking-tighter">
              {animatedViews}
            </div>
          </div>
          <div
            className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl text-xl shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${dash.or}, ${dash.or2})`,
              boxShadow: "0 8px 24px rgba(232,80,2,.35)",
            }}
          >
            👁
          </div>
        </div>
        <div className="relative mt-2 flex items-center gap-2">
          {pctVsYesterday !== null && (
            <span
              className="rounded-md border px-2 py-0.5 text-xs font-bold"
              style={{
                backgroundColor: dash.ord,
                borderColor: dash.orm,
                color: dash.or,
              }}
            >
              {pctVsYesterday >= 0 ? "↑" : "↓"} {pctVsYesterday >= 0 ? "+" : ""}
              {pctVsYesterday}% vs. gestern
            </span>
          )}
          <span className="text-xs" style={{ color: dash.mu }}>
            vs. gestern ({viewsYesterday ?? "–"})
          </span>
        </div>
      </section>

      <section className="mx-5 mt-2.5 grid grid-cols-2 gap-2.5">
        <div
          className="rounded-2xl border px-4 py-3.5"
          style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
        >
          <div className="mb-1.5 text-base">🔥</div>
          <div className="text-[17px] font-bold tracking-tight">{topFood}</div>
          <div className="text-[11px]" style={{ color: dash.mu }}>
            Top Gericht
          </div>
        </div>
        <div
          className="rounded-2xl border px-4 py-3.5"
          style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
        >
          <div className="mb-1.5 text-base">🍹</div>
          <div className="text-[17px] font-bold tracking-tight">{topDrink}</div>
          <div className="text-[11px]" style={{ color: dash.mu }}>
            Top Getränk
          </div>
        </div>
      </section>

      <section className="px-5 pt-4">
        <div className="mb-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest" style={{ color: dash.mu }}>
          Schnellzugriff
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onGoKarte("heute")}
            className="rounded-2xl border px-4 py-3.5 text-left transition active:scale-[0.98]"
            style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
          >
            <div className="mb-1.5 text-lg">⭐</div>
            <div className="text-[13px] font-bold">Tages-Special</div>
            <div className="text-[11px] font-semibold" style={{ color: dailyPush ? dash.gr : dash.or }}>
              {dailyPush ? `${dailyPush.item_emoji} ${dailyPush.item_name}` : "Noch nicht gesetzt"}
            </div>
          </button>
          <button
            type="button"
            onClick={() => onGoKarte("notiz")}
            className="rounded-2xl border px-4 py-3.5 text-left transition active:scale-[0.98]"
            style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
          >
            <div className="mb-1.5 text-lg">📝</div>
            <div className="text-[13px] font-bold">Gäste-Notiz</div>
            <div className="text-[11px]" style={{ color: dash.mu }}>
              Hinweis für heute setzen
            </div>
          </button>
        </div>
      </section>

      <section className="px-5 pt-4">
        <div
          className="rounded-[20px] border px-5 py-5"
          style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
        >
          <div className="mb-0.5 text-[15px] font-bold">Scans diese Woche</div>
          <div className="mb-4 text-xs" style={{ color: dash.mu }}>
            Mo–So · Gesamt {weekTotal}
          </div>
          <div className="relative mb-2 h-[110px] w-full">
            <svg viewBox="0 0 300 100" className="h-full w-full overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E85002" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#E85002" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={fillD} fill="url(#cg)" className={chartReady ? "opacity-100" : "opacity-0"} style={{ transition: "opacity 0.8s ease 0.3s" }} />
              <path
                d={lineD}
                fill="none"
                stroke={dash.or}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 1000,
                  strokeDashoffset: chartReady ? 0 : 1000,
                  transition: "stroke-dashoffset 1s ease-out",
                }}
              />
              {weekSeries.map((_, i) => {
                const max = Math.max(1, ...weekSeries);
                const pad = 8;
                const step = (300 - pad * 2) / (weekSeries.length - 1 || 1);
                const x = pad + i * step;
                const y = 100 - pad - (weekSeries[i] / max) * (100 - pad * 2);
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={i === 6 ? 4.5 : 3.5}
                    fill={i === 6 ? "#fff" : dash.or}
                    stroke={i === 6 ? dash.or : dash.bg}
                    strokeWidth={i === 6 ? 2.5 : 2}
                    className={chartReady ? "opacity-100" : "opacity-0"}
                    style={{ transition: `opacity 0.2s ease ${0.4 + i * 0.05}s` }}
                  />
                );
              })}
            </svg>
          </div>
          <div className="flex justify-between px-0.5">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d, i) => (
              <span
                key={d}
                className="flex-1 text-center text-[10px] font-medium"
                style={{ color: i === 6 ? dash.or : dash.mu }}
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: dash.mu }}>
            {insightTitle}
          </span>
          <div className="flex gap-1.5">
            {(
              [
                ["week", "Woche"],
                ["month", "Monat"],
                ["all", "Gesamt"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setInsightPeriod(k)}
                className="rounded-lg border px-2.5 py-1 text-[11px] font-medium transition"
                style={
                  insightPeriod === k
                    ? { backgroundColor: dash.ord, borderColor: dash.orm, color: dash.or }
                    : { backgroundColor: dash.s2, borderColor: dash.bo, color: dash.mu }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {topItemsWeek[0] && (
            <div
              className="flex gap-3 rounded-[14px] border border-transparent px-3.5 py-3"
              style={{ backgroundColor: "rgba(76,175,125,0.07)", borderColor: "rgba(76,175,125,0.15)" }}
            >
              <div
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg text-[15px]"
                style={{ backgroundColor: "rgba(76,175,125,0.15)" }}
              >
                🔥
              </div>
              <div>
                <div className="text-[13px] font-semibold leading-snug" style={{ color: "#6fcf97" }}>
                  {topItemsWeek[0].name} — {topItemsWeek[0].count} Aufrufe
                </div>
                <div className="text-[11px] leading-snug" style={{ color: dash.mu }}>
                  Starkes Interesse in der {insightPeriod === "week" ? "Woche" : "Periode"}.
                </div>
              </div>
            </div>
          )}
          <div
            className="flex gap-3 rounded-[14px] border border-transparent px-3.5 py-3"
            style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
          >
            <div
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg text-[15px]"
              style={{ backgroundColor: dash.s2 }}
            >
              ⚡
            </div>
            <div>
              <div className="text-[13px] font-semibold leading-snug">Peak-Zeiten beobachten</div>
              <div className="text-[11px] leading-snug" style={{ color: dash.mu }}>
                Nutze die Peak-Sektion unten für Stoßzeiten.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pt-4">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: dash.mu }}>
          Top 3 dieser Woche
        </div>
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setTop3Mode("food")}
            className="flex-1 rounded-[10px] border py-2 text-center text-xs font-medium"
            style={
              top3Mode === "food"
                ? { backgroundColor: dash.ord, borderColor: dash.orm, color: dash.or }
                : { backgroundColor: dash.s2, borderColor: dash.bo, color: dash.mu }
            }
          >
            🍽 Gerichte
          </button>
          <button
            type="button"
            onClick={() => setTop3Mode("drink")}
            className="flex-1 rounded-[10px] border py-2 text-center text-xs font-medium"
            style={
              top3Mode === "drink"
                ? { backgroundColor: dash.ord, borderColor: dash.orm, color: dash.or }
                : { backgroundColor: dash.s2, borderColor: dash.bo, color: dash.mu }
            }
          >
            🍺 Getränke
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((rank) => {
            const row = top3List[rank];
            const rClass = rank === 0 ? "r1" : rank === 1 ? "r2" : "r3";
            return (
              <div
                key={rank}
                className={`relative flex min-h-[108px] flex-col items-center justify-between overflow-hidden rounded-2xl border px-2.5 py-3.5 text-center transition active:scale-95 ${rClass}`}
                style={
                  rank === 0
                    ? {
                        background: "linear-gradient(145deg,#2a1200,#1a0d00)",
                        borderColor: "rgba(232,80,2,.35)",
                        boxShadow: "0 8px 24px rgba(232,80,2,.15)",
                      }
                    : rank === 1
                      ? {
                          background: "linear-gradient(145deg,#1e1e1e,#131313)",
                          borderColor: "rgba(249,249,249,.1)",
                        }
                      : {
                          background: "linear-gradient(145deg,#191919,#101010)",
                          borderColor: "rgba(249,249,249,.07)",
                        }
                }
              >
                {rank === 0 && (
                  <div
                    className="pointer-events-none absolute -top-8 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full"
                    style={{ background: "radial-gradient(circle,rgba(232,80,2,.25),transparent 70%)" }}
                  />
                )}
                <span
                  className="self-start text-[10px] font-extrabold tracking-wider"
                  style={{
                    color:
                      rank === 0
                        ? dash.or
                        : rank === 1
                          ? "rgba(249,249,249,.35)"
                          : "rgba(249,249,249,.25)",
                  }}
                >
                  #{rank + 1}
                </span>
                <div>
                  <div
                    className="text-[30px] font-black leading-none tracking-tight"
                    style={{
                      color: rank === 0 ? dash.or : rank === 1 ? dash.tx : dash.mi,
                    }}
                  >
                    {row?.count ?? "–"}
                  </div>
                  <div
                    className="mt-1 text-[10px] font-semibold leading-tight"
                    style={{
                      color: rank === 0 ? "rgba(249,249,249,.85)" : dash.mi,
                    }}
                  >
                    {row?.name ?? "—"}
                  </div>
                  <div
                    className="mt-0.5 text-[9px]"
                    style={{ color: rank === 0 ? "rgba(232,80,2,.55)" : dash.mu }}
                  >
                    Aufrufe
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="px-5 pt-4">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: dash.mu }}>
          Leute haben geschaut — bestellt?
        </div>
        <div className="flex flex-col gap-2">
          {klickRows.length === 0 && (
            <p className="text-xs" style={{ color: dash.mu }}>
              Noch keine Daten.
            </p>
          )}
          {klickRows.map((r) => (
            <div
              key={r.name}
              className="rounded-[14px] border px-3.5 py-3.5"
              style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold">{r.name}</span>
                <span className="text-[11px]" style={{ color: dash.mu }}>
                  {r.count} Aufrufe
                </span>
              </div>
              <div className="mb-2 h-[5px] overflow-hidden rounded-md" style={{ backgroundColor: dash.s2 }}>
                <div
                  className="h-full rounded-md"
                  style={{
                    width: `${r.w}%`,
                    background:
                      r.level === "hi"
                        ? `linear-gradient(90deg, ${dash.or}, ${dash.or2})`
                        : r.level === "md"
                          ? dash.ye
                          : dash.re,
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] italic" style={{ color: dash.mu }}>
                  Vergleich mit deiner Kasse
                </span>
                <span
                  className="rounded-md border px-2 py-0.5 text-[10px] font-bold"
                  style={
                    r.level === "hi"
                      ? { backgroundColor: dash.ord, borderColor: dash.orm, color: dash.or }
                      : r.level === "md"
                        ? {
                            backgroundColor: "rgba(240,180,41,0.1)",
                            borderColor: "rgba(240,180,41,0.2)",
                            color: dash.ye,
                          }
                        : {
                            backgroundColor: "rgba(224,92,92,0.1)",
                            borderColor: "rgba(224,92,92,0.2)",
                            color: dash.re,
                          }
                  }
                >
                  {r.level === "hi" ? "Sehr beliebt" : r.level === "md" ? "Prüfen ⚠️" : "Schwach 📉"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-4 pb-2">
        <div
          className="rounded-2xl border px-[18px] py-[18px]"
          style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
        >
          <div
            className="mb-3 text-[10px] font-medium uppercase tracking-wider"
            style={{ color: dash.mu }}
          >
            Peak-Zeiten heute
          </div>
          {peakRows.map((p) => (
            <div key={p.label} className="mb-2 flex items-center gap-2.5 last:mb-0">
              <span className="w-12 shrink-0 text-xs font-medium" style={{ color: dash.mi }}>
                {p.label}
              </span>
              <div className="h-[7px] flex-1 overflow-hidden rounded" style={{ backgroundColor: dash.s2 }}>
                <div
                  className="h-full rounded"
                  style={{
                    width: `${Math.round((p.count / peakMax) * 100)}%`,
                    backgroundColor: dash.or,
                  }}
                />
              </div>
              <span className="w-7 shrink-0 text-right text-[11px]" style={{ color: dash.mu }}>
                {p.count}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
