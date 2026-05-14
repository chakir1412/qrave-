"use client";

import { useMemo, useState } from "react";
import type { FounderAnalyticsDailyRow, FounderMenuItem, FounderRestaurantRow } from "@/lib/founder-types";
import { Hint } from "@/components/dashboard/Hint";

type Range = "7d" | "30d" | "custom";
type Section = "marken" | "speisen" | "diaet";
type SortMode = "clicks" | "restaurants" | "name" | "price";

type Props = {
  restaurants: FounderRestaurantRow[];
  analyticsDaily30d: FounderAnalyticsDailyRow[];
  allMenuItems: FounderMenuItem[];
};

const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: "marken", label: "Getränke-Marken", icon: "fa-solid fa-mug-hot" },
  { key: "speisen", label: "Speisen-Performance", icon: "fa-solid fa-utensils" },
  { key: "diaet", label: "Diät & Ernährung", icon: "fa-solid fa-seedling" },
];

const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: "7d", label: "7 Tage" },
  { key: "30d", label: "30 Tage" },
  { key: "custom", label: "Benutzerdef." },
];

/** Marken-Patterns (case-insensitive Match auf menu_item.name). */
const BRAND_PATTERNS: { brand: string; patterns: string[] }[] = [
  { brand: "Heineken", patterns: ["heineken"] },
  { brand: "Becks", patterns: ["beck's", "becks"] },
  { brand: "Bitburger", patterns: ["bitburger"] },
  { brand: "Krombacher", patterns: ["krombacher"] },
  { brand: "Warsteiner", patterns: ["warsteiner"] },
  { brand: "Paulaner", patterns: ["paulaner"] },
  { brand: "Erdinger", patterns: ["erdinger"] },
  { brand: "Augustiner", patterns: ["augustiner"] },
  { brand: "Coca-Cola", patterns: ["coca-cola", "coca cola", "cola"] },
  { brand: "Fanta", patterns: ["fanta"] },
  { brand: "Sprite", patterns: ["sprite"] },
  { brand: "Red Bull", patterns: ["red bull", "redbull"] },
  { brand: "Apfelwein Possmann", patterns: ["possmann"] },
  { brand: "Aperol", patterns: ["aperol"] },
  { brand: "Campari", patterns: ["campari"] },
  { brand: "Lillet", patterns: ["lillet"] },
];

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

