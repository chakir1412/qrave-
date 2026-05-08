"use client";

import { DM_Sans } from "next/font/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { iterateBerlinDaysInclusive } from "@/lib/berlin-time";
import type { RestaurantAnalyticsApiPayload } from "@/lib/restaurant-analytics-api-types";
import { defaultLast7Ymd } from "@/lib/restaurant-analytics-presets";
import { RangeCalendarModal } from "./RangeCalendarModal";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const C = {
  bg: "#0c0c0f",
  teal: "#00c8a0",
  orange: "#ff5c1a",
  blue: "#5b9bff",
  yellow: "#ffd426",
  green: "#34e89e",
  red: "#ff4b6e",
  textMuted: "rgba(255,255,255,0.55)",
  textFaint: "rgba(255,255,255,0.4)",
  borderFaint: "rgba(255,255,255,0.06)",
  cardBg: "rgba(255,255,255,0.035)",
  cardBgInner: "rgba(0,0,0,0.22)",
} as const;

const card: CSSProperties = {
  background: C.cardBg,
  border: `1px solid ${C.borderFaint}`,
  borderRadius: 12,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

const sectionTitle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: C.textFaint,
};

/** Getränke-Subkategorien aus `scan_events.beverage_subcategory`.
 *  Die Reihenfolge bestimmt die Anzeige in der Drink-Performance-Liste
 *  und im CSV-Export. */
const DRINK_LABELS: Record<string, { label: string; color: string }> = {
  bier: { label: "Bier", color: "#F59E0B" },
  wein: { label: "Wein", color: "#8B5CF6" },
  softdrinks: { label: "Softdrinks", color: "#10B981" },
  cocktails: { label: "Cocktails", color: "#EC4899" },
  wasser: { label: "Wasser", color: "#3B82F6" },
  kaffee: { label: "Kaffee", color: "#92400E" },
  energy: { label: "Energy", color: "#EF4444" },
  sonstiges_getraenk: { label: "Sonstiges", color: "#6B7280" },
};
const DRINK_KEYS = Object.keys(DRINK_LABELS);

