"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { FounderDashboardData, FounderScanEventRow } from "@/lib/founder-types";
import { berlinYmd, lastNCalendarDaysBerlin, startOfBerlinYmdUtcIso } from "@/lib/berlin-time";
import { fp } from "../founder-palette";

const WEEK_SCAN_TARGET = 500;

const eurFmt = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

type OverviewScanRange = "today" | "week" | "month" | "year";

const RANGE_TABS: { id: OverviewScanRange; label: string }[] = [
  { id: "today", label: "Heute" },
  { id: "week", label: "Woche" },
  { id: "month", label: "Monat" },
  { id: "year", label: "Jahr" },
];

function selectScanEvents(data: FounderDashboardData, range: OverviewScanRange): FounderScanEventRow[] {
  switch (range) {
    case "today":
      return data.scanEventsToday;
    case "week":
      return data.scanEventsWeek;
    case "month":
      return data.scanEventsMonth;
    case "year":
      return data.scanEventsYear;
    default: {
      const _exhaustive: never = range;
      return _exhaustive;
    }
  }
}

function consentSubtitle(range: OverviewScanRange): string {
  switch (range) {
    case "today":
      return "Tracking-Stufe ≥ 1 · heute (Europe/Berlin)";
    case "week":
      return "Tracking-Stufe ≥ 1 · letzte 7 Tage";
    case "month":
      return "Tracking-Stufe ≥ 1 · letzte 30 Tage";
    case "year":
      return "Tracking-Stufe ≥ 1 · laufendes Jahr (Berlin)";
    default: {
      const _e: never = range;
      return _e;
    }
  }
}

function heroScanLabel(range: OverviewScanRange): string {
  switch (range) {
    case "today":
      return "Scans (heute)";
    case "week":
      return "Scans (7 Tage)";
    case "month":
      return "Scans (30 Tage)";
    case "year":
      return "Scans (Jahr)";
    default: {
      const _e: never = range;
      return _e;
    }
  }
}

function heroBodyText(range: OverviewScanRange): string {
  switch (range) {
    case "today":
      return "Stundenverteilung für heute (Mitternacht bis jetzt, Europe/Berlin).";
    case "week":
      return "Scans der letzten 7 Tage und Fortschritt Live-Standorte — Daten aus Supabase.";
    case "month":
      return "Tägliche Verteilung der letzten 30 Kalendertage (Europe/Berlin).";
    case "year":
      return "Monatsverteilung im laufenden Kalenderjahr (Europe/Berlin).";
    default: {
      const _e: never = range;
      return _e;
    }
  }
}

function hourlyCountsBerlin(events: FounderScanEventRow[]): number[] {
  const c = Array.from({ length: 24 }, () => 0);
  for (const e of events) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date(e.created_at));
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    if (h >= 0 && h < 24) c[h]++;
  }
  return c;
}

function countsForYmdOrder(events: FounderScanEventRow[], ymds: string[]): number[] {
  const idx = new Map(ymds.map((y, i) => [y, i]));
  const out = ymds.map(() => 0);
  for (const e of events) {
    const y = berlinYmd(new Date(e.created_at));
    const i = idx.get(y);
    if (i !== undefined) out[i]++;
  }
  return out;
}

