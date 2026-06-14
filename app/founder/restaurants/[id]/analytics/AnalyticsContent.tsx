"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AnalyticsDailyRow, RestaurantRow, ScanEventRow } from "./page";
import { LineChart } from "@/components/shared/LineChart";
import { RangePicker, type Range } from "@/components/shared/RangePicker";
import { isYmd } from "@/lib/restaurant-analytics-presets";

const DRINK_KEYWORDS = ["bier", "wein", "softdrink", "saft", "apfelwein", "cocktail", "longdrink", "kaffee", "espresso", "tee", "wasser", "energy", "limo", "aperitif"];
const DRINK_SUBCAT_COLOR: Record<string, string> = {
  bier: "#eab308",
  wein: "#dc2626",
  softdrinks: "#22c55e",
  cocktails: "#a855f7",
  wasser: "#3b82f6",
  kaffee: "#92400e",
  energy: "#f97316",
  sonstiges_getraenk: "#6b7280",
};
const DRINK_SUBCAT_LABELS: Record<string, string> = {
  bier: "Bier",
  wein: "Wein",
  softdrinks: "Softdrinks",
  cocktails: "Cocktails",
  wasser: "Wasser",
  kaffee: "Kaffee",
  energy: "Energy",
  sonstiges_getraenk: "Sonstiges",
};
const WEEKDAY_DE = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];

