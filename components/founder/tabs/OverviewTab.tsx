"use client";

import type { CSSProperties } from "react";
import type { FounderDashboardData, FounderScanEventRow } from "@/lib/founder-types";
import { fp } from "../founder-palette";

const WEEK_SCAN_TARGET = 500;

const eurFmt = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function startOfLocalDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function countsLast7Days(events: FounderScanEventRow[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const day = new Date(today);
    day.setDate(day.getDate() - (6 - i));
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const a = day.getTime();
    const b = next.getTime();
    for (const e of events) {
      const t = new Date(e.created_at).getTime();
      if (t >= a && t < b) out[i]++;
    }
  }
  return out;
}

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
  const pad = isMobile ? 14 : 18;
  const kpiCols = isDesktop ? "repeat(4, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))";
  const kpiTitleFs = isMobile ? 10 : 11;
  const kpiNumFs = isMobile ? 22 : 28;
  const mrrFs = isMobile ? 20 : 24;

  const total = data.restaurants.length;
  const aktiv = data.restaurants.filter((r) => r.aktiv).length;
  const pctLive = total === 0 ? 0 : Math.round((aktiv / total) * 100);

  const day0 = startOfLocalDay().getTime();
  const scansToday = data.scanEvents.filter((e) => new Date(e.created_at).getTime() >= day0).length;

  const liveRestaurants = data.restaurants.filter((r) => r.aktiv);
  const mrrSum = liveRestaurants.reduce((s, r) => s + (Number(r.umsatz_monat) || 0), 0);

  const weekScans = data.scanEvents.length;
  const weekPct = Math.min(100, Math.round((weekScans / WEEK_SCAN_TARGET) * 100));

  const dayCounts = countsLast7Days(data.scanEvents);
  const w = 560;
  const h = isMobile ? 120 : 140;
  const { lineD, areaD } = buildAreaPath(dayCounts, w, h, 8, 10);

  const totalEv = data.scanEvents.length;
  const withConsent = data.scanEvents.filter((e) => e.tier >= 1).length;
  const consentPct = totalEv === 0 ? 0 : Math.round((withConsent / totalEv) * 100);
  const consentRemain = 100 - consentPct;

  const dayLabels = dayCounts.map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric" });
  });

  const r = isMobile ? 38 : 44;
  const c = 2 * Math.PI * r;
  const dashConsent = (consentPct / 100) * c;
  const dashAnon = (consentRemain / 100) * c;

  const heroTitleFs = isMobile ? 17 : isTablet ? 18 : 20;
  const heroBodyFs = isMobile ? 12 : 13;
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
            {scansToday}
          </p>
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
          <p style={{ margin: "6px 0 0", fontSize: isMobile ? 10 : 11, color: fp.mu }}>Tracking tier ≥ 1 · 7 Tage</p>
        </div>
      </div>

      <div style={{ ...cardStyle(isMobile ? 14 : 24), padding: isMobile ? 14 : 24 }}>
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
              Scans der letzten 7 Tage und Fortschritt Live-Standorte — Daten aus Supabase.
            </p>
          </div>
          <div style={{ textAlign: isTablet ? "left" : "right" }}>
            <p style={{ margin: 0, fontSize: 11, color: fp.mu }}>Scans (7 Tage)</p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: isMobile ? 18 : 22,
                fontWeight: 800,
                color: fp.or,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {weekScans}
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
          <div className="flex justify-between" style={{ marginTop: 6, paddingLeft: 2, paddingRight: 2 }}>
            {dayLabels.map((lbl) => (
              <span key={lbl} style={{ fontSize: isMobile ? 9 : 10, color: fp.mu, fontWeight: 600 }}>
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
            Anteil der Events mit Tracking-Stufe ≥ 1 (Consent) in den letzten 7 Tagen. Gesamt:{" "}
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
