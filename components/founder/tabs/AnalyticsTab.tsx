"use client";

/*
 * AnalyticsTab — komplett umgestellt am 14.05.2026.
 *
 * Vorher: alle Aggregate kamen aus `data.scanEvents` (= scanEventsWeek,
 * gedeckelt auf 4000 Rows + dedupe). Bei aktivem Traffic war das Window
 * zu klein, alle event_type-Filter (category_enter, item_detail) trafen
 * leere Slices → der Tab zeigte überall 0 trotz vorhandener Daten.
 *
 * Jetzt: Aggregate aus `data.analyticsDaily30d` (Service-Role-Read auf
 * restaurant_analytics_daily, identisch zur Logik in FounderOverview).
 * Plus Königsblau-CI (gleiche Card-Styles wie FounderOverview).
 */

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  FounderAnalyticsDailyRow,
  FounderDashboardData,
} from "@/lib/founder-types";

const ACCENT = "#9333ea";
const ACCENT_SOFT = "rgba(147,51,234,0.18)";
const ACCENT_BORDER = "rgba(147,51,234,0.4)";
const GREEN = "#4ade80";

type AnalyticsSubTab = "overview" | "restaurant" | "ab" | "ads";

type Props = {
  data: FounderDashboardData;
  isTablet: boolean;
  isDesktop: boolean;
};

const card: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
};

const SLOT_KEYS = ["scans_morning", "scans_midday", "scans_evening", "scans_night"] as const;
const SLOT_LABELS = ["Morgen", "Mittag", "Abend", "Nacht"] as const;
const SLOT_RANGES = ["06:00–11:00", "11:00–15:00", "15:00–22:00", "22:00–06:00"] as const;

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

function sumDailyNumber<K extends keyof FounderAnalyticsDailyRow>(
  rows: FounderAnalyticsDailyRow[],
  key: K,
): number {
  let s = 0;
  for (const r of rows) {
    const v = r[key];
    if (typeof v === "number") s += v;
  }
  return s;
}