function brandOfItem(name: string): string | null {
  const n = name.toLowerCase();
  for (const { brand, patterns } of BRAND_PATTERNS) {
    if (patterns.some((p) => n.includes(p))) return brand;
  }
  return null;
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

export function ProduktTabV2({ restaurants, analyticsDaily30d, allMenuItems }: Props) {
  const [section, setSection] = useState<Section>("marken");
  const [range, setRange] = useState<Range>("30d");
  const today = todayBerlinIso();
  const [customFrom, setCustomFrom] = useState<string>(shiftIso(today, -29));
  const [customTo, setCustomTo] = useState<string>(today);

  const rangeBounds = useMemo(() => {
    if (range === "7d") return { from: shiftIso(today, -6), to: today };
    if (range === "30d") return { from: shiftIso(today, -29), to: today };
    return { from: customFrom, to: customTo };
  }, [range, today, customFrom, customTo]);

  const restaurantById = useMemo(() => {
    const m = new Map<string, FounderRestaurantRow>();
    for (const r of restaurants) m.set(r.id, r);
    return m;
  }, [restaurants]);

  const dailyInRange = useMemo(
    () =>
      analyticsDaily30d.filter(
        (r) => r.day_berlin >= rangeBounds.from && r.day_berlin <= rangeBounds.to,
      ),
    [analyticsDaily30d, rangeBounds.from, rangeBounds.to],
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="qrave-font-display text-[22px] font-black leading-tight tracking-tight">
            <span style={{ color: "var(--qrave-accent-strong)" }}>Produkte</span> & Marken-Insights
          </h2>
          <p className="mt-1 text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
            Aggregierte Daten über alle Restaurants im Zeitraum {rangeBounds.from} bis {rangeBounds.to}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {RANGE_OPTIONS.map((opt) => {
              const active = range === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRange(opt.key)}
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
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-[8px] border bg-transparent px-2 py-1.5 text-[11px]"
                style={{ borderColor: "rgba(255,255,255,0.08)", color: "#f2f2f2" }}
              />
              <span>bis</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-[8px] border bg-transparent px-2 py-1.5 text-[11px]"
                style={{ borderColor: "rgba(255,255,255,0.08)", color: "#f2f2f2" }}
              />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              exportAll({ allMenuItems, dailyInRange, restaurantById, range: rangeBounds });
            }}
            className="inline-flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-[11px] font-bold"
            style={{
              background: "var(--qrave-accent-gradient)",
              color: "#fff",
              boxShadow: "0 6px 20px rgba(29,78,216,0.4)",
            }}
          >
            <i className="fa-solid fa-download text-[10px]" />
            Alles exportieren
          </button>
        </div>
      </header>

      {/* Sektion-Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => {
          const active = section === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              className="inline-flex items-center gap-2 rounded-[10px] border px-3.5 py-2 text-[12px] font-semibold transition"
              style={
                active
                  ? {
                      borderColor: "color-mix(in srgb, var(--qrave-accent) 40%, transparent)",
                      background: "color-mix(in srgb, var(--qrave-accent) 18%, transparent)",
                      color: "var(--qrave-accent-soft)",
                    }
                  : {
                      borderColor: "rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)",
                      color: "rgba(242,242,242,0.7)",
                    }
              }
            >
              <i className={`${s.icon} text-[12px]`} />
              {s.label}
            </button>
          );
        })}
      </div>

      {section === "marken" ? (
        <MarkenSection
          allMenuItems={allMenuItems}
          dailyInRange={dailyInRange}
          rangeBounds={rangeBounds}
        />
      ) : null}
      {section === "speisen" ? (
        <SpeisenSection allMenuItems={allMenuItems} dailyInRange={dailyInRange} />
      ) : null}
      {section === "diaet" ? (
        <DiaetSection dailyInRange={dailyInRange} range={rangeBounds} />
      ) : null}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-[16px] p-[22px]"
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

function SectionHeader({
  title,
  hint,
  onExport,
}: {
  title: string;
  hint: string;
  onExport: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="qrave-font-display flex items-center gap-2 text-[15px] font-bold">
        {title}
        <Hint text={hint} />
      </div>
      <button
        type="button"
        onClick={onExport}
        className="inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[11px] font-semibold"
        style={{
          borderColor: "color-mix(in srgb, var(--qrave-accent) 30%, transparent)",
          background: "color-mix(in srgb, var(--qrave-accent) 10%, transparent)",
          color: "var(--qrave-accent-soft)",
        }}
      >
        <i className="fa-solid fa-download text-[10px]" />
        CSV
      </button>
    </div>
  );
}

// ─── MARKEN ──────────────────────────────────────────────────────────────

function MarkenSection({
  allMenuItems,
  dailyInRange,
  rangeBounds,
}: {
  allMenuItems: FounderMenuItem[];
  dailyInRange: FounderAnalyticsDailyRow[];
  rangeBounds: { from: string; to: string };
}) {
  const [sortMode, setSortMode] = useState<"clicks" | "restaurants" | "name">("clicks");

  // Pro Marke: Set von restaurant-IDs wo sie als menu_item existiert
  const brandsByRestaurant = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const item of allMenuItems) {
      const brand = brandOfItem(item.name);
      if (!brand) continue;
      let s = m.get(brand);
      if (!s) {
        s = new Set();
        m.set(brand, s);
      }
      s.add(item.restaurant_id);
    }
    return m;
  }, [allMenuItems]);

  // beverage_subcategory_clicks pro Marke aufschlüsseln: Mapping Marke → Subcategory-Key
  const BRAND_TO_SUBCAT: Record<string, string> = {
    Heineken: "bier",
    Becks: "bier",
    Bitburger: "bier",
    Krombacher: "bier",
    Warsteiner: "bier",
    Paulaner: "bier",
    Erdinger: "bier",
    Augustiner: "bier",
    "Coca-Cola": "softdrinks",
    Fanta: "softdrinks",
    Sprite: "softdrinks",
    "Red Bull": "energy",
    "Apfelwein Possmann": "sonstiges_getraenk",
    Aperol: "cocktails",
    Campari: "cocktails",
    Lillet: "cocktails",
  };

  // Klicks aus beverage_subcategory_clicks aggregiert nach Subcat über alle Restaurants im Zeitraum.
  // Plus aus top_items: matche Item-Namen gegen Marken-Patterns.
  const stats = useMemo(() => {
    const todayIso = todayBerlinIso();
    const weekFromIso = shiftIso(todayIso, -6);
    const subcatTotal = new Map<string, number>();
    const subcatWeek = new Map<string, number>();
    const brandFromTop = new Map<string, number>();
    const brandFromTopWeek = new Map<string, number>();

    for (const r of dailyInRange) {
      const sub = r.beverage_subcategory_clicks ?? {};
      for (const [k, v] of Object.entries(sub)) {
        const n = typeof v === "number" ? v : 0;
        subcatTotal.set(k, (subcatTotal.get(k) ?? 0) + n);
        if (r.day_berlin >= weekFromIso) subcatWeek.set(k, (subcatWeek.get(k) ?? 0) + n);
      }
      const ti = r.top_items ?? [];
      for (const it of ti) {
        const brand = brandOfItem(it.name);
        if (!brand) continue;
        brandFromTop.set(brand, (brandFromTop.get(brand) ?? 0) + (it.clicks ?? 0));
        if (r.day_berlin >= weekFromIso) {
          brandFromTopWeek.set(brand, (brandFromTopWeek.get(brand) ?? 0) + (it.clicks ?? 0));
        }
      }
    }

    const brands = new Set([...brandsByRestaurant.keys(), ...brandFromTop.keys()]);
    const rows = [...brands].map((brand) => {
      const restaurantCount = brandsByRestaurant.get(brand)?.size ?? 0;
      // Klicks: primär aus top_items (item-spezifisch). Wenn 0, Fallback auf
      // Sub-Kategorie über alle Restaurants × Marken-Anteil (rough).
      const fromTop = brandFromTop.get(brand) ?? 0;
      const fromTopWeek = brandFromTopWeek.get(brand) ?? 0;
      let clicks = fromTop;
      let clicksWeek = fromTopWeek;
      if (clicks === 0) {
        const subcatKey = BRAND_TO_SUBCAT[brand];
        if (subcatKey) {
          // Naive Aufteilung: subcat clicks / unique-brands-in-subcat
          const brandsInSubcat = [...brands].filter((b) => BRAND_TO_SUBCAT[b] === subcatKey).length || 1;
          clicks = Math.round((subcatTotal.get(subcatKey) ?? 0) / brandsInSubcat);
          clicksWeek = Math.round((subcatWeek.get(subcatKey) ?? 0) / brandsInSubcat);
        }
      }
      return {
        brand,
        restaurantCount,
        clicks,
        clicksWeek,
        trend: clicksWeek > clicks / 4 ? "up" : "flat",
      };
    });

    return rows.filter((r) => r.restaurantCount > 0 || r.clicks > 0);
  }, [brandsByRestaurant, dailyInRange]);

  const sorted = useMemo(() => {
    const copy = [...stats];
    if (sortMode === "clicks") copy.sort((a, b) => b.clicks - a.clicks);
    else if (sortMode === "restaurants") copy.sort((a, b) => b.restaurantCount - a.restaurantCount);
    else copy.sort((a, b) => a.brand.localeCompare(b.brand, "de"));
    return copy;
  }, [stats, sortMode]);

  function handleExport() {
    const rows: string[][] = [["Marke", "Restaurants", "Klicks gesamt", "Klicks/Woche", "Zeitraum"]];
    for (const r of sorted) {
      rows.push([r.brand, String(r.restaurantCount), String(r.clicks), String(r.clicksWeek), `${rangeBounds.from} – ${rangeBounds.to}`]);
    }
    downloadCsv(`qrave-getraenke-marken-${todayBerlinIso()}.csv`, rows);
  }

  return (
    <Card>
      <SectionHeader
        title="Getränke-Marken"
        hint="Aggregiert aus menu_items (Marken-Patterns) + restaurant_analytics_daily.beverage_subcategory_clicks + top_items. Klicks aus top_items haben Priorität; fallen die aus, werden Sub-Kategorie-Klicks naiv durch Marken-Anzahl geteilt."
        onExport={handleExport}
      />
      <div className="mb-3 flex gap-1.5">
        {(
          [
            ["clicks", "Nach Klicks"],
            ["restaurants", "Nach Restaurants"],
            ["name", "Alphabetisch"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setSortMode(k)}
            className="rounded-[7px] border px-2.5 py-1 text-[11px] font-semibold"
            style={
              sortMode === k
                ? {
                    borderColor: "color-mix(in srgb, var(--qrave-accent) 40%, transparent)",
                    background: "color-mix(in srgb, var(--qrave-accent) 18%, transparent)",
                    color: "var(--qrave-accent-soft)",
                  }
                : {
                    borderColor: "rgba(255,255,255,0.08)",
                    background: "transparent",
                    color: "rgba(242,242,242,0.5)",
                  }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
          Keine Marken-Daten im gewählten Zeitraum.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((r) => (
            <li
              key={r.brand}
              className="flex items-center gap-3 rounded-[11px] border px-3.5 py-2.5"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">{r.brand}</div>
                <div className="text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                  in {r.restaurantCount} {r.restaurantCount === 1 ? "Restaurant" : "Restaurants"}
                </div>
              </div>
              <div className="text-right">
                <div className="qrave-font-display text-[14px] font-bold">
                  {r.clicks.toLocaleString("de-DE")}
                  {r.trend === "up" ? (
                    <i className="fa-solid fa-arrow-trend-up ml-1.5 text-[11px]" style={{ color: "#4ade80" }} />
                  ) : null}
                </div>
                <div className="text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                  {r.clicksWeek.toLocaleString("de-DE")} diese Woche
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── SPEISEN ─────────────────────────────────────────────────────────────

function SpeisenSection({
  allMenuItems,
  dailyInRange,
}: {
  allMenuItems: FounderMenuItem[];
  dailyInRange: FounderAnalyticsDailyRow[];
}) {
  const [sortMode, setSortMode] = useState<SortMode>("clicks");

  const stats = useMemo(() => {
    type S = { name: string; kategorie: string; clicks: number; prices: number[]; restaurants: Set<string> };
    const byName = new Map<string, S>();

    // Items pro Name → Kategorien + Preise + Restaurants
    for (const it of allMenuItems) {
      const key = it.name;
      let s = byName.get(key);
      if (!s) {
        s = { name: it.name, kategorie: it.kategorie || "—", clicks: 0, prices: [], restaurants: new Set() };
        byName.set(key, s);
      }
      s.restaurants.add(it.restaurant_id);
      if (typeof it.preis === "number" && Number.isFinite(it.preis) && it.preis > 0) s.prices.push(it.preis);
    }

    // Klicks aus top_items aggregieren
    for (const r of dailyInRange) {
      const ti = r.top_items ?? [];
      for (const it of ti) {
        const s = byName.get(it.name);
        if (!s) continue;
        s.clicks += it.clicks ?? 0;
      }
    }

    const rows = [...byName.values()].map((s) => ({
      name: s.name,
      kategorie: s.kategorie,
      clicks: s.clicks,
      avgPrice: s.prices.length > 0 ? s.prices.reduce((a, b) => a + b, 0) / s.prices.length : 0,
      restaurants: s.restaurants.size,
    }));
    return rows.filter((r) => r.clicks > 0).slice(0, 200);
  }, [allMenuItems, dailyInRange]);

  const sorted = useMemo(() => {
    const copy = [...stats];
    if (sortMode === "clicks") copy.sort((a, b) => b.clicks - a.clicks);
    else if (sortMode === "price") copy.sort((a, b) => b.avgPrice - a.avgPrice);
    else if (sortMode === "restaurants") copy.sort((a, b) => b.restaurants - a.restaurants);
    else copy.sort((a, b) => a.name.localeCompare(b.name, "de"));
    return copy.slice(0, 20);
  }, [stats, sortMode]);

  function handleExport() {
    const rows: string[][] = [["Item", "Kategorie", "Klicks", "Ø Preis (€)", "Restaurants"]];
    for (const r of sorted) {
      rows.push([r.name, r.kategorie, String(r.clicks), r.avgPrice.toFixed(2), String(r.restaurants)]);
    }
    downloadCsv(`qrave-speisen-performance-${todayBerlinIso()}.csv`, rows);
  }

  return (
    <Card>
      <SectionHeader
        title="Speisen-Performance · Top 20"
        hint="Aggregiert aus restaurant_analytics_daily.top_items über alle Restaurants im Zeitraum. Klicks = item_detail-Events (Modal-Open). Ø Preis aus menu_items (gleichnamige Items pro Restaurant gemittelt)."
        onExport={handleExport}
      />
      <div className="mb-3 flex gap-1.5">
        {(
          [
            ["clicks", "Klicks"],
            ["price", "Preis"],
            ["restaurants", "Restaurants"],
            ["name", "Name"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setSortMode(k)}
            className="rounded-[7px] border px-2.5 py-1 text-[11px] font-semibold"
            style={
              sortMode === k
                ? {
                    borderColor: "color-mix(in srgb, var(--qrave-accent) 40%, transparent)",
                    background: "color-mix(in srgb, var(--qrave-accent) 18%, transparent)",
                    color: "var(--qrave-accent-soft)",
                  }
                : {
                    borderColor: "rgba(255,255,255,0.08)",
                    background: "transparent",
                    color: "rgba(242,242,242,0.5)",
                  }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
          Keine Klick-Daten im gewählten Zeitraum.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((r, i) => (
            <li
              key={`${r.name}-${i}`}
              className="flex items-center gap-3 rounded-[11px] border px-3.5 py-2.5"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}
            >
              <span
                className="qrave-font-display w-6 text-[11px] font-bold"
                style={{ color: "rgba(242,242,242,0.32)" }}
              >
                #{i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{r.name}</div>
                <div className="text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                  {r.kategorie} · in {r.restaurants} {r.restaurants === 1 ? "Restaurant" : "Restaurants"}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="qrave-font-display text-[14px] font-bold">{r.clicks.toLocaleString("de-DE")}</div>
                <div className="text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                  Ø {r.avgPrice.toFixed(2)} €
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── DIÄT ────────────────────────────────────────────────────────────────

function DiaetSection({
  dailyInRange,
  range,
}: {
  dailyInRange: FounderAnalyticsDailyRow[];
  range: { from: string; to: string };
}) {
  const aggregated = useMemo(() => {
    let vegan = 0;
    let vegetarian = 0;
    let totalItem = 0;
    // Tagesreihe für Chart
    const byDay = new Map<string, { vegan: number; vegetarian: number; total: number }>();
    for (const r of dailyInRange) {
      const v = r.vegan_clicks ?? 0;
      const veg = r.vegetarian_clicks ?? 0;
      const item = r.item_detail_count ?? 0;
      vegan += v;
      vegetarian += veg;
      totalItem += item;
      const cur = byDay.get(r.day_berlin) ?? { vegan: 0, vegetarian: 0, total: 0 };
      cur.vegan += v;
      cur.vegetarian += veg;
      cur.total += item;
      byDay.set(r.day_berlin, cur);
    }
    const veganPct = totalItem > 0 ? Math.round((vegan / totalItem) * 100) : 0;
    const vegetarianPct = totalItem > 0 ? Math.round((vegetarian / totalItem) * 100) : 0;

    // 30-Tage-Reihe (gleicher Zeitraum wie analyticsDaily30d)
    const series: { day: string; vegan: number; vegetarian: number; total: number }[] = [];
    const allDays = [...byDay.keys()].sort();
    for (const d of allDays) {
      const v = byDay.get(d)!;
      series.push({ day: d, vegan: v.vegan, vegetarian: v.vegetarian, total: v.total });
    }
    return { vegan, vegetarian, veganPct, vegetarianPct, totalItem, series };
  }, [dailyInRange]);

  function handleExport() {
    const rows: string[][] = [["Datum", "Vegan-Klicks", "Vegetarisch-Klicks", "Gesamt-Klicks"]];
    for (const s of aggregated.series) {
      rows.push([s.day, String(s.vegan), String(s.vegetarian), String(s.total)]);
    }
    downloadCsv(`qrave-diaet-trends-${todayBerlinIso()}.csv`, rows);
  }

  // Mini-Chart über die Reihe (vegan + vegetarisch)
  const W = 560;
  const H = 140;
  const maxY = Math.max(1, ...aggregated.series.map((s) => Math.max(s.vegan, s.vegetarian)));
  const stepX = aggregated.series.length > 1 ? W / (aggregated.series.length - 1) : W;
  function buildPath(values: number[]): string {
    if (values.length === 0) return "";
    return values
      .map((v, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(1)} ${(H - 6 - (v / maxY) * (H - 18)).toFixed(1)}`)
      .join(" ");
  }
  const veganPath = buildPath(aggregated.series.map((s) => s.vegan));
  const vegPath = buildPath(aggregated.series.map((s) => s.vegetarian));

  return (
    <Card>
      <SectionHeader
        title="Diät & Ernährungstrends"
        hint="Vegan-/Vegetarisch-Klicks aus restaurant_analytics_daily über alle Restaurants. Glutenfrei wird aktuell noch nicht aggregiert — kommt mit Cron-Erweiterung."
        onExport={handleExport}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <DiaetStat
          label="Vegan-Klicks"
          value={aggregated.vegan}
          pct={aggregated.veganPct}
          color="#4ade80"
          icon="fa-solid fa-seedling"
        />
        <DiaetStat
          label="Vegetarisch-Klicks"
          value={aggregated.vegetarian}
          pct={aggregated.vegetarianPct}
          color="#86efac"
          icon="fa-solid fa-leaf"
        />
        <DiaetStat
          label="Ges. Item-Klicks"
          value={aggregated.totalItem}
          pct={null}
          color="var(--qrave-accent-strong)"
          icon="fa-solid fa-eye"
        />
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(242,242,242,0.5)" }}>
          Trend · {range.from} – {range.to}
        </div>
        {aggregated.series.length === 0 ? (
          <p className="text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
            Keine Daten im Zeitraum.
          </p>
        ) : (
          <div className="relative h-[150px] w-full">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
              <path d={veganPath} fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d={vegPath} fill="none" stroke="#86efac" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 3" />
            </svg>
            <div className="mt-2 flex gap-4 text-[11px]" style={{ color: "rgba(242,242,242,0.6)" }}>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-3 rounded-full" style={{ background: "#4ade80" }} />
                Vegan
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-3 rounded-full"
                  style={{ background: "#86efac" }}
                />
                Vegetarisch
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function DiaetStat({
  label,
  value,
  pct,
  color,
  icon,
}: {
  label: string;
  value: number;
  pct: number | null;
  color: string;
  icon: string;
}) {
  return (
    <div
      className="rounded-[12px] border px-3.5 py-3"
      style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
        <i className={icon} style={{ color }} /> {label}
      </div>
      <div className="qrave-font-display text-[22px] font-black leading-none" style={{ color }}>
        {value.toLocaleString("de-DE")}
      </div>
      {pct != null ? (
        <div className="mt-1 text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
          {pct}% aller Item-Klicks
        </div>
      ) : null}
    </div>
  );
}

// ─── EXPORT-ALL ──────────────────────────────────────────────────────────

function exportAll(opts: {
  allMenuItems: FounderMenuItem[];
  dailyInRange: FounderAnalyticsDailyRow[];
  restaurantById: Map<string, FounderRestaurantRow>;
  range: { from: string; to: string };
}) {
  const t = todayBerlinIso();
  // Marken
  const brandRows: string[][] = [["Marke", "Restaurants", "Klicks gesamt", "Klicks/Woche", "Zeitraum"]];
  const brandsByRestaurant = new Map<string, Set<string>>();
  for (const it of opts.allMenuItems) {
    const b = brandOfItem(it.name);
    if (!b) continue;
    let s = brandsByRestaurant.get(b);
    if (!s) {
      s = new Set();
      brandsByRestaurant.set(b, s);
    }
    s.add(it.restaurant_id);
  }
  const brandClicks = new Map<string, number>();
  const brandClicksWeek = new Map<string, number>();
  const weekFromIso = shiftIso(t, -6);
  for (const r of opts.dailyInRange) {
    for (const it of r.top_items ?? []) {
      const b = brandOfItem(it.name);
      if (!b) continue;
      brandClicks.set(b, (brandClicks.get(b) ?? 0) + (it.clicks ?? 0));
      if (r.day_berlin >= weekFromIso) {
        brandClicksWeek.set(b, (brandClicksWeek.get(b) ?? 0) + (it.clicks ?? 0));
      }
    }
  }
  for (const [b, rs] of brandsByRestaurant.entries()) {
    brandRows.push([
      b,
      String(rs.size),
      String(brandClicks.get(b) ?? 0),
      String(brandClicksWeek.get(b) ?? 0),
      `${opts.range.from} – ${opts.range.to}`,
    ]);
  }
  downloadCsv(`qrave-getraenke-marken-${t}.csv`, brandRows);
  // Speisen, Diät
  const sRows: string[][] = [["Item", "Kategorie", "Klicks", "Ø Preis (€)", "Restaurants"]];
  const byName = new Map<string, { kat: string; clicks: number; prices: number[]; restaurants: Set<string> }>();
  for (const it of opts.allMenuItems) {
    let s = byName.get(it.name);
    if (!s) {
      s = { kat: it.kategorie || "—", clicks: 0, prices: [], restaurants: new Set() };
      byName.set(it.name, s);
    }
    s.restaurants.add(it.restaurant_id);
    if (typeof it.preis === "number" && Number.isFinite(it.preis) && it.preis > 0) s.prices.push(it.preis);
  }
  for (const r of opts.dailyInRange) {
    for (const it of r.top_items ?? []) {
      const s = byName.get(it.name);
      if (!s) continue;
      s.clicks += it.clicks ?? 0;
    }
  }
  const sortedSpeisen = [...byName.entries()]
    .filter(([, s]) => s.clicks > 0)
    .sort((a, b) => b[1].clicks - a[1].clicks)
    .slice(0, 50);
  for (const [name, s] of sortedSpeisen) {
    const avg = s.prices.length > 0 ? s.prices.reduce((a, b) => a + b, 0) / s.prices.length : 0;
    sRows.push([name, s.kat, String(s.clicks), avg.toFixed(2), String(s.restaurants.size)]);
  }
  downloadCsv(`qrave-speisen-performance-${t}.csv`, sRows);

  const dRows: string[][] = [["Datum", "Vegan-Klicks", "Vegetarisch-Klicks", "Gesamt-Klicks"]];
  const byDay = new Map<string, { v: number; ve: number; tot: number }>();
  for (const r of opts.dailyInRange) {
    const cur = byDay.get(r.day_berlin) ?? { v: 0, ve: 0, tot: 0 };
    cur.v += r.vegan_clicks ?? 0;
    cur.ve += r.vegetarian_clicks ?? 0;
    cur.tot += r.item_detail_count ?? 0;
    byDay.set(r.day_berlin, cur);
  }
  for (const d of [...byDay.keys()].sort()) {
    const cur = byDay.get(d)!;
    dRows.push([d, String(cur.v), String(cur.ve), String(cur.tot)]);
  }
  downloadCsv(`qrave-diaet-trends-${t}.csv`, dRows);
}