function berlinTodayIso(): string {
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

function daysInclusive(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function rangeBounds(
  range: Range,
  todayIso: string,
  customFrom: string,
  customTo: string,
): { fromIso: string; toIso: string; days: number } {
  if (range === "7d") return { fromIso: shiftIso(todayIso, -6), toIso: todayIso, days: 7 };
  if (range === "14d") return { fromIso: shiftIso(todayIso, -13), toIso: todayIso, days: 14 };
  if (range === "30d") return { fromIso: shiftIso(todayIso, -29), toIso: todayIso, days: 30 };
  if (range === "month") {
    const [y, m] = todayIso.split("-").map((v) => parseInt(v, 10));
    const fromIso = `${y}-${String(m).padStart(2, "0")}-01`;
    return { fromIso, toIso: todayIso, days: daysInclusive(fromIso, todayIso) };
  }
  // custom: Picker liefert beide ISO-Werte; falls leer, fallback auf 7d
  if (!customFrom || !customTo) return { fromIso: shiftIso(todayIso, -6), toIso: todayIso, days: 7 };
  const from = customFrom <= customTo ? customFrom : customTo;
  const to = customFrom <= customTo ? customTo : customFrom;
  // To nicht in die Zukunft erlauben
  const clampedTo = to > todayIso ? todayIso : to;
  return { fromIso: from, toIso: clampedTo, days: daysInclusive(from, clampedTo) };
}

function sumDaily<K extends keyof AnalyticsDailyRow>(rows: AnalyticsDailyRow[], key: K): number {
  let s = 0;
  for (const r of rows) {
    const v = r[key];
    if (typeof v === "number") s += v;
  }
  return s;
}

function isDrinkKategorie(k: string | null | undefined): boolean {
  if (!k) return false;
  const low = k.toLowerCase();
  return DRINK_KEYWORDS.some((kw) => low.includes(kw));
}

function csvEscape(s: string): string {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function fmt(n: number): string {
  return n.toLocaleString("de-DE");
}
function fmtDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

type Props = {
  restaurant: RestaurantRow;
  analyticsDaily: AnalyticsDailyRow[];
  scanEvents7d: ScanEventRow[];
};

export function AnalyticsContent({ restaurant, analyticsDaily, scanEvents7d }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Initialer Range aus den URL-SearchParams (vom Server für den Fetch genutzt),
  // damit ein Hard-Reload mit `?from&to` den korrekten Zeitraum zeigt.
  const urlFrom = searchParams.get("from") ?? "";
  const urlTo = searchParams.get("to") ?? "";
  const hasUrlRange = isYmd(urlFrom) && isYmd(urlTo);

  const [range, setRange] = useState<Range>(hasUrlRange ? "custom" : "7d");
  const [customFrom, setCustomFrom] = useState<string>(hasUrlRange ? urlFrom : "");
  const [customTo, setCustomTo] = useState<string>(hasUrlRange ? urlTo : "");
  const todayIso = berlinTodayIso();
  const bounds = useMemo(
    () => rangeBounds(range, todayIso, customFrom, customTo),
    [range, todayIso, customFrom, customTo],
  );

  // Bei Range-Wechsel die URL aktualisieren, damit die Server-Component die
  // Daily-Daten für den gewählten Zeitraum neu lädt. Mount überspringen, damit
  // der Default-View das 30-Tage-Initial-Fenster nutzt (kein Extra-Roundtrip).
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    router.replace(`?from=${bounds.fromIso}&to=${bounds.toIso}`, { scroll: false });
  }, [bounds.fromIso, bounds.toIso, router]);

  // Daily-Daten auf gewählten Range filtern
  const daily = useMemo(
    () => analyticsDaily.filter((r) => r.day_berlin >= bounds.fromIso && r.day_berlin <= bounds.toIso),
    [analyticsDaily, bounds.fromIso, bounds.toIso],
  );

  // Stat-Aggregate
  const totalScans = sumDaily(daily, "scan_count");
  const totalSessions = sumDaily(daily, "sessions_count");
  const totalConsent = sumDaily(daily, "sessions_with_consent");
  const totalItemDetail = sumDaily(daily, "item_detail_count");
  const totalVegan = sumDaily(daily, "vegan_clicks");
  const totalVegetarian = sumDaily(daily, "vegetarian_clicks");
  const avgPrice = useMemo(() => {
    const valid = daily.filter((r) => typeof r.avg_item_price_clicked === "number" && (r.avg_item_price_clicked ?? 0) > 0);
    if (valid.length === 0) return 0;
    return valid.reduce((s, r) => s + (r.avg_item_price_clicked ?? 0), 0) / valid.length;
  }, [daily]);

  // Sektion 1: Line-Chart (Scans pro Tag)
  const series = useMemo(() => {
    const out: { day: string; scans: number; sessions: number }[] = [];
    const byDay = new Map<string, AnalyticsDailyRow>();
    for (const r of daily) byDay.set(r.day_berlin, r);
    for (let i = 0; i < bounds.days; i++) {
      const iso = shiftIso(bounds.fromIso, i);
      if (iso > bounds.toIso) break;
      const r = byDay.get(iso);
      out.push({ day: iso, scans: r?.scan_count ?? 0, sessions: r?.sessions_count ?? 0 });
    }
    return out;
  }, [daily, bounds.days, bounds.fromIso, bounds.toIso]);

  // Sektion 2: Tageszeit-Aggregate (aus daily.scans_*)
  const tageszeit = {
    morgen: sumDaily(daily, "scans_morning"),
    mittag: sumDaily(daily, "scans_midday"),
    abend: sumDaily(daily, "scans_evening"),
    nacht: sumDaily(daily, "scans_night"),
  };
  const tageszeitMax = Math.max(tageszeit.morgen, tageszeit.mittag, tageszeit.abend, tageszeit.nacht, 1);

  // Sektion 3: Getränke-Performance — top_items gefiltert + beverage_subcategory_clicks aggregiert
  const drinkTop = useMemo(() => {
    const m = new Map<string, { clicks: number; kategorie: string }>();
    for (const r of daily) {
      for (const it of r.top_items ?? []) {
        if (!isDrinkKategorie(it.kategorie ?? null) && !isDrinkKategorie(it.name)) continue;
        const cur = m.get(it.name) ?? { clicks: 0, kategorie: it.kategorie ?? "—" };
        cur.clicks += it.clicks ?? 0;
        m.set(it.name, cur);
      }
    }
    return [...m.entries()].map(([name, v]) => ({ name, clicks: v.clicks, kategorie: v.kategorie })).sort((a, b) => b.clicks - a.clicks).slice(0, 10);
  }, [daily]);

  const drinkSubcatTotals = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of daily) {
      const o = r.beverage_subcategory_clicks ?? {};
      for (const [k, v] of Object.entries(o)) {
        m[k] = (m[k] ?? 0) + (typeof v === "number" ? v : 0);
      }
    }
    const total = Object.values(m).reduce((s, v) => s + v, 0);
    const rows = Object.keys(DRINK_SUBCAT_LABELS).map((k) => {
      const value = m[k] ?? 0;
      const pct = total > 0 ? Math.round((value / total) * 100) : 0;
      return { key: k, label: DRINK_SUBCAT_LABELS[k], color: DRINK_SUBCAT_COLOR[k], value, pct };
    });
    return { rows, total };
  }, [daily]);

  // Sektion 4: Menu Performance — top_items gesamt + category_clicks
  const topItems = useMemo(() => {
    const m = new Map<string, { clicks: number; price: number | null; kategorie: string }>();
    for (const r of daily) {
      for (const it of r.top_items ?? []) {
        const cur = m.get(it.name) ?? { clicks: 0, price: it.price ?? null, kategorie: it.kategorie ?? "—" };
        cur.clicks += it.clicks ?? 0;
        if (cur.price == null && typeof it.price === "number") cur.price = it.price;
        m.set(it.name, cur);
      }
    }
    return [...m.entries()].map(([name, v]) => ({ name, clicks: v.clicks, price: v.price, kategorie: v.kategorie })).sort((a, b) => b.clicks - a.clicks).slice(0, 10);
  }, [daily]);

  const categoryTop = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of daily) {
      const o = r.category_clicks ?? {};
      for (const [k, v] of Object.entries(o)) {
        m[k] = (m[k] ?? 0) + (typeof v === "number" ? v : 0);
      }
    }
    return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [daily]);

  // Sektion 6: Besucher-Insights — aus scan_events 7d
  const insights = useMemo(() => {
    const sessions = new Map<string, { hasItemDetail: boolean; duration: number; returnVisit: boolean; bounced: boolean }>();
    for (const e of scanEvents7d) {
      const sid = e.session_id?.trim();
      if (!sid) continue;
      const cur = sessions.get(sid) ?? { hasItemDetail: false, duration: 0, returnVisit: false, bounced: false };
      if (e.event_type === "item_detail") cur.hasItemDetail = true;
      if (e.event_type === "session_end") {
        const dur = e.session_duration ?? e.duration_seconds ?? 0;
        if (typeof dur === "number" && dur > cur.duration) cur.duration = dur;
      }
      if (e.event_type === "bounce") cur.bounced = true;
      if (e.return_visit === true) cur.returnVisit = true;
      sessions.set(sid, cur);
    }
    const total = sessions.size;
    if (total === 0) {
      return { bounceRate: 0, avgDuration: 0, returnRate: 0, total };
    }
    let bounced = 0;
    let durSum = 0;
    let durCount = 0;
    let returns = 0;
    for (const v of sessions.values()) {
      if (v.bounced || !v.hasItemDetail) bounced += 1;
      if (v.duration > 0) {
        durSum += v.duration;
        durCount += 1;
      }
      if (v.returnVisit) returns += 1;
    }
    return {
      bounceRate: Math.round((bounced / total) * 100),
      avgDuration: durCount > 0 ? durSum / durCount : 0,
      returnRate: Math.round((returns / total) * 100),
      total,
    };
  }, [scanEvents7d]);

  // Peak-Tag (Wochentag mit meisten Scans) — aus daily
  const peakWeekday = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0, 0, 0]; // So..Sa
    for (const r of daily) {
      const d = new Date(`${r.day_berlin}T00:00:00Z`);
      const w = d.getUTCDay();
      buckets[w] += r.scan_count ?? 0;
    }
    let maxIdx = 0;
    for (let i = 1; i < 7; i++) {
      if (buckets[i] > buckets[maxIdx]) maxIdx = i;
    }
    return { label: WEEKDAY_DE[maxIdx], count: buckets[maxIdx] };
  }, [daily]);

  // Sektion 8: Werbepartner-Kennzahlen
  const dominantDrink = useMemo(() => {
    const top = drinkSubcatTotals.rows.reduce((best, r) => (r.value > best.value ? r : best), { key: "", label: "—", color: "#6b7280", value: 0, pct: 0 });
    return top.value > 0 ? top : null;
  }, [drinkSubcatTotals]);

  const peakSlot = useMemo(() => {
    // Aus scans_morning/midday/evening/night + Peak-Wochentag
    const slots = [
      { name: "Morgens", value: tageszeit.morgen, range: "06:00–11:00" },
      { name: "Mittags", value: tageszeit.mittag, range: "11:00–15:00" },
      { name: "Abends", value: tageszeit.abend, range: "15:00–22:00" },
      { name: "Nachts", value: tageszeit.nacht, range: "22:00–06:00" },
    ];
    const best = slots.reduce((a, b) => (b.value > a.value ? b : a), slots[0]);
    return `${peakWeekday.label} ${best.range}`;
  }, [tageszeit, peakWeekday]);

  const consentRate = totalSessions > 0 ? Math.round((totalConsent / totalSessions) * 100) : 0;
  const consentQuality = consentRate >= 60 ? "Hohe" : consentRate >= 30 ? "Mittlere" : "Niedrige";

  // CSV-Export
  function handleExport() {
    const rows: string[][] = [["Datum", "Scans", "Unique Sessions", "Top Item", "Beverage Clicks"]];
    for (const r of daily) {
      const top = (r.top_items ?? [])[0]?.name ?? "";
      const bevSum = Object.values(r.beverage_subcategory_clicks ?? {}).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
      rows.push([r.day_berlin, String(r.scan_count ?? 0), String(r.sessions_count ?? 0), top, String(bevSum)]);
    }
    downloadCsv(`qrave-analytics-${restaurant.id.slice(0, 8)}-${todayIso}.csv`, rows);
  }

  const isLive = restaurant.published !== false && restaurant.aktiv !== false;

  return (
    <div style={{ color: "#f2f2f2" }}>
      {/* TOPBAR — volle Shell-Breite, kein max-width */}
      <div
        className="sticky top-0 z-10 mb-5 backdrop-blur"
        style={{ background: "rgba(6,4,14,0.9)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center gap-2 px-4 py-3 sm:gap-3 md:px-6">
          <Link
            href="/founder"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-[12px] font-semibold transition sm:px-3"
            style={{
              borderColor: "color-mix(in srgb, var(--qrave-accent) 30%, transparent)",
              background: "color-mix(in srgb, var(--qrave-accent) 12%, transparent)",
              color: "var(--qrave-accent-soft)",
            }}
            aria-label="Zurück zu Restaurants"
          >
            <i className="fa-solid fa-arrow-left text-[11px]" />
            <span className="hidden sm:inline">Restaurants</span>
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="qrave-font-display min-w-0 truncate text-[16px] font-black tracking-tight sm:text-[18px] md:text-[22px]">
                {restaurant.name}
              </h1>
              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-[3px] text-[10px] font-bold uppercase tracking-wider sm:px-2.5"
                style={
                  isLive
                    ? { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80" }
                    : { background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.25)", color: "#fb923c" }
                }
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: isLive ? "#4ade80" : "#fb923c" }} />
                {isLive ? "Live" : "Pending"}
              </span>
            </div>
            <div
              className="mt-0.5 truncate text-[11px]"
              style={{ color: "rgba(242,242,242,0.5)" }}
            >
              {[restaurant.cuisine_type, restaurant.stadtbezirk, restaurant.restaurant_typ].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
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
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[11px] font-bold sm:px-3"
              style={{
                background: "var(--qrave-accent-gradient)",
                color: "#fff",
                boxShadow: "0 6px 20px rgba(147,51,234,0.4)",
              }}
              aria-label="Export CSV"
            >
              <i className="fa-solid fa-download text-[10px]" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content-Wrapper — max-width 1280, zentriert, responsives Padding */}
      <div className="mx-auto w-full max-w-[1280px] space-y-4 px-4 pb-6 md:px-6">
        {/* 1. SCANS PRO TAG */}
        <Card>
          <SectionLabel>Scans pro Tag</SectionLabel>
          <div className="qrave-font-display mt-1 mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-[24px] font-black leading-none tracking-[-1px] sm:text-[32px] sm:tracking-[-1.5px]">
              {fmt(totalScans)}
            </span>
            <span className="text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
              {fmt(totalSessions)} unique Sessions · {bounds.days} {bounds.days === 1 ? "Tag" : "Tage"}
            </span>
          </div>
          <LineChart
            data={series.map((s) => {
              const [, m, d] = s.day.split("-");
              return { label: `${parseInt(d, 10)}.${parseInt(m, 10)}.`, value: s.scans };
            })}
            emptyLabel="Keine Scans im Zeitraum."
          />
        </Card>

        {/* 2. SCANS NACH TAGESZEIT */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <TageszeitCard label="Morgen" sub="06:00–11:00" value={tageszeit.morgen} color="#3b82f6" max={tageszeitMax} />
          <TageszeitCard label="Mittag" sub="11:00–15:00" value={tageszeit.mittag} color="#eab308" max={tageszeitMax} />
          <TageszeitCard label="Abend" sub="15:00–22:00" value={tageszeit.abend} color="#9333ea" max={tageszeitMax} />
          <TageszeitCard label="Nacht" sub="22:00–06:00" value={tageszeit.nacht} color="#6b7280" max={tageszeitMax} />
        </div>

        {/* 3. GETRÄNKE-PERFORMANCE */}
        <Card>
          <SectionLabel>Getränke-Performance</SectionLabel>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <div className="qrave-font-display mb-3 text-[13px] font-bold">Top 10 Getränke</div>
              {drinkTop.length === 0 ? (
                <p className="text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                  Keine Getränke-Klicks im Zeitraum.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {drinkTop.map((d, i) => (
                    <li
                      key={`${d.name}-${i}`}
                      className="flex items-center gap-3 rounded-[10px] border px-3 py-2"
                      style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}
                    >
                      <span className="qrave-font-display w-5 text-[11px] font-bold" style={{ color: "rgba(242,242,242,0.32)" }}>
                        #{i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold">{d.name}</div>
                        <div className="text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                          {d.kategorie}
                        </div>
                      </div>
                      <div className="qrave-font-display shrink-0 text-[13px] font-bold" style={{ color: "var(--qrave-accent-strong)" }}>
                        {fmt(d.clicks)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="qrave-font-display mb-3 text-[13px] font-bold">Verteilung nach Subkategorie</div>
              {drinkSubcatTotals.total === 0 ? (
                <p className="text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                  Keine Subkategorie-Daten im Zeitraum.
                </p>
              ) : (
                <ul className="space-y-2">
                  {drinkSubcatTotals.rows.map((row) => (
                    <li key={row.key} className="flex items-center gap-3">
                      <span className="w-[80px] shrink-0 text-[12px] font-medium" style={{ color: "rgba(242,242,242,0.85)" }}>
                        {row.label}
                      </span>
                      <div className="h-[8px] flex-1 overflow-hidden rounded-[3px]" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-[3px] transition-all"
                          style={{
                            width: `${row.pct}%`,
                            background: row.color,
                            opacity: row.value > 0 ? 1 : 0.2,
                          }}
                        />
                      </div>
                      <span className="qrave-font-display w-[80px] shrink-0 text-right text-[12px] font-bold" style={{ color: "rgba(242,242,242,0.7)" }}>
                        {fmt(row.value)} · {row.pct}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>

        {/* 4. MENU PERFORMANCE */}
        <Card>
          <SectionLabel>Menu Performance</SectionLabel>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <div className="qrave-font-display mb-3 text-[13px] font-bold">Meistgeklickte Gerichte</div>
              {topItems.length === 0 ? (
                <p className="text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                  Keine Klick-Daten im Zeitraum.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {topItems.map((it, i) => (
                    <li
                      key={`${it.name}-${i}`}
                      className="flex items-center gap-3 rounded-[10px] border px-3 py-2"
                      style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}
                    >
                      <span className="qrave-font-display w-5 text-[11px] font-bold" style={{ color: "rgba(242,242,242,0.32)" }}>
                        #{i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold">{it.name}</div>
                        <div className="text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                          {it.kategorie}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="qrave-font-display text-[13px] font-bold" style={{ color: "var(--qrave-accent-strong)" }}>
                          {fmt(it.clicks)}
                        </div>
                        <div className="text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                          {typeof it.price === "number" && it.price > 0 ? `${it.price.toFixed(2)} €` : "—"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="qrave-font-display mb-3 text-[13px] font-bold">Meistbesuchte Kategorien</div>
              {categoryTop.length === 0 ? (
                <p className="text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                  Keine Kategorie-Daten im Zeitraum.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {categoryTop.map((c, i) => (
                    <li
                      key={`${c.name}-${i}`}
                      className="flex items-center gap-3 rounded-[10px] border px-3 py-2"
                      style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}
                    >
                      <span className="qrave-font-display w-5 text-[11px] font-bold" style={{ color: "rgba(242,242,242,0.32)" }}>
                        #{i + 1}
                      </span>
                      <div className="min-w-0 flex-1 truncate text-[13px] font-semibold">{c.name}</div>
                      <div className="qrave-font-display shrink-0 text-[13px] font-bold" style={{ color: "var(--qrave-accent-strong)" }}>
                        {fmt(c.count)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>

        {/* 5. DIÄT & PREIS */}
        <Card>
          <SectionLabel>Diät &amp; Preis</SectionLabel>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <BigStat label="Vegane Items angeklickt" value={fmt(totalVegan)} hint={totalItemDetail > 0 ? `${Math.round((totalVegan / totalItemDetail) * 100)}% aller Klicks` : null} />
            <BigStat label="Vegetarische Items angeklickt" value={fmt(totalVegetarian)} hint={totalItemDetail > 0 ? `${Math.round((totalVegetarian / totalItemDetail) * 100)}% aller Klicks` : null} />
            <BigStat label="Ø Preis angeklickter Items" value={avgPrice > 0 ? `${avgPrice.toFixed(2)} €` : "—"} hint={`Über ${bounds.days} ${bounds.days === 1 ? "Tag" : "Tage"}`} />
          </div>
        </Card>

        {/* 6. BESUCHER-INSIGHTS */}
        <Card>
          <SectionLabel>Besucher-Insights</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
            <InsightStat
              label="Bounce-Rate"
              value={`${insights.bounceRate}%`}
              hint="Sessions ohne Item-Klick"
              color={insights.bounceRate > 50 ? "#f87171" : "#f2f2f2"}
            />
            <InsightStat
              label="Ø Session-Dauer"
              value={fmtDuration(insights.avgDuration)}
              hint="Aus session_end-Events"
              color="#f2f2f2"
            />
            <InsightStat
              label="Wiederkehrerrate"
              value={`${insights.returnRate}%`}
              hint="return_visit=true"
              color="#4ade80"
            />
            <InsightStat
              label="Peak-Tag"
              value={peakWeekday.label}
              hint={`${fmt(peakWeekday.count)} Scans`}
              color="var(--qrave-accent-strong)"
            />
          </div>
          <div className="mt-3 text-[11px]" style={{ color: "rgba(242,242,242,0.4)" }}>
            Bounce/Dauer/Wiederkehrer aus den letzten 7 Tagen scan_events ({insights.total} Sessions).
          </div>
        </Card>

        {/* 7. CONSENT-FUNNEL */}
        <Card>
          <SectionLabel>Consent-Funnel</SectionLabel>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:gap-3">
            <BigStat label="Besucher gesamt" value={fmt(totalSessions)} hint={null} />
            <BigStat label="Mit Consent" value={fmt(totalConsent)} hint={`${consentRate}% Quote`} />
            <BigStat label="Ohne Consent" value={fmt(Math.max(0, totalSessions - totalConsent))} hint={null} />
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px]" style={{ color: "rgba(242,242,242,0.55)" }}>
              <span>Consent-Rate</span>
              <span className="qrave-font-display font-bold" style={{ color: "var(--qrave-accent-soft)" }}>
                {consentRate}%
              </span>
            </div>
            <div className="h-[10px] overflow-hidden rounded-[3px]" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-[3px]"
                style={{
                  width: `${consentRate}%`,
                  background: "var(--qrave-accent-gradient)",
                  boxShadow: "0 0 12px rgba(147,51,234,0.5)",
                }}
              />
            </div>
          </div>
        </Card>

        {/* 8. WERBEPARTNER-KENNZAHLEN */}
        <Card>
          <SectionLabel>Werbepartner-Kennzahlen</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
            <BigStat
              label="Dominante Drink-Kategorie"
              value={dominantDrink ? dominantDrink.label : "—"}
              hint={dominantDrink ? `${fmt(dominantDrink.value)} Klicks · ${dominantDrink.pct}%` : "Keine Daten"}
            />
            <BigStat
              label="Peak-Slot"
              value={peakSlot}
              hint="Wochentag · Tagesabschnitt"
            />
            <BigStat
              label="Impressionen"
              value={fmt(totalItemDetail)}
              hint="item_detail-Events"
            />
            <BigStat
              label="Consent-Qualität"
              value={`${consentQuality}`}
              hint={`${consentRate}% Quote`}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-4 py-4 sm:px-6 sm:py-5"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="qrave-font-display"
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "#9333ea",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function BigStat({ label, value, hint }: { label: string; value: string; hint: string | null }) {
  return (
    <div className="rounded-[10px] border px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="mb-1.5 text-[11px] uppercase tracking-[0.08em]" style={{ color: "rgba(242,242,242,0.5)" }}>
        {label}
      </div>
      <div className="qrave-font-display text-[24px] font-black leading-none tracking-[-1px]" style={{ color: "var(--qrave-accent-soft)" }}>
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function InsightStat({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <div className="rounded-[10px] border px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="mb-1.5 text-[11px] uppercase tracking-[0.08em]" style={{ color: "rgba(242,242,242,0.5)" }}>
        {label}
      </div>
      <div className="qrave-font-display text-[24px] font-black leading-none tracking-[-1px]" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
        {hint}
      </div>
    </div>
  );
}

function TageszeitCard({ label, sub, value, color, max }: { label: string; sub: string; value: number; color: string; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      <div className="text-[11px] uppercase tracking-[0.08em]" style={{ color: "rgba(242,242,242,0.55)" }}>
        {label}
      </div>
      <div className="text-[11px]" style={{ color: "rgba(242,242,242,0.4)" }}>
        {sub}
      </div>
      <div
        className="qrave-font-display mt-2 mb-3 leading-none"
        style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-1.5px", color }}
      >
        {fmt(value)}
      </div>
      <div className="h-[3px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