function berlinYearMonth(iso: string): { year: number; month: number } {
  const d = new Date(iso);
  const year = Number(d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin", year: "numeric" }));
  const month = Number(d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin", month: "numeric" }));
  return { year, month };
}

function monthlyCountsBerlinYear(events: FounderScanEventRow[], ref: Date): number[] {
  const y = Number(ref.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin", year: "numeric" }));
  const out = Array.from({ length: 12 }, () => 0);
  for (const e of events) {
    const { year, month } = berlinYearMonth(e.created_at);
    if (year === y && month >= 1 && month <= 12) out[month - 1]++;
  }
  return out;
}

function labelForBerlinYmd(ymd: string): string {
  const inst = new Date(startOfBerlinYmdUtcIso(ymd));
  return inst.toLocaleDateString("de-DE", { weekday: "short", day: "numeric" });
}

const MONTH_SHORT_DE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function buildAreaPath(
  counts: number[],
  width: number,
  height: number,
  padX: number,
  padY: number,
): { lineD: string; areaD: string } {
  const n = counts.length;
  if (n === 0) return { lineD: "", areaD: "" };
  const max = Math.max(1, ...counts);
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const step = n > 1 ? innerW / (n - 1) : 0;
  const baseY = height - padY;
  const pts: { x: number; y: number }[] = counts.map((c, i) => ({
    x: padX + i * step,
    y: padY + innerH - (c / max) * innerH,
  }));
  let lineD = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i++) {
    lineD += ` L ${pts[i]!.x} ${pts[i]!.y}`;
  }
  const last = pts[pts.length - 1]!;
  const first = pts[0]!;
  const areaD = `${lineD} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
  return { lineD, areaD };
}

type Props = {
  data: FounderDashboardData;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
};

function cardStyle(pad: number): CSSProperties {
  return {
    background: fp.card,
    borderRadius: 16,
    border: `1px solid ${fp.line}`,
    boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
    padding: `${pad}px ${pad + 2}px`,
  };
}

function ProgressBar({ pct, accent }: { pct: number; accent: string }) {
  return (
    <div
      style={{
        height: 6,
        borderRadius: 3,
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
        marginTop: 12,
        width: "100%",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.min(100, Math.max(0, pct))}%`,
          borderRadius: 3,
          background: accent,
          boxShadow: `0 0 12px ${accent}55`,
          transition: "width 0.8s cubic-bezier(0.25,1,0.5,1)",
        }}
      />
    </div>
  );
}

