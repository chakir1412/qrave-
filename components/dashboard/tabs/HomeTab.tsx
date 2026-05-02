"use client";

import { useEffect, useMemo, useState } from "react";
import type { MenuItem } from "@/lib/supabase";
import type { KarteSub } from "../types";
import { isLikelyDrinkCategory } from "../analytics";
import {
  formatDateLongDe,
  greetingLabel,
} from "../utils";
import { DASH_GLASS_CARD_CLASS, dash } from "../constants";
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
      <section className="px-0 pt-5">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-white">
          Guten {greetingLabel()},{" "}
          <span style={{ color: dash.teal }}>{userFirstName}</span>
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: dash.mu }}>
          {restaurantName}
        </p>
        <p className="mt-1 text-xs" style={{ color: dash.mu }}>
          {formatDateLongDe()}
        </p>
      </section>

      <div className="mt-4 flex flex-col space-y-3">
      <section className="grid grid-cols-2 gap-3 px-0">
        <div
          className={`${DASH_GLASS_CARD_CLASS} col-span-2 flex min-h-[140px] flex-col justify-between p-4`}
        >
          <div className="text-[11px] font-medium uppercase tracking-widest" style={{ color: dash.kpiLabel }}>
            Aufrufe heute
          </div>
          <div className="text-[36px] font-semibold leading-none text-white">{animatedViews}</div>
          <div>
            <div className="text-[11px]" style={{ color: dash.kpiLabel }}>
              vs. gestern ({viewsYesterday ?? "–"})
            </div>
            <div
              className="mt-2 h-px w-full rounded-full"
              style={{
                backgroundColor: "#00c8a0",
                boxShadow: "0 0 10px rgba(0,200,160,0.45)",
              }}
            />
          </div>
        </div>

        <div className={`${DASH_GLASS_CARD_CLASS} flex min-h-[100px] flex-col justify-between p-4`}>
          <div className="text-[20px] leading-none">🔥</div>
          <div>
            <div className="line-clamp-2 text-[15px] font-semibold leading-tight text-white">{topFood}</div>
            <div className="mt-1 text-[11px] uppercase tracking-widest" style={{ color: dash.kpiLabel }}>
              Top Gericht
            </div>
          </div>
        </div>

        <div className={`${DASH_GLASS_CARD_CLASS} flex min-h-[100px] flex-col justify-between p-4`}>
          <div className="text-[20px] leading-none">🥤</div>
          <div>
            <div className="line-clamp-2 text-[15px] font-semibold leading-tight text-white">{topDrink}</div>
            <div className="mt-1 text-[11px] uppercase tracking-widest" style={{ color: dash.kpiLabel }}>
              Top Getränk
            </div>
          </div>
        </div>
      </section>

      <section className="px-0">
        <div className="mb-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest" style={{ color: dash.mu }}>
          Schnellzugriff
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onGoKarte("heute")}
            className={`${DASH_GLASS_CARD_CLASS} min-h-0 px-4 py-3.5 text-left transition active:scale-[0.98]`}
          >
            <div className="mb-1.5 text-lg">⭐</div>
            <div className="text-[13px] font-bold">Tages-Special</div>
            <div className="text-[11px] font-semibold" style={{ color: dailyPush ? dash.gr : dash.teal }}>
              {dailyPush ? `${dailyPush.item_emoji} ${dailyPush.item_name}` : "Noch nicht gesetzt"}
            </div>
          </button>
          <button
            type="button"
            onClick={() => onGoKarte("notiz")}
            className={`${DASH_GLASS_CARD_CLASS} min-h-0 px-4 py-3.5 text-left transition active:scale-[0.98]`}
          >
            <div className="mb-1.5 text-lg">📝</div>
            <div className="text-[13px] font-bold">Gäste-Notiz</div>
            <div className="text-[11px]" style={{ color: dash.mu }}>
              Hinweis für heute setzen
            </div>
          </button>
        </div>
      </section>

      <section className="px-0">
        <div className={`${DASH_GLASS_CARD_CLASS} w-full px-5 py-5`}>
          <div className="mb-0.5 text-[15px] font-semibold text-white">Scans diese Woche</div>
          <div className="mb-4 text-xs" style={{ color: dash.mu }}>
            Mo–So · Gesamt {weekTotal}
          </div>
          <div className="relative z-[1] mb-2 h-[180px] w-full">
            <svg viewBox="0 0 300 100" className="h-full w-full overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00c8a0" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#00c8a0" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[20, 40, 60, 80].map((y) => (
                <line
                  key={y}
                  x1={8}
                  y1={y}
                  x2={292}
                  y2={y}
                  stroke={dash.chartGrid}
                  strokeWidth={1}
                />
              ))}
              <path d={fillD} fill="url(#cg)" className={chartReady ? "opacity-100" : "opacity-0"} style={{ transition: "opacity 0.8s ease 0.3s" }} />
              <path
                d={lineD}
                fill="none"
                stroke={dash.teal}
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
                    fill={i === 6 ? "#ffffff" : dash.teal}
                    stroke={i === 6 ? dash.teal : dash.bg}
                    strokeWidth={i === 6 ? 2.5 : 2}
                    className={chartReady ? "opacity-100" : "opacity-0"}
                    style={{ transition: `opacity 0.2s ease ${0.4 + i * 0.05}s` }}
                  />
                );
              })}
            </svg>
          </div>
          <div className="relative z-[1] flex justify-between px-0.5">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
              <span
                key={d}
                className="flex-1 text-center text-[10px] font-medium"
                style={{ color: dash.chartAxis }}
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="px-0">
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
                className="rounded-[10px] border px-2.5 py-1 text-[11px] font-medium transition"
                style={
                  insightPeriod === k
                    ? { backgroundColor: dash.ord, borderColor: dash.orm, color: dash.teal }
                    : {
                        backgroundColor: dash.secondaryBg,
                        borderColor: dash.secondaryBorder,
                        color: dash.secondaryFg,
                        opacity: 0.85,
                      }
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
              className="flex gap-3 rounded-[14px] border px-3.5 py-3"
              style={{ backgroundColor: "rgba(52,232,158,0.08)", borderColor: "rgba(52,232,158,0.2)" }}
            >
              <div
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg text-[15px]"
                style={{ backgroundColor: "rgba(52,232,158,0.15)" }}
              >
                🔥
              </div>
              <div>
                <div className="text-[13px] font-semibold leading-snug" style={{ color: dash.gr }}>
                  {topItemsWeek[0].name} — {topItemsWeek[0].count} Aufrufe
                </div>
                <div className="text-[11px] leading-snug" style={{ color: dash.mu }}>
                  Starkes Interesse in der {insightPeriod === "week" ? "Woche" : "Periode"}.
                </div>
              </div>
            </div>
          )}
          <div className={`${DASH_GLASS_CARD_CLASS} flex gap-3 rounded-[14px] px-3.5 py-3`}>
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

      <section className="px-0">
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
                ? { backgroundColor: dash.ord, borderColor: dash.orm, color: dash.teal }
                : {
                    backgroundColor: dash.secondaryBg,
                    borderColor: dash.secondaryBorder,
                    color: dash.mu,
                  }
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
                ? { backgroundColor: dash.ord, borderColor: dash.orm, color: dash.teal }
                : {
                    backgroundColor: dash.secondaryBg,
                    borderColor: dash.secondaryBorder,
                    color: dash.mu,
                  }
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
                        background: "linear-gradient(145deg,rgba(0,200,160,0.12),rgba(8,8,16,0.95))",
                        borderColor: "rgba(0,200,160,0.35)",
                        boxShadow: "0 8px 24px rgba(0,200,160,.12)",
                      }
                    : rank === 1
                      ? {
                          background: "linear-gradient(145deg,rgba(255,255,255,0.06),rgba(8,8,16,0.9))",
                          borderColor: "rgba(255,255,255,0.1)",
                        }
                      : {
                          background: "linear-gradient(145deg,rgba(255,255,255,0.04),rgba(8,8,16,0.92))",
                          borderColor: "rgba(255,255,255,0.07)",
                        }
                }
              >
                {rank === 0 && (
                  <div
                    className="pointer-events-none absolute -top-8 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full"
                    style={{ background: "radial-gradient(circle,rgba(0,200,160,.22),transparent 70%)" }}
                  />
                )}
                <span
                  className="self-start text-[10px] font-extrabold tracking-wider"
                  style={{
                    color:
                      rank === 0
                        ? dash.teal
                        : rank === 1
                          ? "rgba(255,255,255,.35)"
                          : "rgba(255,255,255,.25)",
                  }}
                >
                  #{rank + 1}
                </span>
                <div>
                  <div
                    className="text-[28px] font-black leading-none tracking-tight"
                    style={{
                      color: rank === 0 ? dash.teal : rank === 1 ? dash.tx : dash.mi,
                    }}
                  >
                    {row?.count ?? "–"}
                  </div>
                  <div
                    className="mt-1 text-[10px] font-semibold leading-tight"
                    style={{
                      color: rank === 0 ? "rgba(255,255,255,.9)" : dash.mi,
                    }}
                  >
                    {row?.name ?? "—"}
                  </div>
                  <div
                    className="mt-0.5 text-[9px]"
                    style={{ color: rank === 0 ? "rgba(0,200,160,.55)" : dash.mu }}
                  >
                    Aufrufe
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="px-0">
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
            <div key={r.name} className={`${DASH_GLASS_CARD_CLASS} rounded-[14px] px-3.5 py-3.5`}>
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
                        ? `linear-gradient(90deg, ${dash.teal}, ${dash.or2})`
                        : r.level === "md"
                          ? dash.yellow
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
                      ? { backgroundColor: dash.ord, borderColor: dash.orm, color: dash.teal }
                      : r.level === "md"
                        ? {
                            backgroundColor: "rgba(255,212,38,0.12)",
                            borderColor: "rgba(255,212,38,0.25)",
                            color: dash.yellow,
                          }
                        : {
                            backgroundColor: "rgba(255,75,110,0.12)",
                            borderColor: "rgba(255,75,110,0.25)",
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

      <section className="px-0 pb-2">
        <div className={`${DASH_GLASS_CARD_CLASS} px-[18px] py-[18px]`}>
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
                    backgroundColor: dash.teal,
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
    </div>
  );
}
