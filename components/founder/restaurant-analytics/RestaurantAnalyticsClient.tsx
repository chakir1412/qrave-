"use client";

import { Roboto } from "next/font/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { fp } from "@/components/founder/founder-palette";
import { iterateBerlinDaysInclusive } from "@/lib/berlin-time";
import type { RestaurantAnalyticsApiPayload } from "@/lib/restaurant-analytics-api-types";
import { defaultLast7Ymd } from "@/lib/restaurant-analytics-presets";
import { RangeCalendarModal } from "./RangeCalendarModal";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

const BG = "#070818";
const OR = "#FF5C1A";
const GREEN = "#34E89E";

const card: CSSProperties = {
  background: "linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))",
  borderRadius: 20,
  border: "0.5px solid rgba(255,255,255,0.09)",
  boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
};

function csvEscape(cell: string): string {
  if (/[",\r\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

/** Anzeige wie „22. März – 28. März“ (ohne Jahr wenn gleiches Jahr). */
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

function formatBerlinDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  /** Skeleton sofort vor dem ersten Paint nach Zeitraum-/Restaurant-Wechsel (auch Browser-Zurück). */
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
    const lines: string[] = [];
    lines.push("SCANS_PRO_TAG");
    lines.push(["Kalendertag_Berlin", "QR_Scans"].map(csvEscape).join(","));
    const days = iterateBerlinDaysInclusive(data.fromYmd, data.toYmd);
    for (const d of days) {
      lines.push([d, String(data.computed.scansByBerlinDay[d] ?? 0)].map(csvEscape).join(","));
    }
    lines.push("");
    lines.push("TISCHE");
    lines.push(
      ["Tisch_Nr", "Bereich", "QR_Scans_Zeitraum", "Letzter_Scan_ISO", "QR_URL"].map(csvEscape).join(","),
    );
    for (const t of data.computed.tableCards) {
      lines.push(
        [String(t.tisch_nummer), t.bereich ?? "", String(t.scanCount), t.lastScanAt ?? "", t.qr_url ?? ""]
          .map(csvEscape)
          .join(","),
      );
    }
    lines.push("");
    lines.push("TOP_ITEMS");
    lines.push(["item_name", "klicks"].map(csvEscape).join(","));
    for (const it of data.computed.topItems) {
      lines.push([it.name, String(it.count)].map(csvEscape).join(","));
    }
    lines.push("");
    lines.push("TOP_KATEGORIEN");
    lines.push(["kategorie", "klicks"].map(csvEscape).join(","));
    for (const c of data.computed.topCategories) {
      lines.push([c.name, String(c.count)].map(csvEscape).join(","));
    }
    lines.push("");
    lines.push("CONSENT");
    lines.push(["besucher_gesamt", "mit_consent", "ohne_consent", "rate_prozent"].map(csvEscape).join(","));
    lines.push(
      [
        String(data.computed.consent.totalSessions),
        String(data.computed.consent.withConsent),
        String(data.computed.consent.withoutConsent),
        String(data.computed.consent.ratePct),
      ]
        .map(csvEscape)
        .join(","),
    );

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
  const maxChart = Math.max(1, ...(computed?.chartScanCounts ?? [0]));
  const ready = Boolean(!loading && data?.restaurant && computed);

  return (
    <div
      className={`min-h-screen pb-12 ${roboto.className}`}
      style={{ background: BG, color: fp.tx }}
      aria-busy={loading}
      aria-live="polite"
    >
      <div className="mx-auto max-w-3xl px-4 pt-4">
        {/* Zeile 1: Zurück | Zeitraum + Export rechts */}
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
            className="inline-flex items-center gap-2 text-sm font-bold"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            ← Restaurants
          </Link>

          <div className="flex w-full flex-wrap items-stretch justify-end gap-2 sm:w-auto sm:flex-nowrap">
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className={`min-h-[48px] flex-1 rounded-2xl px-4 py-3 text-left text-sm font-bold sm:min-w-[200px] sm:flex-none ${loading ? "animate-pulse" : ""}`}
              style={card}
            >
              <span className="block text-[10px] font-extrabold tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>
                ZEITRAUM
              </span>
              <span className="mt-0.5 block text-white">{rangeLabel}</span>
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!data?.restaurant || loading}
              className="min-h-[48px] rounded-2xl px-4 py-3 text-sm font-extrabold whitespace-nowrap"
              style={{
                ...card,
                border: `0.5px solid ${OR}55`,
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

        {loading ? (
          <p className="sr-only">Analytics werden geladen …</p>
        ) : null}

        {loadError ? (
          <div
            className="mb-4 rounded-2xl px-4 py-3 text-sm"
            style={{ border: `1px solid ${fp.red}55`, background: "rgba(255,75,110,0.1)", color: fp.red }}
          >
            {loadError}
          </div>
        ) : null}

        {!loading && !data?.restaurant && !loadError ? (
          <p className="text-sm" style={{ color: fp.mu }}>
            Restaurant nicht gefunden.
          </p>
        ) : null}

        {data?.restaurant ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-black text-white">{data.restaurant.name}</h1>
            <span
              className="rounded-full px-3 py-1 text-xs font-extrabold uppercase"
              style={{
                background: data.restaurant.aktiv ? "rgba(52,232,158,0.15)" : "rgba(255,255,255,0.08)",
                color: data.restaurant.aktiv ? GREEN : fp.mu,
                border: `1px solid ${data.restaurant.aktiv ? `${GREEN}44` : "rgba(255,255,255,0.12)"}`,
              }}
            >
              {data.restaurant.aktiv ? "Live" : "Offline"}
            </span>
          </div>
        ) : loading ? (
          <div className="mb-6 h-8 w-48 animate-pulse rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }} />
        ) : null}

        {/* 2. CHART */}
        <section style={{ ...card, padding: 20 }} className="mb-4">
          <h2 className="mb-4 text-[11px] font-extrabold tracking-wide" style={{ color: fp.mu }}>
            SCANS · {rangeLabel}
          </h2>
          {loading ? (
            <ChartSkeleton />
          ) : ready && computed && data?.restaurant ? (
            <>
              <div className="flex min-h-[180px] items-end gap-0.5 overflow-x-auto pb-1 sm:gap-1">
                {computed.chartLabels.map((lbl, i) => {
                  const c = computed.chartScanCounts[i] ?? 0;
                  const h = c === 0 ? 6 : Math.max(12, (c / maxChart) * 150);
                  const peak = c === maxChart && c > 0;
                  return (
                    <div key={`${lbl}-${i}`} className="flex min-w-[22px] flex-1 flex-col items-center justify-end gap-1">
                      <div
                        className="w-full max-w-[36px] rounded-t-lg sm:max-w-[40px]"
                        style={{
                          height: h,
                          background: `linear-gradient(180deg, ${OR}, rgba(255,92,26,0.35))`,
                          boxShadow: peak ? `0 0 12px ${OR}` : "none",
                        }}
                      />
                      <span
                        className="max-w-full truncate text-center text-[8px] font-semibold leading-tight sm:text-[9px]"
                        style={{ color: fp.mu }}
                      >
                        {lbl}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: fp.mu }}>
              {loadError ? "Daten konnten nicht geladen werden." : "Keine Daten."}
            </p>
          )}
        </section>

        {/* 3. TAGESZEIT */}
        <section style={{ ...card, padding: 20 }} className="mb-4">
          <h2 className="mb-4 text-[11px] font-extrabold tracking-wide" style={{ color: fp.mu }}>
            SCANS NACH TAGESZEIT (EUROPE/BERLIN)
          </h2>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((k) => (
                <div key={k} className="h-28 animate-pulse rounded-2xl" style={{ background: "rgba(0,0,0,0.2)" }} />
              ))}
            </div>
          ) : ready && computed ? (
            <TimeBlocksRow blocks={computed.timeBlocks} />
          ) : (
            <p className="text-sm" style={{ color: fp.mu }}>—</p>
          )}
        </section>

        {/* 4. TISCHE — kompakte 4er-Grid mit Farbcodierung
              grün ≥ 6 Scans · gelb 1–5 · rot 0 (kein Scan) */}
        <section style={{ ...card, padding: 20 }} className="mb-4">
          <h2 className="mb-3 text-[11px] font-extrabold tracking-wide" style={{ color: fp.mu }}>
            TISCHE
          </h2>
          {loading ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, k) => (
                <div
                  key={k}
                  className="aspect-square animate-pulse rounded-xl"
                  style={{ background: "rgba(0,0,0,0.25)" }}
                />
              ))}
            </div>
          ) : ready && computed ? (
            computed.tableCards.length === 0 ? (
              <p className="text-sm" style={{ color: fp.mu }}>
                Noch keine Tische angelegt
              </p>
            ) : (
              <>
                <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0">
                  {computed.tableCards.map((t) => {
                    const level: "off" | "low" | "ok" =
                      t.scanCount === 0 ? "off" : t.scanCount <= 5 ? "low" : "ok";
                    const palette =
                      level === "ok"
                        ? {
                            bg: "rgba(0,200,160,0.12)",
                            border: "rgba(0,200,160,0.45)",
                            count: "#34e89e",
                          }
                        : level === "low"
                          ? {
                              bg: "rgba(255,212,38,0.12)",
                              border: "rgba(255,212,38,0.45)",
                              count: "#ffd426",
                            }
                          : {
                              bg: "rgba(255,75,110,0.12)",
                              border: "rgba(255,75,110,0.4)",
                              count: "#ff4b6e",
                            };
                    const title = `Tisch ${t.tisch_nummer}${
                      t.bereich ? ` · ${t.bereich}` : ""
                    } — ${t.scanCount} Scan${t.scanCount === 1 ? "" : "s"}${
                      t.lastScanAt ? ` (letzter: ${formatBerlinDateTime(t.lastScanAt)})` : ""
                    }`;
                    return (
                      <li
                        key={t.id}
                        title={title}
                        className="relative aspect-square rounded-xl border"
                        style={{ background: palette.bg, borderColor: palette.border }}
                      >
                        <div className="flex h-full flex-col items-center justify-center px-1 text-center">
                          <span className="text-[10px] font-bold" style={{ color: fp.mu }}>
                            T{t.tisch_nummer}
                          </span>
                          <span
                            className="text-2xl font-extrabold tabular-nums"
                            style={{ color: palette.count }}
                          >
                            {t.scanCount}
                          </span>
                          {t.bereich ? (
                            <span
                              className="mt-0.5 max-w-full truncate text-[9px]"
                              style={{ color: fp.mu }}
                            >
                              {t.bereich}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px]" style={{ color: fp.mu }}>
                  <Legend bg="rgba(0,200,160,0.12)" border="rgba(0,200,160,0.45)" label="aktiv (≥ 6)" />
                  <Legend bg="rgba(255,212,38,0.12)" border="rgba(255,212,38,0.45)" label="wenig (1–5)" />
                  <Legend bg="rgba(255,75,110,0.12)" border="rgba(255,75,110,0.4)" label="kein Scan" />
                </div>
              </>
            )
          ) : (
            <p className="text-sm" style={{ color: fp.mu }}>
              —
            </p>
          )}
        </section>

        {/* 5. MENU PERFORMANCE */}
        <section style={{ ...card, padding: 20 }} className="mb-4">
          <h2 className="mb-4 text-[11px] font-extrabold tracking-wide" style={{ color: fp.mu }}>
            MENU PERFORMANCE
          </h2>
          {loading ? (
            <MenuSkeleton />
          ) : ready && computed ? (
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold text-white">Meistgeklickte Gerichte</p>
                <ul className="m-0 list-none space-y-2 p-0">
                  {computed.topItems.length === 0 ? (
                    <li className="text-sm" style={{ color: fp.mu }}>
                      Keine Klicks im Zeitraum
                    </li>
                  ) : (
                    computed.topItems.map((it) => (
                      <li key={it.name} className="flex justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{it.name}</span>
                        <span className="shrink-0 font-extrabold tabular-nums" style={{ color: OR }}>
                          {it.count}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold text-white">Meistbesuchte Kategorien</p>
                <ul className="m-0 list-none space-y-2 p-0">
                  {computed.topCategories.length === 0 ? (
                    <li className="text-sm" style={{ color: fp.mu }}>
                      Keine Klicks im Zeitraum
                    </li>
                  ) : (
                    computed.topCategories.map((c) => (
                      <li key={c.name} className="flex justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{c.name}</span>
                        <span className="shrink-0 font-extrabold tabular-nums" style={{ color: OR }}>
                          {c.count}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: fp.mu }}>—</p>
          )}
        </section>

        {/* 6. CONSENT */}
        <section style={{ ...card, padding: 20 }} className="mb-4">
          <h2 className="mb-4 text-[11px] font-extrabold tracking-wide" style={{ color: fp.mu }}>
            CONSENT-FUNNEL
          </h2>
          {loading ? (
            <div className="h-32 animate-pulse rounded-xl" style={{ background: "rgba(0,0,0,0.2)" }} />
          ) : ready && computed ? (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                <div className="rounded-xl p-3 text-center" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <p className="text-[10px] font-bold" style={{ color: fp.mu }}>
                    Besucher gesamt
                  </p>
                  <p className="text-xl font-extrabold text-white">{computed.consent.totalSessions}</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: "rgba(52,232,158,0.1)" }}>
                  <p className="text-[10px] font-bold" style={{ color: fp.mu }}>
                    Mit Consent
                  </p>
                  <p className="text-xl font-extrabold" style={{ color: GREEN }}>
                    {computed.consent.withConsent}
                  </p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <p className="text-[10px] font-bold" style={{ color: fp.mu }}>
                    Ohne Consent
                  </p>
                  <p className="text-xl font-extrabold text-white">{computed.consent.withoutConsent}</p>
                </div>
              </div>
              <p className="mt-4 text-sm font-extrabold text-white">
                Consent-Rate: {computed.consent.ratePct}%
              </p>
              <div className="mt-2 h-3 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, computed.consent.ratePct))}%`,
                    background: OR,
                  }}
                />
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: fp.mu }}>—</p>
          )}
        </section>
      </div>
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

function TimeBlocksRow({
  blocks,
}: {
  blocks: { morning: number; midday: number; evening: number; night: number };
}) {
  const max = Math.max(1, blocks.morning, blocks.midday, blocks.evening, blocks.night);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <TimeBlock label="Morgen (6–11 Uhr)" n={blocks.morning} max={max} />
      <TimeBlock label="Mittag (11–15 Uhr)" n={blocks.midday} max={max} />
      <TimeBlock label="Abend (15–22 Uhr)" n={blocks.evening} max={max} />
      <TimeBlock label="Nacht (22–6 Uhr)" n={blocks.night} max={max} />
    </div>
  );
}

function TimeBlock({ label, n, max }: { label: string; n: number; max: number }) {
  const pct = Math.round((n / max) * 100);
  return (
    <div
      className="rounded-2xl p-3 text-center"
      style={{ background: "rgba(0,0,0,0.22)", border: "0.5px solid rgba(255,255,255,0.08)" }}
    >
      <p className="text-[10px] font-bold leading-tight" style={{ color: "rgba(255,255,255,0.45)" }}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums" style={{ color: OR }}>
        {n}
      </p>
      <div className="mx-auto mt-2 h-1.5 max-w-[80px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: OR }} />
      </div>
    </div>
  );
}

function Legend({ bg, border, label }: { bg: string; border: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-3 rounded-sm border"
        style={{ background: bg, borderColor: border }}
      />
      {label}
    </span>
  );
}