function csvEscape(cell: string): string {
  if (/[",\r\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

function formatRangeLabel(fromYmd: string, toYmd: string): string {
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  const df = new Date(fy, fm - 1, fd);
  const dt = new Date(ty, tm - 1, td);
  if (fy === ty) {
    const left = df.toLocaleDateString("de-DE", { day: "numeric", month: "long" });
    const right = dt.toLocaleDateString("de-DE", { day: "numeric", month: "long" });
    return `${left} – ${right}`;
  }
  const left = df.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
  const right = dt.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
  return `${left} – ${right}`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function formatHourRange(fromHour: number, toHour: number): string {
  const f = `${String(fromHour).padStart(2, "0")}:00`;
  const t = `${String(toHour + 1).padStart(2, "0")}:00`;
  return `${f}–${t}`;
}

const EUR_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatEur(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  return EUR_FORMATTER.format(p);
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Props = {
  restaurantId: string;
  fromYmd: string;
  toYmd: string;
};

export function RestaurantAnalyticsClient({ restaurantId, fromYmd, toYmd }: Props) {
  const router = useRouter();
  const [data, setData] = useState<RestaurantAnalyticsApiPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const cacheRef = useRef<Map<string, RestaurantAnalyticsApiPayload>>(new Map());

  const rangeLabel = formatRangeLabel(fromYmd, toYmd);
  const cacheKey = `${restaurantId}-${fromYmd}-${toYmd}`;

  const setCacheEntry = useCallback((key: string, value: RestaurantAnalyticsApiPayload) => {
    const cache = cacheRef.current;
    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);
    while (cache.size > 10) {
      const oldest = cache.keys().next().value;
      if (!oldest) break;
      cache.delete(oldest);
    }
  }, []);

  const navigateRange = useCallback(
    (from: string, to: string) => {
      setLoading(true);
      setLoadError(null);
      router.push(`/founder/restaurants/${restaurantId}/analytics?from=${from}&to=${to}`);
    },
    [router, restaurantId],
  );

  useLayoutEffect(() => {
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setData(cached);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoadError(null);
    setLoading(true);
  }, [cacheKey]);

  useEffect(() => {
    if (cacheRef.current.has(cacheKey)) return;
    let cancelled = false;
    void (async () => {
      try {
        const u = new URLSearchParams({ restaurantId, from: fromYmd, to: toYmd });
        const res = await fetch(`/api/founder/restaurant-analytics?${u.toString()}`, {
          credentials: "same-origin",
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) {
            setData(null);
            setLoadError(j.error ?? `Fehler ${res.status}`);
          }
          return;
        }
        const payload = (await res.json()) as RestaurantAnalyticsApiPayload;
        if (!cancelled) {
          setCacheEntry(cacheKey, payload);
          setData(payload);
        }
      } catch {
        if (!cancelled) setLoadError("Netzwerkfehler");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, fromYmd, restaurantId, setCacheEntry, toYmd]);

  const exportCsv = useCallback(() => {
    if (!data?.restaurant) return;
    const slug = data.restaurant.slug;
    const c = data.computed;
    const lines: string[] = [];
    lines.push("SCANS_PRO_TAG");
    lines.push(["Kalendertag_Berlin", "Sessions"].map(csvEscape).join(","));
    const days = iterateBerlinDaysInclusive(data.fromYmd, data.toYmd);
    for (const d of days) {
      lines.push([d, String(c.scansByBerlinDay[d] ?? 0)].map(csvEscape).join(","));
    }
    lines.push("");
    lines.push("TOP_GERICHTE");
    lines.push(["item_name", "klicks"].map(csvEscape).join(","));
    for (const it of c.topItems) lines.push([it.name, String(it.count)].map(csvEscape).join(","));
    lines.push("");
    lines.push("TOP_DRINKS");
    lines.push(["item_name", "klicks"].map(csvEscape).join(","));
    for (const it of c.topDrinks) lines.push([it.name, String(it.count)].map(csvEscape).join(","));
    lines.push("");
    lines.push("DRINK_KATEGORIEN");
    lines.push(["kategorie", "klicks"].map(csvEscape).join(","));
    for (const k of DRINK_KEYS) {
      const v = c.beverage_subcategory_clicks[k] ?? 0;
      lines.push([DRINK_LABELS[k].label, String(v)].map(csvEscape).join(","));
    }
    lines.push("");
    lines.push("INSIGHTS");
    lines.push(["metric", "value"].map(csvEscape).join(","));
    lines.push(["bounce_rate_prozent", String(c.bounce.rate)].map(csvEscape).join(","));
    lines.push(["avg_session_duration_seconds", String(c.avgSessionDurationSeconds)].map(csvEscape).join(","));
    lines.push(["peak_day_of_week", c.peakDayOfWeek?.dayLabel ?? ""].map(csvEscape).join(","));
    lines.push(
      ["peak_hour_window", c.peakHourWindow ? formatHourRange(c.peakHourWindow.fromHour, c.peakHourWindow.toHour) : ""]
        .map(csvEscape)
        .join(","),
    );
    lines.push(["consent_rate_prozent", String(c.consent.ratePct)].map(csvEscape).join(","));
    lines.push(["impressionen_total", String(c.totalImpressions)].map(csvEscape).join(","));

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qrave-${slug}-${data.fromYmd}-${data.toYmd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const quick7 = () => {
    const { fromYmd: f, toYmd: t } = defaultLast7Ymd();
    navigateRange(f, t);
  };

  const computed = data?.computed;
  const ready = Boolean(!loading && data?.restaurant && computed);

  const noiseDataUri = useNoiseDataUri();

  return (
    <div
      className={`${dmSans.className} relative min-h-screen pb-12`}
      style={{ background: C.bg, color: "#fff" }}
      aria-busy={loading}
      aria-live="polite"
    >
      <div className="founder-bg-blobs" aria-hidden>
        <div className="founder-blob founder-blob--1" />
        <div className="founder-blob founder-blob--2" />
        <div className="founder-blob founder-blob--3" />
      </div>
      <div
        style={{
          position: "fixed",
          inset: 0,
          opacity: 0.04,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage: `url("${noiseDataUri}")`,
          backgroundRepeat: "repeat",
        }}
        aria-hidden
      />

      <div style={{ position: "relative", zIndex: 1 }} className="mx-auto max-w-3xl px-4 pt-4">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/founder"
            onClick={() => {
              try {
                window.localStorage.setItem("founder-dashboard-tab", "restaurants");
              } catch {
                /* ignore */
              }
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: C.textMuted }}
          >
            ← Restaurants
          </Link>

          <div className="flex w-full flex-wrap items-stretch justify-end gap-2 sm:w-auto sm:flex-nowrap">
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className={`min-h-[48px] flex-1 rounded-xl px-4 py-3 text-left text-sm font-semibold sm:min-w-[200px] sm:flex-none ${loading ? "animate-pulse" : ""}`}
              style={card}
            >
              <span
                className="block text-[10px] font-bold tracking-wider uppercase"
                style={{ color: C.textFaint }}
              >
                Zeitraum
              </span>
              <span className="mt-0.5 block text-white">{rangeLabel}</span>
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!data?.restaurant || loading}
              className="min-h-[48px] rounded-xl px-4 py-3 text-sm font-bold whitespace-nowrap"
              style={{
                ...card,
                border: `1px solid ${C.orange}55`,
                color: C.orange,
                cursor: loading || !data?.restaurant ? "not-allowed" : "pointer",
                opacity: loading || !data?.restaurant ? 0.45 : 1,
              }}
            >
              Export CSV
            </button>
          </div>
        </header>

        <RangeCalendarModal
          open={calendarOpen}
          anchorFromYmd={fromYmd}
          anchorToYmd={toYmd}
          onClose={() => setCalendarOpen(false)}
          onApplyRange={navigateRange}
          onQuick7={quick7}
        />

        {loadError ? (
          <div
            className="mb-4 rounded-xl px-4 py-3 text-sm"
            style={{ border: `1px solid ${C.red}55`, background: "rgba(255,75,110,0.1)", color: C.red }}
          >
            {loadError}
          </div>
        ) : null}

        {!loading && !data?.restaurant && !loadError ? (
          <p className="text-sm" style={{ color: C.textMuted }}>
            Restaurant nicht gefunden.
          </p>
        ) : null}

        {data?.restaurant ? (
          (() => {
            const stammdaten: string[] = [];
            if (data.restaurant.cuisine_type) stammdaten.push(capitalize(data.restaurant.cuisine_type));
            if (data.restaurant.stadtbezirk) stammdaten.push(data.restaurant.stadtbezirk);
            if (data.restaurant.restaurant_typ) stammdaten.push(capitalize(data.restaurant.restaurant_typ));
            return (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold tracking-tight text-white">
                    {data.restaurant.name}
                  </h1>
                  {stammdaten.length > 0 ? (
                    <p
                      className="mt-0.5 text-xs"
                      style={{ color: C.textMuted }}
                    >
                      {stammdaten.join(" · ")}
                    </p>
                  ) : null}
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold uppercase"
                  style={{
                    background: data.restaurant.aktiv ? "rgba(52,232,158,0.15)" : "rgba(255,255,255,0.08)",
                    color: data.restaurant.aktiv ? C.green : C.textMuted,
                    border: `1px solid ${data.restaurant.aktiv ? `${C.green}44` : "rgba(255,255,255,0.12)"}`,
                  }}
                >
                  {data.restaurant.aktiv ? "Live" : "Offline"}
                </span>
              </div>
            );
          })()
        ) : loading ? (
          <div
            className="mb-6 h-8 w-48 animate-pulse rounded-lg"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
        ) : null}

        {/* 1. SCANS PRO TAG */}
        <Section title="Scans pro Tag">
          {loading ? (
            <ChartSkeleton />
          ) : ready && computed ? (
            <ScansLineChart labels={computed.chartLabels} counts={computed.chartScanCounts} />
          ) : (
            <Empty />
          )}
        </Section>

        {/* 2. SCANS NACH TAGESZEIT */}
        <Section title="Scans nach Tageszeit (Europe/Berlin)">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((k) => (
                <div
                  key={k}
                  className="h-28 animate-pulse rounded-xl"
                  style={{ background: C.cardBgInner }}
                />
              ))}
            </div>
          ) : ready && computed ? (
            <TimeBlocksRow blocks={computed.timeBlocks} />
          ) : (
            <Empty />
          )}
        </Section>

        {/* 3. GETRÄNKE-PERFORMANCE */}
        <Section title="Getränke-Performance" accent={C.teal}>
          {loading ? (
            <DrinkSkeleton />
          ) : ready && computed ? (
            <DrinkPerformance
              top={computed.topDrinks}
              breakdown={computed.beverage_subcategory_clicks}
            />
          ) : (
            <Empty />
          )}
        </Section>

        {/* 4. MENU PERFORMANCE */}
        <Section title="Menu Performance">
          {loading ? (
            <MenuSkeleton />
          ) : ready && computed ? (
            (() => {
              // Preis-Lookup aus `top_items` (snake_case API-Feld) — wird in
              // der Top-Gerichte-Liste rechts neben der Klickzahl angezeigt.
              const priceLookup = new Map<string, number | null>();
              for (const it of computed.top_items ?? []) priceLookup.set(it.name, it.price);
              return (
                <div className="grid gap-6 sm:grid-cols-2">
                  <RankList
                    title="Meistgeklickte Gerichte"
                    rows={computed.topItems}
                    color={C.orange}
                    emptyText="Keine Klicks im Zeitraum"
                    priceLookup={priceLookup}
                  />
                  <RankList
                    title="Meistbesuchte Kategorien"
                    rows={computed.topCategories}
                    color={C.orange}
                    emptyText="Keine Klicks im Zeitraum"
                  />
                </div>
              );
            })()
          ) : (
            <Empty />
          )}
        </Section>

        {/* 4b. DIÄT & PREIS — nur sichtbar wenn mindestens eine der drei
              Käufer-Metriken vorliegt. */}
        {ready && computed && (
          computed.vegan_clicks > 0 ||
          computed.vegetarian_clicks > 0 ||
          computed.avg_item_price_clicked != null
        ) ? (
          <Section title="Diät & Preis">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {computed.vegan_clicks > 0 ? (
                <InsightTile
                  label="Vegane Items angeklickt"
                  value={computed.vegan_clicks.toLocaleString("de-DE")}
                  color={C.green}
                />
              ) : null}
              {computed.vegetarian_clicks > 0 ? (
                <InsightTile
                  label="Vegetarische Items angeklickt"
                  value={computed.vegetarian_clicks.toLocaleString("de-DE")}
                  color={C.teal}
                />
              ) : null}
              {computed.avg_item_price_clicked != null ? (
                <InsightTile
                  label="Ø Preis angeklickter Items"
                  value={formatEur(computed.avg_item_price_clicked)}
                  color={C.orange}
                />
              ) : null}
            </div>
          </Section>
        ) : null}

        {/* 5. BESUCHER-INSIGHTS */}
        <Section title="Besucher-Insights">
          {loading ? (
            <InsightsSkeleton />
          ) : ready && computed ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InsightTile
                label="Bounce-Rate"
                value={
                  computed.bounce.available
                    ? `${computed.bounce.rate}%`
                    : "—"
                }
                hint={
                  computed.bounce.available
                    ? `${computed.bounce.bounced} von ${computed.bounce.totalSessions} Sessions ohne Item-Klick`
                    : "Zu wenig Daten — mind. 5 Sessions nötig"
                }
                color={C.red}
              />
              <InsightTile
                label="Ø Session-Dauer"
                value={formatDuration(computed.avgSessionDurationSeconds)}
                hint={
                  computed.avgSessionDurationSeconds > 0
                    ? "Aus session_end-Events"
                    : "Wird erst gemessen, sobald Gäste die Karte verlassen"
                }
                color={C.teal}
              />
              <InsightTile
                label="Wiederkehrer"
                value={
                  computed.returningVisitor.available
                    ? `${computed.returningVisitor.returningPct}%`
                    : "—"
                }
                hint={
                  computed.returningVisitor.available
                    ? `Erstbesuch ${computed.returningVisitor.firstVisitPct}%`
                    : "Tracker setzt return_visit noch nicht (persistenter localStorage-Visitor-ID benötigt)"
                }
                color={C.blue}
              />
              <InsightTile
                label="Peak-Tag"
                value={computed.peakDayOfWeek?.dayLabel ?? "—"}
                hint={
                  computed.peakDayOfWeek
                    ? `${computed.peakDayOfWeek.count} Sessions an diesem Wochentag`
                    : "Keine Daten"
                }
                color={C.yellow}
              />
            </div>
          ) : (
            <Empty />
          )}
        </Section>

        {/* 6. CONSENT-FUNNEL */}
        <Section title="Consent-Funnel">
          {loading ? (
            <div className="h-32 animate-pulse rounded-xl" style={{ background: C.cardBgInner }} />
          ) : ready && computed ? (
            <ConsentFunnel
              total={computed.consent.totalSessions}
              withConsent={computed.consent.withConsent}
              withoutConsent={computed.consent.withoutConsent}
              ratePct={computed.consent.ratePct}
            />
          ) : (
            <Empty />
          )}
        </Section>

        {/* 7. WERBEPARTNER-KENNZAHLEN */}
        <Section title="Werbepartner-Kennzahlen" accent={C.orange}>
          {loading ? (
            <InsightsSkeleton />
          ) : ready && computed ? (
            (() => {
              // Dominante Subkategorie aus dem 8-Werte-Schema neu berechnen.
              let dominantKey: string | null = null;
              let dominantCount = 0;
              for (const k of DRINK_KEYS) {
                const v = computed.beverage_subcategory_clicks[k] ?? 0;
                if (v > dominantCount) {
                  dominantCount = v;
                  dominantKey = k;
                }
              }
              const dominantMeta = dominantKey ? DRINK_LABELS[dominantKey] : null;
              return (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InsightTile
                label="Dominante Drink-Kategorie"
                value={dominantMeta ? dominantMeta.label : "—"}
                hint={
                  dominantMeta
                    ? `${dominantCount} Klicks im Zeitraum`
                    : "Keine Drink-Klicks erfasst"
                }
                color={dominantMeta ? dominantMeta.color : C.textMuted}
              />
              <InsightTile
                label="Peak-Slot"
                value={
                  computed.peakDayOfWeek && computed.peakHourWindow
                    ? `${computed.peakDayOfWeek.dayLabel.slice(0, 2).toUpperCase()} ${formatHourRange(computed.peakHourWindow.fromHour, computed.peakHourWindow.toHour)}`
                    : "—"
                }
                hint={
                  computed.peakHourWindow
                    ? `${computed.peakHourWindow.sessionsInWindow} Sessions im 3h-Fenster`
                    : "Keine Daten"
                }
                color={C.yellow}
              />
              <InsightTile
                label="Impressionen"
                value={computed.totalImpressions.toLocaleString("de-DE")}
                hint="Item-Detail-Klicks im Zeitraum"
                color={C.teal}
              />
              <InsightTile
                label="Consent-Qualität"
                value={`${computed.consent.ratePct}%`}
                hint={
                  computed.consent.ratePct >= 60
                    ? "Hohe Qualität für Targeting"
                    : computed.consent.ratePct >= 30
                      ? "Mittlere Targeting-Qualität"
                      : "Niedrige Targeting-Qualität"
                }
                color={
                  computed.consent.ratePct >= 60
                    ? C.green
                    : computed.consent.ratePct >= 30
                      ? C.yellow
                      : C.red
                }
              />
            </div>
              );
            })()
          ) : (
            <Empty />
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ ...card, padding: 18, marginBottom: 14 }}>
      <h2
        style={{
          ...sectionTitle,
          marginBottom: 14,
          color: accent ?? C.textFaint,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty() {
  return (
    <p className="text-sm" style={{ color: C.textMuted }}>
      Keine Daten im Zeitraum.
    </p>
  );
}

/** „Schöne" obere Achsen-Grenze: 4 → 5, 14 → 20, 25 → 50 etc. */
function niceMaxValue(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 5;
  if (v < 5) return 5;
  const exponent = Math.floor(Math.log10(v));
  const fraction = v / Math.pow(10, exponent);
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * Math.pow(10, exponent);
}

function ScansLineChart({ labels, counts }: { labels: string[]; counts: number[] }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const fillRef = useRef<SVGPathElement>(null);
  const [width, setWidth] = useState(640);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Container-Breite messen, damit das SVG responsiv ist.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(280, Math.round(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const PAD_L = 36;
  const PAD_R = 12;
  const PAD_T = 14;
  const PAD_B = 26;
  const H = 220;
  const chartW = Math.max(60, width - PAD_L - PAD_R);
  const chartH = H - PAD_T - PAD_B;

  const rawMax = counts.length > 0 ? Math.max(0, ...counts) : 0;
  const yMax = niceMaxValue(rawMax);
  const Y_TICKS = 4;

  const xPos = (i: number): number => {
    if (counts.length <= 1) return PAD_L + chartW / 2;
    return PAD_L + (i / (counts.length - 1)) * chartW;
  };
  const yPos = (c: number): number => {
    if (yMax === 0) return PAD_T + chartH;
    return PAD_T + chartH - (Math.max(0, c) / yMax) * chartH;
  };

  const pathD =
    counts.length === 0
      ? ""
      : counts
          .map((c, i) => `${i === 0 ? "M" : "L"}${xPos(i).toFixed(2)},${yPos(c).toFixed(2)}`)
          .join(" ");
  const fillD =
    counts.length === 0
      ? ""
      : `${pathD} L${xPos(counts.length - 1).toFixed(2)},${(PAD_T + chartH).toFixed(2)} L${xPos(0).toFixed(2)},${(PAD_T + chartH).toFixed(2)} Z`;

  // Linie zeichnet sich von links nach rechts ein (stroke-dashoffset).
  // Reagiert auf Daten- und Breitenwechsel.
  useLayoutEffect(() => {
    const p = pathRef.current;
    const f = fillRef.current;
    if (!p) return;
    const len = p.getTotalLength();
    if (!Number.isFinite(len) || len === 0) return;
    p.style.transition = "none";
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    if (f) {
      f.style.transition = "none";
      f.style.opacity = "0";
    }
    // Reflow erzwingen, damit der zweite Style-Block die Animation triggert.
    void p.getBoundingClientRect();
    requestAnimationFrame(() => {
      p.style.transition = "stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1)";
      p.style.strokeDashoffset = "0";
      if (f) {
        f.style.transition = "opacity 1.4s ease 0.2s";
        f.style.opacity = "1";
      }
    });
  }, [pathD, width]);

  // X-Achse: maximal ~8 Labels — bei mehr Tagen werden Zwischen-Labels ausgeblendet.
  const labelStep = counts.length > 0 ? Math.max(1, Math.ceil(counts.length / 8)) : 1;

  const hoverX = hoverIdx != null ? xPos(hoverIdx) : 0;
  const hoverY = hoverIdx != null ? yPos(counts[hoverIdx] ?? 0) : 0;
  const hoverCount = hoverIdx != null ? counts[hoverIdx] ?? 0 : 0;
  const hoverLabel = hoverIdx != null ? labels[hoverIdx] ?? "" : "";

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%" }}>
      {counts.length === 0 ? (
        <div style={{ height: H, display: "grid", placeItems: "center", color: C.textMuted, fontSize: 13 }}>
          Keine Daten.
        </div>
      ) : (
        <svg
          width={width}
          height={H}
          viewBox={`0 0 ${width} ${H}`}
          style={{ display: "block", overflow: "visible" }}
          role="img"
          aria-label="Scans pro Tag — Liniendiagramm"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="qr-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.teal} stopOpacity="0.42" />
              <stop offset="100%" stopColor={C.teal} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y-Achse: Grid + Werte */}
          {Array.from({ length: Y_TICKS + 1 }).map((_, i) => {
            const v = (yMax / Y_TICKS) * (Y_TICKS - i);
            const y = PAD_T + (chartH / Y_TICKS) * i;
            return (
              <g key={`y-${i}`}>
                <line
                  x1={PAD_L}
                  x2={width - PAD_R}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                  strokeDasharray={i === Y_TICKS ? undefined : "2 4"}
                />
                <text
                  x={PAD_L - 6}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="rgba(255,255,255,0.4)"
                  fontSize={10}
                  fontFamily="inherit"
                >
                  {Math.round(v)}
                </text>
              </g>
            );
          })}

          {/* X-Achse: Datums-Labels */}
          {labels.map((lbl, i) => {
            if (i % labelStep !== 0 && i !== labels.length - 1) return null;
            return (
              <text
                key={`x-${i}`}
                x={xPos(i)}
                y={H - 8}
                textAnchor="middle"
                fill="rgba(255,255,255,0.45)"
                fontSize={10}
                fontFamily="inherit"
              >
                {lbl}
              </text>
            );
          })}

          {/* Gradient-Fill unter der Linie */}
          {fillD ? (
            <path
              ref={fillRef}
              d={fillD}
              fill="url(#qr-chart-fill)"
              style={{ opacity: 0 }}
            />
          ) : null}

          {/* Linie */}
          {pathD ? (
            <path
              ref={pathRef}
              d={pathD}
              fill="none"
              stroke={C.teal}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: `drop-shadow(0 0 6px ${C.teal}55)` }}
            />
          ) : null}

          {/* Vertikale Hover-Linie */}
          {hoverIdx != null ? (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PAD_T}
              y2={PAD_T + chartH}
              stroke={C.teal}
              strokeOpacity={0.35}
              strokeWidth={1}
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          ) : null}

          {/* Datenpunkte mit Hover */}
          {counts.map((c, i) => {
            const cx = xPos(i);
            const cy = yPos(c);
            const isActive = hoverIdx === i;
            return (
              <g key={`pt-${i}`}>
                {/* Sichtbarer Punkt */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isActive ? 5 : 3}
                  fill={C.teal}
                  stroke={C.bg}
                  strokeWidth={1.5}
                  style={{
                    transition: "r 180ms ease",
                    filter: isActive ? `drop-shadow(0 0 6px ${C.teal})` : "none",
                  }}
                />
                {/* Größere Hover-Hitbox */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={Math.max(10, chartW / counts.length / 2)}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseMove={() => setHoverIdx(i)}
                />
              </g>
            );
          })}
        </svg>
      )}

      {hoverIdx != null ? (
        <div
          style={{
            position: "absolute",
            left: hoverX,
            top: hoverY,
            transform: "translate(-50%, calc(-100% - 12px))",
            pointerEvents: "none",
            background: "rgba(12,12,15,0.96)",
            border: `1px solid ${C.teal}55`,
            borderRadius: 10,
            padding: "6px 10px",
            fontSize: 11,
            color: "#fff",
            whiteSpace: "nowrap",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            zIndex: 10,
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, marginBottom: 1 }}>
            {hoverLabel}
          </div>
          <div style={{ color: C.teal, fontWeight: 700, fontSize: 13 }}>
            {hoverCount} {hoverCount === 1 ? "Scan" : "Scans"}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TimeBlocksRow({
  blocks,
}: {
  blocks: { morning: number; midday: number; evening: number; night: number };
}) {
  const max = Math.max(1, blocks.morning, blocks.midday, blocks.evening, blocks.night);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <TimeBlock label="Morgen" sub="6–11 Uhr" n={blocks.morning} max={max} color={C.teal} />
      <TimeBlock label="Mittag" sub="11–15 Uhr" n={blocks.midday} max={max} color={C.yellow} />
      <TimeBlock label="Abend" sub="15–22 Uhr" n={blocks.evening} max={max} color={C.orange} />
      <TimeBlock label="Nacht" sub="22–6 Uhr" n={blocks.night} max={max} color={C.blue} />
    </div>
  );
}

function TimeBlock({
  label,
  sub,
  n,
  max,
  color,
}: {
  label: string;
  sub: string;
  n: number;
  max: number;
  color: string;
}) {
  const pct = Math.round((n / max) * 100);
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{ background: C.cardBgInner, border: `1px solid ${C.borderFaint}` }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider leading-tight" style={{ color: C.textFaint }}>
        {label}
      </p>
      <p className="text-[10px]" style={{ color: C.textMuted }}>
        {sub}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color }}>
        {n}
      </p>
      <div
        className="mx-auto mt-2 h-1.5 max-w-[80px] overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function RankList({
  title,
  rows,
  color,
  emptyText,
  priceLookup,
}: {
  title: string;
  rows: Array<{ name: string; count: number }>;
  color: string;
  emptyText: string;
  /** Optional: zeigt rechts neben der Klickzahl den modalen Preis aus `top_items`. */
  priceLookup?: Map<string, number | null>;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold text-white">{title}</p>
      <ul className="m-0 list-none space-y-2 p-0">
        {rows.length === 0 ? (
          <li className="text-sm" style={{ color: C.textMuted }}>
            {emptyText}
          </li>
        ) : (
          rows.map((it, i) => {
            const price = priceLookup?.get(it.name);
            return (
              <li key={`${it.name}-${i}`} className="flex justify-between gap-2 text-sm">
                <span className="min-w-0 truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {i + 1}. {it.name}
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="font-bold tabular-nums" style={{ color }}>
                    {it.count}
                  </span>
                  {price != null ? (
                    <span
                      className="text-xs font-medium tabular-nums"
                      style={{ color: C.textMuted }}
                    >
                      {formatEur(price)}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function DrinkPerformance({
  top,
  breakdown,
}: {
  top: Array<{ name: string; count: number }>;
  breakdown: Record<string, number>;
}) {
  const totalBreakdown = DRINK_KEYS.reduce((acc, k) => acc + (breakdown[k] ?? 0), 0);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <RankList
        title="Top 10 Getränke"
        rows={top}
        color={C.teal}
        emptyText="Keine Getränke-Klicks im Zeitraum"
      />
      <div>
        <p className="mb-2 text-xs font-bold text-white">Verteilung nach Subkategorie</p>
        {totalBreakdown === 0 ? (
          <p className="text-sm" style={{ color: C.textMuted }}>
            Keine Drink-Klicks erfasst
          </p>
        ) : (
          <ul className="m-0 list-none space-y-3 p-0">
            {DRINK_KEYS.map((k) => {
              const v = breakdown[k] ?? 0;
              const meta = DRINK_LABELS[k];
              const pct = totalBreakdown > 0 ? Math.round((v / totalBreakdown) * 100) : 0;
              return (
                <li key={k}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span style={{ color: "rgba(255,255,255,0.85)" }}>{meta.label}</span>
                    <span className="tabular-nums font-bold" style={{ color: meta.color }}>
                      {v} · {pct}%
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: meta.color }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function InsightTile({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: C.cardBgInner, border: `1px solid ${C.borderFaint}` }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textFaint }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums leading-tight" style={{ color }}>
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug" style={{ color: C.textMuted }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function ConsentFunnel({
  total,
  withConsent,
  withoutConsent,
  ratePct,
}: {
  total: number;
  withConsent: number;
  withoutConsent: number;
  ratePct: number;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        <FunnelTile label="Besucher gesamt" value={total} color="#fff" />
        <FunnelTile label="Mit Consent" value={withConsent} color={C.green} />
        <FunnelTile label="Ohne Consent" value={withoutConsent} color={C.textMuted} />
      </div>
      <p className="mt-4 text-sm font-semibold text-white">Consent-Rate: {ratePct}%</p>
      <div
        className="mt-2 h-3 overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${Math.min(100, Math.max(0, ratePct))}%`,
            background: C.teal,
          }}
        />
      </div>
    </>
  );
}

function FunnelTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{ background: C.cardBgInner, border: `1px solid ${C.borderFaint}` }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textFaint }}>
        {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-[180px] items-end gap-1">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 animate-pulse rounded-t-md"
          style={{ height: `${20 + ((i * 7) % 80)}px`, background: "rgba(255,255,255,0.08)" }}
        />
      ))}
    </div>
  );
}

function DrinkSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between gap-2">
            <div className="h-4 flex-1 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="h-4 w-8 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-4 w-40 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-3 animate-pulse rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
        ))}
      </div>
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {[0, 1].map((col) => (
        <div key={col} className="space-y-2">
          <div className="mb-2 h-4 w-28 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between gap-2">
              <div className="h-4 flex-1 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
              <div className="h-4 w-8 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((k) => (
        <div key={k} className="h-24 animate-pulse rounded-xl" style={{ background: C.cardBgInner }} />
      ))}
    </div>
  );
}

function useNoiseDataUri(): string {
  return useRef(
    `data:image/svg+xml;utf8,${encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='1'/></svg>",
    )}`,
  ).current;
}