function csvEscape(cell: string): string {
  if (/[",\r\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}
function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const lines = [header.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  const blob = new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const subTabs: { id: AnalyticsSubTab; label: string }[] = [
  { id: "overview", label: "Übersicht" },
  { id: "restaurant", label: "Pro Restaurant" },
  { id: "ab", label: "A/B Tests" },
  { id: "ads", label: "Werbepartner" },
];

export function AnalyticsTab({ data, isTablet, isDesktop }: Props) {
  const { analyticsDaily30d, restaurants, pipeline } = data;
  const [sub, setSub] = useState<AnalyticsSubTab>("overview");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>(
    () => restaurants[0]?.id ?? "",
  );

  useEffect(() => {
    if (restaurants.length === 0) return;
    if (!restaurants.some((r) => r.id === selectedRestaurantId)) {
      setSelectedRestaurantId(restaurants[0]!.id);
    }
  }, [restaurants, selectedRestaurantId]);

  // Letzte 7 Tage (rolling) — alle Aggregate beziehen sich darauf
  const today = todayBerlinIso();
  const weekFrom = shiftIso(today, -6);

  const dailyWeek = useMemo(
    () => analyticsDaily30d.filter((r) => r.day_berlin >= weekFrom && r.day_berlin <= today),
    [analyticsDaily30d, weekFrom, today],
  );

  // GLOBAL — alle Restaurants
  const totalSessions = sumDailyNumber(dailyWeek, "sessions_count");
  const totalConsent = sumDailyNumber(dailyWeek, "sessions_with_consent");
  const avgConsentPct =
    totalSessions > 0 ? Math.round((totalConsent / totalSessions) * 100) : 0;

  // Tageszeit-Slots aus daily summiert
  const slotCounts: [number, number, number, number] = [
    sumDailyNumber(dailyWeek, "scans_morning"),
    sumDailyNumber(dailyWeek, "scans_midday"),
    sumDailyNumber(dailyWeek, "scans_evening"),
    sumDailyNumber(dailyWeek, "scans_night"),
  ];
  const slotMax = Math.max(1, ...slotCounts);

  const peakSlotIdx = slotCounts.reduce((maxI, v, i, arr) => (v > arr[maxI] ? i : maxI), 0);
  const peakLabel = slotCounts[peakSlotIdx] > 0
    ? `${SLOT_LABELS[peakSlotIdx]} ${SLOT_RANGES[peakSlotIdx]}`
    : "—";

  // Top-Kategorie aus category_clicks jsonb über alle Restaurants
  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of dailyWeek) {
      const o = r.category_clicks ?? {};
      for (const [k, v] of Object.entries(o)) {
        m[k] = (m[k] ?? 0) + (typeof v === "number" ? v : 0);
      }
    }
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [dailyWeek]);
  const topCat = categoryCounts[0]?.[0] ?? "—";
  const maxCatCount = Math.max(1, ...categoryCounts.map(([, n]) => n));

  // Sessions pro Restaurant
  const sessionsByRestaurant = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of dailyWeek) {
      m.set(r.restaurant_id, (m.get(r.restaurant_id) ?? 0) + (r.sessions_count ?? 0));
    }
    return m;
  }, [dailyWeek]);

  const ranking = useMemo(
    () =>
      [...restaurants]
        .map((r) => ({ r, n: sessionsByRestaurant.get(r.id) ?? 0 }))
        .sort((a, b) => b.n - a.n),
    [restaurants, sessionsByRestaurant],
  );
  const maxScans = Math.max(1, ...ranking.map((x) => x.n));

  const impressionsEstimate = restaurants.length * 1500 * 30;

  function exportOverviewCsv() {
    const header = ["Restaurant", "Slug", "Sessions_7d", "Consent_Rate_Prozent"];
    const rows = restaurants.map((r) => {
      const sessions = sessionsByRestaurant.get(r.id) ?? 0;
      // Pro-Restaurant Consent aus daily filtered
      const rd = dailyWeek.filter((d) => d.restaurant_id === r.id);
      const sess = sumDailyNumber(rd, "sessions_count");
      const cons = sumDailyNumber(rd, "sessions_with_consent");
      const pct = sess > 0 ? Math.round((cons / sess) * 100) : 0;
      return [r.name, r.slug, String(sessions), String(pct)];
    });
    downloadCsv(`qrave-analytics-${today}.csv`, header, rows);
  }

  // PER RESTAURANT
  const selectedRestaurant = restaurants.find((r) => r.id === selectedRestaurantId);
  const dailyPerRest = useMemo(
    () => dailyWeek.filter((d) => d.restaurant_id === selectedRestaurantId),
    [dailyWeek, selectedRestaurantId],
  );

  const sevenDaySeries = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const r of dailyPerRest) byDay.set(r.day_berlin, r.scan_count ?? 0);
    const labels: string[] = [];
    const counts: number[] = [];
    for (let i = 0; i < 7; i++) {
      const iso = shiftIso(weekFrom, i);
      const d = new Date(`${iso}T12:00:00Z`);
      labels.push(d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric" }));
      counts.push(byDay.get(iso) ?? 0);
    }
    return { labels, counts };
  }, [dailyPerRest, weekFrom]);

  const topItems = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of dailyPerRest) {
      for (const it of r.top_items ?? []) {
        m.set(it.name, (m.get(it.name) ?? 0) + (it.clicks ?? 0));
      }
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, n]) => ({ name, n }));
  }, [dailyPerRest]);

  const funnel = useMemo(() => {
    const total = sumDailyNumber(dailyPerRest, "sessions_count");
    const withC = sumDailyNumber(dailyPerRest, "sessions_with_consent");
    return { total, withC, without: Math.max(0, total - withC) };
  }, [dailyPerRest]);

  function exportRestaurantCsv() {
    if (!selectedRestaurant) return;
    const header = ["Metrik", "Wert"];
    const rows: string[][] = [
      ["Restaurant", selectedRestaurant.name],
      ["Slug", selectedRestaurant.slug],
      ["Besucher_gesamt_7d", String(funnel.total)],
      ["Mit_Consent", String(funnel.withC)],
      ["Ohne_Consent", String(funnel.without)],
      ...sevenDaySeries.labels.map((lbl, i) => [`Tag_${lbl}`, String(sevenDaySeries.counts[i] ?? 0)]),
      ...topItems.map((it, i) => [`Top_Item_${i + 1}`, `${it.name} (${it.n})`]),
    ];
    downloadCsv(`qrave-${selectedRestaurant.slug}-analytics-${today}.csv`, header, rows);
  }

  const kpiGrid = isDesktop ? "repeat(2, minmax(0, 1fr))" : "1fr";

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div className="flex flex-wrap gap-2">
        {subTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSub(t.id)}
            className="rounded-full px-4 py-2 text-sm font-bold"
            style={{
              border: sub === t.id ? `1px solid ${ACCENT_BORDER}` : "1px solid rgba(255,255,255,0.12)",
              background: sub === t.id ? ACCENT_SOFT : "rgba(255,255,255,0.05)",
              color: sub === t.id ? "#fff" : "rgba(242,242,242,0.55)",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === "overview" ? (
        <>
          <div
            className="grid gap-3"
            style={{ ...card, padding: isTablet ? 16 : 20, gridTemplateColumns: kpiGrid }}
          >
            <KpiCell
              label="SCANS GESAMT"
              value={totalSessions.toLocaleString("de-DE")}
              sub="Unique Sessions · 7 Tage"
              accent={ACCENT}
            />
            <KpiCell
              label="Ø CONSENT-RATE"
              value={`${avgConsentPct}%`}
              sub="Sessions mit Consent / Gesamt"
              accent={GREEN}
            />
            <KpiCell
              label="PEAK-ZEIT"
              value={peakLabel}
              sub="Dominanter Tagesabschnitt"
              accent={ACCENT}
            />
            <KpiCell
              label="TOP KATEGORIE"
              value={topCat}
              sub="category_clicks (jsonb-Aggregat)"
              accent={ACCENT}
            />
          </div>

          <div style={{ ...card, padding: isTablet ? 16 : 20 }}>
            <SectionLabel>RESTAURANT RANKING · SCANS/WOCHE</SectionLabel>
            <div className="flex flex-col gap-3">
              {ranking.map(({ r, n }, i) => (
                <div key={r.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 text-sm font-bold text-white">
                      <span style={{ color: "rgba(242,242,242,0.35)", marginRight: 8 }}>{i + 1}.</span>
                      {r.name}
                    </span>
                    <span
                      className="shrink-0 text-sm font-extrabold tabular-nums"
                      style={{ color: ACCENT }}
                    >
                      {n}
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(n / maxScans) * 100}%`,
                        background: ACCENT,
                        boxShadow: n === maxScans && n > 0 ? `0 0 8px ${ACCENT}` : "none",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...card, padding: isTablet ? 16 : 20 }}>
            <SectionLabel>SCANS NACH TAGESZEIT</SectionLabel>
            <div className="flex items-end justify-between gap-2" style={{ height: 160 }}>
              {SLOT_KEYS.map((_, i) => {
                const c = slotCounts[i];
                const barPx = c === 0 ? 4 : Math.max(8, (c / slotMax) * 110);
                const isPeak = c === slotMax && c > 0;
                return (
                  <div
                    key={SLOT_LABELS[i]}
                    className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                  >
                    <span
                      className="qrave-font-display text-[14px] font-bold tabular-nums"
                      style={{ color: isPeak ? ACCENT : "rgba(242,242,242,0.65)" }}
                    >
                      {c.toLocaleString("de-DE")}
                    </span>
                    <div
                      className="w-full max-w-[64px] rounded-t-md"
                      style={{
                        height: barPx,
                        background: `linear-gradient(180deg, ${ACCENT}, rgba(147,51,234,0.35))`,
                        boxShadow: isPeak ? `0 0 12px ${ACCENT}` : "none",
                      }}
                    />
                    <span
                      className="text-center text-[11px] font-semibold"
                      style={{ color: "rgba(242,242,242,0.55)" }}
                    >
                      {SLOT_LABELS[i]}
                    </span>
                    <span className="text-center text-[10px]" style={{ color: "rgba(242,242,242,0.4)" }}>
                      {SLOT_RANGES[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ ...card, padding: isTablet ? 16 : 20 }}>
            <SectionLabel>KATEGORIE-KLICKS · TOP 5</SectionLabel>
            <div className="flex flex-col gap-3">
              {categoryCounts.length === 0 ? (
                <p style={{ color: "rgba(242,242,242,0.5)", fontSize: 13 }}>
                  Keine Kategorie-Klicks im 7-Tage-Aggregat.
                </p>
              ) : (
                categoryCounts.map(([name, n]) => (
                  <div key={name}>
                    <div className="mb-1 flex justify-between text-xs font-bold">
                      <span className="truncate text-white">{name}</span>
                      <span
                        className="shrink-0 tabular-nums"
                        style={{ color: ACCENT }}
                      >
                        {n}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(n / maxCatCount) * 100}%`,
                          background: ACCENT,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={exportOverviewCsv}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-extrabold"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: "#fff",
              boxShadow: "0 6px 20px rgba(147,51,234,0.4)",
              cursor: "pointer",
            }}
          >
            <i className="fa-solid fa-download text-[12px]" />
            Analytics als CSV exportieren
          </button>
        </>
      ) : null}

      {sub === "restaurant" ? (
        <>
          <div className="-mx-1 overflow-x-auto pb-1">
            <div className="flex w-max gap-2 px-1">
              {restaurants.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRestaurantId(r.id)}
                  className="shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold"
                  style={{
                    border:
                      selectedRestaurantId === r.id
                        ? `1px solid ${ACCENT_BORDER}`
                        : "1px solid rgba(255,255,255,0.12)",
                    background:
                      selectedRestaurantId === r.id ? ACCENT_SOFT : "rgba(255,255,255,0.05)",
                    color: selectedRestaurantId === r.id ? "#fff" : "rgba(242,242,242,0.55)",
                    cursor: "pointer",
                  }}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>

          {selectedRestaurant ? (
            <>
              <div style={{ ...card, padding: isTablet ? 16 : 20 }}>
                <SectionLabel>SCANS · 7 TAGE (EUROPE/BERLIN)</SectionLabel>
                <div className="flex items-end gap-2" style={{ height: 160, minWidth: 280 }}>
                  {sevenDaySeries.counts.map((c, i) => {
                    const maxD = Math.max(1, ...sevenDaySeries.counts);
                    const barPx = c === 0 ? 6 : Math.max(10, (c / maxD) * 110);
                    return (
                      <div
                        key={sevenDaySeries.labels[i] ?? i}
                        className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                      >
                        <span
                          className="qrave-font-display text-[12px] font-bold tabular-nums"
                          style={{ color: c === maxD && c > 0 ? ACCENT : "rgba(242,242,242,0.5)" }}
                        >
                          {c}
                        </span>
                        <div
                          className="w-full max-w-[42px] rounded-t-md"
                          style={{
                            height: barPx,
                            background: `linear-gradient(180deg, ${ACCENT}, rgba(147,51,234,0.35))`,
                            boxShadow: c === maxD && c > 0 ? `0 0 8px ${ACCENT}` : "none",
                          }}
                        />
                        <span
                          className="text-center text-[10px] font-semibold"
                          style={{ color: "rgba(242,242,242,0.4)" }}
                        >
                          {sevenDaySeries.labels[i]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ ...card, padding: isTablet ? 16 : 20 }}>
                <SectionLabel>TOP ITEMS · ITEM-KLICKS</SectionLabel>
                {topItems.length === 0 ? (
                  <p style={{ color: "rgba(242,242,242,0.5)", fontSize: 13 }}>
                    Keine Item-Klicks im 7-Tage-Aggregat.
                  </p>
                ) : (
                  <ul className="m-0 list-none space-y-2 p-0">
                    {topItems.map((it) => (
                      <li key={it.name} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-white">{it.name}</span>
                        <span
                          className="shrink-0 font-extrabold tabular-nums"
                          style={{ color: ACCENT }}
                        >
                          {it.n}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div style={{ ...card, padding: isTablet ? 16 : 20 }}>
                <SectionLabel>CONSENT-FUNNEL</SectionLabel>
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr" }}
                >
                  <FunnelBox label="Besucher gesamt" value={funnel.total} color="#fff" />
                  <FunnelBox label="Mit Consent" value={funnel.withC} color={GREEN} />
                  <FunnelBox
                    label="Ohne Consent"
                    value={funnel.without}
                    color="rgba(242,242,242,0.55)"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={exportRestaurantCsv}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-extrabold"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                  color: "#fff",
                  boxShadow: "0 6px 20px rgba(147,51,234,0.4)",
                  cursor: "pointer",
                }}
              >
                <i className="fa-solid fa-download text-[12px]" />
                {selectedRestaurant.name} Daten exportieren
              </button>
            </>
          ) : (
            <p style={{ color: "rgba(242,242,242,0.5)" }}>Kein Restaurant ausgewählt.</p>
          )}
        </>
      ) : null}

      {sub === "ab" ? (
        <div style={{ ...card, padding: isTablet ? 20 : 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>
            A/B Tests kommen in Phase 2
          </h2>
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 14,
              color: "rgba(242,242,242,0.55)",
              lineHeight: 1.6,
            }}
          >
            Teste verschiedene Speisekarten-Layouts und miss welche mehr Interaktionen generiert.
          </p>
          <button
            type="button"
            disabled
            className="mt-6 w-full rounded-2xl py-4 text-sm font-extrabold"
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(242,242,242,0.25)",
              cursor: "not-allowed",
            }}
          >
            Export (demnächst)
          </button>
        </div>
      ) : null}

      {sub === "ads" ? (
        <div style={{ ...card, padding: isTablet ? 16 : 20 }}>
          {pipeline.length === 0 ? (
            <>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>
                Noch keine Werbepartner aktiv
              </h2>
              <p style={{ margin: "10px 0 0", fontSize: 14, color: "rgba(242,242,242,0.5)" }}>
                Ab 50 Restaurants relevant.
              </p>
            </>
          ) : (
            <>
              <SectionLabel>PIPELINE / PARTNER</SectionLabel>
              <div
                className="mb-4 rounded-2xl p-4"
                style={{ background: "rgba(0,0,0,0.25)", border: "0.5px solid rgba(255,255,255,0.08)" }}
              >
                <p className="m-0 text-xs font-bold" style={{ color: "rgba(242,242,242,0.5)" }}>
                  Impressionen-Schätzung (Monat)
                </p>
                <p
                  className="mt-1 text-2xl font-extrabold tabular-nums"
                  style={{ color: ACCENT }}
                >
                  {impressionsEstimate.toLocaleString("de-DE")}
                </p>
                <p className="mt-1 text-xs" style={{ color: "rgba(242,242,242,0.4)" }}>
                  {restaurants.length} Restaurants × 1500 × 30 Tage
                </p>
              </div>
              <p className="mb-3 text-xs" style={{ color: "rgba(242,242,242,0.45)" }}>
                MRR-Felder folgen mit Werbepartner-Schema; Status aus Pipeline-Stage.
              </p>
              <div className="flex flex-col gap-2">
                {pipeline.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-3"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "0.5px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white">{p.name}</div>
                      <div className="text-xs" style={{ color: "rgba(242,242,242,0.5)" }}>
                        {p.stage ?? "—"} {p.bezirk ? `· ${p.bezirk}` : ""}
                      </div>
                    </div>
                    <div
                      className="text-right text-sm font-bold tabular-nums"
                      style={{ color: "rgba(242,242,242,0.4)" }}
                    >
                      MRR: —
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm font-bold" style={{ color: GREEN }}>
                Gesamt MRR: —
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: "0 0 14px",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: ACCENT,
      }}
    >
      {children}
    </p>
  );
}

function KpiCell({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          color: "rgba(242,242,242,0.5)",
        }}
      >
        {label}
      </p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums" style={{ color: accent }}>
        {value}
      </p>
      <p className="mt-1 text-xs" style={{ color: "rgba(242,242,242,0.4)" }}>
        {sub}
      </p>
    </div>
  );
}

function FunnelBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-2xl p-4 text-center"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.06em",
          color: "rgba(242,242,242,0.5)",
        }}
      >
        {label}
      </p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums" style={{ color }}>
        {value.toLocaleString("de-DE")}
      </p>
    </div>
  );
}
