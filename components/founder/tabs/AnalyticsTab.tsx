"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { FounderDashboardData, FounderScanEventRow } from "@/lib/founder-types";
import { berlinYmd, lastNCalendarDaysBerlin } from "@/lib/berlin-time";

const OR = "#FF5C1A";
const GREEN = "#34E89E";
const BLUE = "#5B9BFF";

type AnalyticsSubTab = "overview" | "restaurant" | "ab" | "ads";

type Props = {
  data: FounderDashboardData;
  isTablet: boolean;
  isDesktop: boolean;
};

const card: CSSProperties = {
  background: "linear-gradient(145deg, #17171f, #141420)",
  borderRadius: 20,
  border: "0.5px solid rgba(255,255,255,0.09)",
  boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
};

const HOURS_CHART = [6, 8, 10, 12, 14, 16, 18, 20, 22] as const;

function sessionKey(e: FounderScanEventRow): string {
  const sidRaw = e.session_id?.trim() ? e.session_id : e.id;
  if (sidRaw != null && String(sidRaw).length > 0) return String(sidRaw);
  return `row:${e.created_at}:${e.event_type}:${e.restaurant_id ?? ""}`;
}

function globalSessionTiers(events: FounderScanEventRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of events) {
    const k = sessionKey(e);
    const t = e.tier ?? 0;
    const cur = m.get(k) ?? 0;
    if (t > cur) m.set(k, t);
  }
  return m;
}

function sessionsForRestaurant(events: FounderScanEventRow[], restaurantId: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of events) {
    if (e.restaurant_id !== restaurantId) continue;
    const k = sessionKey(e);
    const t = e.tier ?? 0;
    const cur = m.get(k) ?? 0;
    if (t > cur) m.set(k, t);
  }
  return m;
}

function consentPctFromSessions(sessions: Map<string, number>): number {
  const total = sessions.size;
  if (total === 0) return 0;
  const withC = [...sessions.values()].filter((t) => t >= 1).length;
  return Math.round((withC / total) * 100);
}

function eventHourBerlin(e: FounderScanEventRow): number {
  if (e.stunde != null && Number.isFinite(e.stunde) && e.stunde >= 0 && e.stunde <= 23) {
    return e.stunde;
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date(e.created_at));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return Number.isFinite(h) ? h : 0;
}

function peakHourLabel(events: FounderScanEventRow[]): string {
  const counts = Array.from({ length: 24 }, () => 0);
  for (const e of events) {
    counts[eventHourBerlin(e)]++;
  }
  let maxH = 0;
  let maxC = -1;
  for (let h = 0; h < 24; h++) {
    if (counts[h]! > maxC) {
      maxC = counts[h]!;
      maxH = h;
    }
  }
  if (maxC <= 0) return "—";
  return `${String(maxH).padStart(2, "0")}:00 Uhr`;
}