export function OverviewTab({ data, isMobile, isTablet, isDesktop }: Props) {
  const [scanRange, setScanRange] = useState<OverviewScanRange>("week");

  const pad = isMobile ? 14 : 18;
  const kpiCols = isDesktop ? "repeat(4, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))";
  const kpiTitleFs = isMobile ? 10 : 11;
  const kpiNumFs = isMobile ? 22 : 28;
  const mrrFs = isMobile ? 20 : 24;

  const selectedEvents = useMemo(() => selectScanEvents(data, scanRange), [data, scanRange]);

  const total = data.restaurants.length;
  const aktiv = data.restaurants.filter((r) => r.aktiv).length;
  const pctLive = total === 0 ? 0 : Math.round((aktiv / total) * 100);

  const scansTodayBerlin = data.scanEventsToday.length;

  const liveRestaurants = data.restaurants.filter((r) => r.aktiv);
  const mrrSum = liveRestaurants.reduce((s, r) => s + (Number(r.umsatz_monat) || 0), 0);

  const weekScans = data.scanEventsWeek.length;
  const weekPct = Math.min(100, Math.round((weekScans / WEEK_SCAN_TARGET) * 100));

  const totalEv = selectedEvents.length;
  const withConsent = selectedEvents.filter((e) => e.tier >= 1).length;
  const consentPct = totalEv === 0 ? 0 : Math.round((withConsent / totalEv) * 100);
  const consentRemain = 100 - consentPct;

  const { chartCounts, chartLabels } = useMemo(() => {
    const now = new Date();
    if (scanRange === "today") {
      const counts = hourlyCountsBerlin(selectedEvents);
      const labels = counts.map((_, i) => `${i}h`);
      return { chartCounts: counts, chartLabels: labels };
    }
    if (scanRange === "week") {
      const ymds = lastNCalendarDaysBerlin(7, now);
      const counts = countsForYmdOrder(selectedEvents, ymds);
      const labels = ymds.map((y) => labelForBerlinYmd(y));
      return { chartCounts: counts, chartLabels: labels };
    }
    if (scanRange === "month") {
      const ymds = lastNCalendarDaysBerlin(30, now);
      const counts = countsForYmdOrder(selectedEvents, ymds);
      const labels = ymds.map((y, i) => {
        if (isMobile && i % 5 !== 0 && i !== ymds.length - 1) return "";
        return labelForBerlinYmd(y);
      });
      return { chartCounts: counts, chartLabels: labels };
    }
    const counts = monthlyCountsBerlinYear(selectedEvents, now);
    return { chartCounts: counts, chartLabels: [...MONTH_SHORT_DE] };
  }, [scanRange, selectedEvents, isMobile]);

  const w = 560;
  const h = isMobile ? 120 : 140;
  const { lineD, areaD } = buildAreaPath(chartCounts, w, h, 8, 10);

  const r = isMobile ? 38 : 44;
  const c = 2 * Math.PI * r;
  const dashConsent = (consentPct / 100) * c;
  const dashAnon = (consentRemain / 100) * c;

  const heroTitleFs = isMobile ? 17 : isTablet ? 18 : 20;
  const heroBodyFs = isMobile ? 12 : 13;

  const tabBtnFs = isMobile ? 11 : 12;

  return (
    <div className="flex flex-col gap-5 pb-6" style={{ gap: isMobile ? 14 : 20 }}>
      <div className="grid gap-4" style={{ gridTemplateColumns: kpiCols, gap: isMobile ? 10 : 16 }}>
        <div style={cardStyle(pad)}>
          <p style={{ fontSize: kpiTitleFs, fontWeight: 700, letterSpacing: "0.06em", color: fp.mu, margin: 0 }}>
            RESTAURANTS LIVE
          </p>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: kpiNumFs,
              fontWeight: 800,
              color: fp.tx,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {aktiv}
            <span style={{ fontSize: isMobile ? 13 : 15, fontWeight: 600, color: fp.mu }}> / {total}</span>
          </p>
        </div>
        <div style={cardStyle(pad)}>
          <p style={{ fontSize: kpiTitleFs, fontWeight: 700, letterSpacing: "0.06em", color: fp.mu, margin: 0 }}>
            SCANS HEUTE
          </p>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: kpiNumFs,
              fontWeight: 800,
              color: fp.blue,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {scansTodayBerlin}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: isMobile ? 10 : 11, color: fp.mu }}>0:00 Europe/Berlin</p>
        </div>
        <div style={cardStyle(pad)}>
          <p style={{ fontSize: kpiTitleFs, fontWeight: 700, letterSpacing: "0.06em", color: fp.mu, margin: 0 }}>MRR</p>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: mrrFs,
              fontWeight: 800,
              color: fp.green,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {eurFmt.format(mrrSum)}
          </p>
        </div>
        <div style={cardStyle(pad)}>
          <p style={{ fontSize: kpiTitleFs, fontWeight: 700, letterSpacing: "0.06em", color: fp.mu, margin: 0 }}>
            CONSENT-RATE
          </p>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: kpiNumFs,
              fontWeight: 800,
              color: fp.yellow,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {consentPct}%
          </p>
          <p style={{ margin: "6px 0 0", fontSize: isMobile ? 10 : 11, color: fp.mu }}>{consentSubtitle(scanRange)}</p>
        </div>
      </div>

      <div style={{ ...cardStyle(isMobile ? 14 : 24), padding: isMobile ? 14 : 24 }}>
        <div
          className="flex flex-wrap gap-2"
          style={{ marginBottom: isMobile ? 12 : 16 }}
          role="tablist"
          aria-label="Zeitraum Scans"
        >
          {RANGE_TABS.map((t) => {
            const active = scanRange === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setScanRange(t.id)}
                style={{
                  padding: `${isMobile ? 6 : 8}px ${isMobile ? 12 : 14}px`,
                  borderRadius: 9999,
                  fontSize: tabBtnFs,
                  fontWeight: 700,
                  border: `1px solid ${active ? fp.or : fp.line}`,
                  background: active ? "rgba(255,149,0,0.12)" : "rgba(255,255,255,0.04)",
                  color: active ? fp.tx : fp.mu,
                  cursor: "pointer",
                  transition: "background 0.15s, border-color 0.15s, color 0.15s",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: isTablet ? "column" : "row",
            flexWrap: "wrap",
            alignItems: isTablet ? "stretch" : "flex-start",
            justifyContent: "space-between",
            gap: isMobile ? 12 : 16,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: heroTitleFs, fontWeight: 800, color: fp.tx }}>Willkommen zurück</h2>
            <p style={{ margin: "8px 0 0", fontSize: heroBodyFs, color: fp.mu, maxWidth: 420 }}>
              {heroBodyText(scanRange)}
            </p>
          </div>
          <div style={{ textAlign: isTablet ? "left" : "right" }}>
            <p style={{ margin: 0, fontSize: 11, color: fp.mu }}>{heroScanLabel(scanRange)}</p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: isMobile ? 18 : 22,
                fontWeight: 800,
                color: fp.or,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {selectedEvents.length}
            </p>
          </div>
        </div>

        <div style={{ marginTop: 16, width: "100%", overflow: "hidden" }}>
          <svg
            viewBox={`0 0 ${w} ${h}`}
            width="100%"
            height={h}
            preserveAspectRatio="none"
            style={{ display: "block" }}
            aria-hidden
          >
            <defs>
              <linearGradient id="ovAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fp.or} stopOpacity="0.35" />
                <stop offset="100%" stopColor={fp.or} stopOpacity="0" />
              </linearGradient>
            </defs>
            {areaD ? <path d={areaD} fill="url(#ovAreaFill)" /> : null}
            {lineD ? (
              <path d={lineD} fill="none" stroke={fp.or} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            ) : null}
          </svg>
          <div
            className="flex justify-between"
            style={{
              marginTop: 6,
              paddingLeft: 2,
              paddingRight: 2,
              gap: scanRange === "month" ? 0 : undefined,
            }}
          >
            {chartLabels.map((lbl, i) => (
              <span
                key={`${lbl}-${i}`}
                style={{
                  fontSize: isMobile ? 8 : scanRange === "month" ? 7 : 10,
                  color: fp.mu,
                  fontWeight: 600,
                  flex: scanRange === "month" ? "1 1 0" : undefined,
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {lbl}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="flex justify-between text-xs" style={{ color: fp.mi, fontSize: isMobile ? 11 : 12 }}>
            <span>Live-Standorte</span>
            <span style={{ fontWeight: 700, color: fp.tx }}>{pctLive}%</span>
          </div>
          <ProgressBar pct={pctLive} accent={fp.or} />
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="flex justify-between text-xs" style={{ color: fp.mi, fontSize: isMobile ? 11 : 12 }}>
            <span>Wochen-Scans (Ziel {WEEK_SCAN_TARGET})</span>
            <span style={{ fontWeight: 700, color: fp.tx }}>{weekPct}%</span>
          </div>
          <ProgressBar pct={weekPct} accent={fp.blue} />
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-10"
        style={{
          ...cardStyle(isMobile ? 14 : 24),
          padding: isMobile ? 14 : 24,
          gap: isMobile ? 16 : 40,
        }}
      >
        <div style={{ position: "relative", width: isMobile ? 100 : 120, height: isMobile ? 100 : 120, flexShrink: 0 }}>
          <svg width={isMobile ? 100 : 120} height={isMobile ? 100 : 120} viewBox="0 0 120 120" aria-hidden>
            <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={14} />
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={fp.green}
              strokeWidth={14}
              strokeDasharray={`${dashConsent} ${c}`}
              strokeDashoffset={0}
              transform="rotate(-90 60 60)"
            />
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={fp.line2}
              strokeWidth={14}
              strokeDasharray={`${dashAnon} ${c}`}
              strokeDashoffset={-dashConsent}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: fp.tx }}>{consentPct}%</span>
            <span style={{ fontSize: 10, color: fp.mu, fontWeight: 600 }}>Consent</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 style={{ margin: 0, fontSize: isMobile ? 14 : 16, fontWeight: 800, color: fp.tx }}>
            Einwilligung (Scan-Events)
          </h3>
          <p style={{ margin: "8px 0 0", fontSize: isMobile ? 12 : 13, color: fp.mu, lineHeight: 1.5 }}>
            Anteil der Events mit Tracking-Stufe ≥ 1 für den gewählten Zeitraum. Gesamt:{" "}
            <strong style={{ color: fp.tx }}>{totalEv}</strong> Events.
          </p>
          <div
            className={isTablet || isMobile ? "grid gap-3" : "mt-4 flex flex-wrap gap-6"}
            style={
              isTablet || isMobile
                ? { marginTop: 14, gridTemplateColumns: "repeat(2, minmax(0, 1fr))", fontSize: 12 }
                : { marginTop: 16, fontSize: 12 }
            }
          >
            <div className="flex items-center gap-2">
              <span style={{ width: 10, height: 10, borderRadius: 9999, background: fp.green }} />
              <span style={{ color: fp.mi }}>Mit Einwilligung</span>
              <span style={{ fontWeight: 700, color: fp.tx }}>{withConsent}</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ width: 10, height: 10, borderRadius: 9999, background: fp.line2 }} />
              <span style={{ color: fp.mi }}>Anonym (tier 0)</span>
              <span style={{ fontWeight: 700, color: fp.tx }}>{totalEv - withConsent}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