function topCategoryFromEnters(events: FounderScanEventRow[]): string {
  const m = new Map<string, number>();
  for (const e of events) {
    if (e.event_type !== "category_enter") continue;
    const k = e.kategorie?.trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [k, n] of m) {
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  return bestN > 0 ? best : "—";
}

function csvEscape(cell: string): string {
  if (/[",\r\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const lines = [header.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
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
  const { scanEvents, restaurants, pipeline } = data;
  const [sub, setSub] = useState<AnalyticsSubTab>("overview");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>(() => restaurants[0]?.id ?? "");

  useEffect(() => {
    if (restaurants.length === 0) return;
    if (!restaurants.some((r) => r.id === selectedRestaurantId)) {
      setSelectedRestaurantId(restaurants[0]!.id);
    }
  }, [restaurants, selectedRestaurantId]);

  const globalSessions = useMemo(() => globalSessionTiers(scanEvents), [scanEvents]);
  const totalUniqueSessions = globalSessions.size;
  const withConsentGlobal = useMemo(
    () => [...globalSessions.values()].filter((t) => t >= 1).length,
    [globalSessions],
  );
  const avgConsentPct =
    totalUniqueSessions > 0 ? Math.round((withConsentGlobal / totalUniqueSessions) * 100) : 0;
  const peakLabel = useMemo(() => peakHourLabel(scanEvents), [scanEvents]);
  const topCat = useMemo(() => topCategoryFromEnters(scanEvents), [scanEvents]);

  const scansByRestaurant = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of restaurants) {
      m.set(r.id, sessionsForRestaurant(scanEvents, r.id).size);
    }
    return m;
  }, [restaurants, scanEvents]);

  const ranking = useMemo(() => {
    return [...restaurants]
      .map((r) => ({ r, n: scansByRestaurant.get(r.id) ?? 0 }))
      .sort((a, b) => b.n - a.n);
  }, [restaurants, scansByRestaurant]);

  const maxScans = useMemo(() => Math.max(1, ...ranking.map((x) => x.n)), [ranking]);

  const hourSlotCounts = useMemo(() => {
    return HOURS_CHART.map((h) => scanEvents.filter((e) => eventHourBerlin(e) === h).length);
  }, [scanEvents]);
  const maxHourSlot = Math.max(1, ...hourSlotCounts);

  const categoryEnterCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of scanEvents) {
      if (e.event_type !== "category_enter") continue;
      const k = e.kategorie?.trim();
      if (!k) continue;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [scanEvents]);
  const maxCatCount = Math.max(1, ...categoryEnterCounts.map(([, n]) => n), 1);

  const impressionsEstimate = restaurants.length * 1500 * 30;

  function exportOverviewCsv() {
    const header = ["Restaurant", "Slug", "Scans_Woche_Unique_Sessions", "Consent_Rate_Prozent"];
    const rows = restaurants.map((r) => {
      const sess = sessionsForRestaurant(scanEvents, r.id);
      const pct = consentPctFromSessions(sess);
      return [r.name, r.slug, String(sess.size), String(pct)];
    });
    downloadCsv(`qrave-analytics-${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
  }

  const selectedRestaurant = restaurants.find((r) => r.id === selectedRestaurantId);
  const perRestSessions = useMemo(() => {
    if (!selectedRestaurantId) return new Map<string, number>();
    return sessionsForRestaurant(scanEvents, selectedRestaurantId);
  }, [scanEvents, selectedRestaurantId]);

  const sevenDaySeries = useMemo(() => {
    if (!selectedRestaurantId) return { labels: [] as string[], counts: [] as number[] };
    const ymds = lastNCalendarDaysBerlin(7);
    const idx = new Map(ymds.map((y, i) => [y, i]));
    const counts = ymds.map(() => 0);
    for (const e of scanEvents) {
      if (e.restaurant_id !== selectedRestaurantId) continue;
      const y = berlinYmd(new Date(e.created_at));
      const i = idx.get(y);
      if (i !== undefined) counts[i]++;
    }
    const labels = ymds.map((y) => {
      const d = new Date(`${y}T12:00:00Z`);
      return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric" });
    });
    return { labels, counts };
  }, [scanEvents, selectedRestaurantId]);

  const topItems = useMemo(() => {
    if (!selectedRestaurantId) return [] as { name: string; n: number }[];
    const m = new Map<string, number>();
    for (const e of scanEvents) {
      if (e.restaurant_id !== selectedRestaurantId) continue;
      if (e.event_type !== "item_detail") continue;
      const n = e.item_name?.trim();
      if (!n) continue;
      m.set(n, (m.get(n) ?? 0) + 1);
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, n]) => ({ name, n }));
  }, [scanEvents, selectedRestaurantId]);

  const funnel = useMemo(() => {
    const total = perRestSessions.size;
    const withC = [...perRestSessions.values()].filter((t) => t >= 1).length;
    return { total, withC, without: total - withC };
  }, [perRestSessions]);

  function exportRestaurantCsv() {
    if (!selectedRestaurant) return;
    const header = ["Metrik", "Wert"];
    const rows: string[][] = [
      ["Restaurant", selectedRestaurant.name],
      ["Slug", selectedRestaurant.slug],
      ["Besucher_gesamt", String(funnel.total)],
      ["Mit_Consent", String(funnel.withC)],
      ["Ohne_Consent", String(funnel.without)],
      ...sevenDaySeries.labels.map((lbl, i) => [`Tag_${lbl}`, String(sevenDaySeries.counts[i] ?? 0)]),
      ...topItems.map((it, i) => [`Top_Item_${i + 1}`, `${it.name} (${it.n})`]),
    ];
    downloadCsv(`qrave-${selectedRestaurant.slug}-analytics.csv`, header, rows);
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
              border: sub === t.id ? `1px solid ${OR}` : "1px solid rgba(255,255,255,0.12)",
              background: sub === t.id ? "rgba(255,92,26,0.14)" : "rgba(255,255,255,0.05)",
              color: sub === t.id ? "#fff" : "rgba(255,255,255,0.5)",
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
            <KpiCell label="SCANS GESAMT" value={String(totalUniqueSessions)} sub="Unique Sessions (7 Tage)" accent={OR} />
            <KpiCell label="Ø CONSENT-RATE" value={`${avgConsentPct}%`} sub="tier ≥ 1 · Sessions" accent={GREEN} />
            <KpiCell label="PEAK-ZEIT" value={peakLabel} sub="Meiste Events (Stunde)" accent={BLUE} />
            <KpiCell label="TOP KATEGORIE" value={topCat} sub="category_enter" accent={OR} />
          </div>

          <div style={{ ...card, padding: isTablet ? 16 : 20 }}>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              RESTAURANT RANKING · SCANS/WOCHE
            </p>
            <div className="flex flex-col gap-3">
              {ranking.map(({ r, n }, i) => (
                <div key={r.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 text-sm font-bold text-white">
                      <span style={{ color: "rgba(255,255,255,0.35)", marginRight: 8 }}>{i + 1}.</span>
                      {r.name}
                    </span>
                    <span className="shrink-0 text-sm font-extrabold tabular-nums" style={{ color: OR }}>
                      {n}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(n / maxScans) * 100}%`,
                        background: OR,
                        boxShadow: n === maxScans ? `0 0 8px ${OR}` : "none",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...card, padding: isTablet ? 16 : 20 }}>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              SCANS NACH TAGESZEIT
            </p>
            <div className="flex items-end justify-between gap-1" style={{ height: 140 }}>
              {HOURS_CHART.map((h, i) => {
                const c = hourSlotCounts[i] ?? 0;
                const innerMax = 100;
                const barPx = c === 0 ? 4 : Math.max(8, (c / maxHourSlot) * innerMax);
                const isPeak = c === maxHourSlot && c > 0;
                return (
                  <div key={h} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <div
                      className="w-full max-w-[32px] rounded-t-md"
                      style={{
                        height: barPx,
                        background: `linear-gradient(180deg, ${OR}, rgba(255,92,26,0.35))`,
                        boxShadow: isPeak ? `0 0 10px ${OR}` : "none",
                      }}
                    />
                    <span className="text-center text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {h}h
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ ...card, padding: isTablet ? 16 : 20 }}>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              KATEGORIE-KLICKS · TOP 5
            </p>
            <div className="flex flex-col gap-3">
              {categoryEnterCounts.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>Keine category_enter Events.</p>
              ) : (
                categoryEnterCounts.map(([name, n]) => (
                  <div key={name}>
                    <div className="mb-1 flex justify-between text-xs font-bold">
                      <span className="truncate text-white">{name}</span>
                      <span className="shrink-0 tabular-nums" style={{ color: OR }}>
                        {n}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(n / maxCatCount) * 100}%`,
                          background: OR,
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
            className="w-full rounded-2xl py-4 text-sm font-extrabold"
            style={{
              border: `1px solid ${OR}`,
              background: "rgba(255,92,26,0.12)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            ⬇️ Analytics als CSV exportieren
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
                    border: selectedRestaurantId === r.id ? `1px solid ${OR}` : "1px solid rgba(255,255,255,0.12)",
                    background: selectedRestaurantId === r.id ? "rgba(255,92,26,0.15)" : "rgba(255,255,255,0.05)",
                    color: selectedRestaurantId === r.id ? "#fff" : "rgba(255,255,255,0.55)",
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
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  SCANS · 7 TAGE (EUROPE/BERLIN)
                </p>
                <div className="flex items-end gap-1" style={{ height: 160, minWidth: 280 }}>
                  {sevenDaySeries.counts.map((c, i) => {
                    const maxD = Math.max(1, ...sevenDaySeries.counts);
                    const barPx = c === 0 ? 6 : Math.max(10, (c / maxD) * 110);
                    return (
                      <div key={sevenDaySeries.labels[i] ?? i} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                        <div
                          className="w-full max-w-[36px] rounded-t-md"
                          style={{
                            height: barPx,
                            background: `linear-gradient(180deg, ${BLUE}, rgba(91,155,255,0.35))`,
                            boxShadow: c === maxD && c > 0 ? `0 0 8px ${BLUE}` : "none",
                          }}
                        />
                        <span className="text-center text-[9px] font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {sevenDaySeries.labels[i]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ ...card, padding: isTablet ? 16 : 20 }}>
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  TOP ITEMS · ITEM_DETAIL
                </p>
                {topItems.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>Keine Item-Aufrufe.</p>
                ) : (
                  <ul className="m-0 list-none space-y-2 p-0">
                    {topItems.map((it) => (
                      <li key={it.name} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-white">{it.name}</span>
                        <span className="shrink-0 font-extrabold tabular-nums" style={{ color: OR }}>
                          {it.n}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div style={{ ...card, padding: isTablet ? 16 : 20 }}>
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  CONSENT-FUNNEL
                </p>
                <div className="grid gap-3" style={{ gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr" }}>
                  <FunnelBox label="Besucher gesamt" value={funnel.total} color="#fff" />
                  <FunnelBox label="Mit Consent" value={funnel.withC} color={GREEN} />
                  <FunnelBox label="Ohne Consent" value={funnel.without} color="rgba(255,255,255,0.45)" />
                </div>
              </div>

              <button
                type="button"
                onClick={exportRestaurantCsv}
                className="w-full rounded-2xl py-4 text-sm font-extrabold"
                style={{
                  border: `1px solid ${BLUE}`,
                  background: "rgba(91,155,255,0.12)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                ⬇️ {selectedRestaurant.name} Daten exportieren
              </button>
            </>
          ) : (
            <p style={{ color: "rgba(255,255,255,0.45)" }}>Kein Restaurant ausgewählt.</p>
          )}
        </>
      ) : null}

      {sub === "ab" ? (
        <div style={{ ...card, padding: isTablet ? 20 : 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>A/B Tests kommen in Phase 2</h2>
          <p style={{ margin: "12px 0 0", fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
            Teste verschiedene Speisekarten-Layouts und miss welche mehr Interaktionen generiert.
          </p>
          <button
            type="button"
            disabled
            className="mt-6 w-full rounded-2xl py-4 text-sm font-extrabold"
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.25)",
              cursor: "not-allowed",
            }}
          >
            ⬇️ Export (demnächst)
          </button>
        </div>
      ) : null}

      {sub === "ads" ? (
        <div style={{ ...card, padding: isTablet ? 16 : 20 }}>
          {pipeline.length === 0 ? (
            <>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>Noch keine Werbepartner aktiv</h2>
              <p style={{ margin: "10px 0 0", fontSize: 14, color: "rgba(255,255,255,0.5)" }}>Ab 50 Restaurants relevant.</p>
            </>
          ) : (
            <>
              <p
                style={{
                  margin: "0 0 14px",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                PIPELINE / PARTNER
              </p>
              <div className="mb-4 rounded-2xl p-4" style={{ background: "rgba(0,0,0,0.25)", border: "0.5px solid rgba(255,255,255,0.08)" }}>
                <p className="m-0 text-xs font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Impressionen-Schätzung (Monat)
                </p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums" style={{ color: BLUE }}>
                  {impressionsEstimate.toLocaleString("de-DE")}
                </p>
                <p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {restaurants.length} Restaurants × 1500 × 30 Tage
                </p>
              </div>
              <p className="mb-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                MRR-Felder folgen mit Werbepartner-Schema; Status aus Pipeline-Stage.
              </p>
              <div className="flex flex-col gap-2">
                {pipeline.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-3"
                    style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)" }}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white">{p.name}</div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {p.stage ?? "—"} {p.bezirk ? `· ${p.bezirk}` : ""}
                      </div>
                    </div>
                    <div className="text-right text-sm font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.35)" }}>
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
      style={{ background: "rgba(0,0,0,0.22)", border: "0.5px solid rgba(255,255,255,0.06)" }}
    >
      <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums" style={{ color: accent }}>
        {value}
      </p>
      <p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
        {sub}
      </p>
    </div>
  );
}

function FunnelBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-2xl p-4 text-center"
      style={{ background: "rgba(0,0,0,0.22)", border: "0.5px solid rgba(255,255,255,0.08)" }}
    >
      <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: "rgba(255,255,255,0.4)" }}>
        {label}
      </p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
