"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { berlinWeekdayMon0, iterateBerlinMonthDays } from "@/lib/berlin-time";
import { presetThisMonthBerlin, presetThisYearBerlin } from "@/lib/restaurant-analytics-presets";

const OR = "#FF5C1A";

const weekdayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

type Props = {
  open: boolean;
  anchorFromYmd: string;
  anchorToYmd: string;
  onClose: () => void;
  onApplyRange: (fromYmd: string, toYmd: string) => void;
  onQuick7: () => void;
};

function parseYmdParts(ymd: string): { y: number; m: number } {
  const [y, m] = ymd.split("-").map(Number);
  return { y, m };
}

function monthTitleDe(year: number, month1: number): string {
  return new Date(year, month1 - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function ymdInRange(d: string, a: string, b: string): boolean {
  const lo = a <= b ? a : b;
  const hi = a <= b ? b : a;
  return d >= lo && d <= hi;
}

export function RangeCalendarModal({
  open,
  anchorFromYmd,
  anchorToYmd,
  onClose,
  onApplyRange,
  onQuick7,
}: Props) {
  const initialView = useMemo(() => parseYmdParts(anchorToYmd), [anchorToYmd]);
  const [viewY, setViewY] = useState(initialView.y);
  const [viewM, setViewM] = useState(initialView.m);
  const [selA, setSelA] = useState<string | null>(null);
  const [selB, setSelB] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const p = parseYmdParts(anchorToYmd);
    setViewY(p.y);
    setViewM(p.m);
    setSelA(anchorFromYmd);
    setSelB(anchorToYmd);
  }, [open, anchorFromYmd, anchorToYmd]);

  const monthDays = useMemo(() => iterateBerlinMonthDays(viewY, viewM), [viewY, viewM]);
  const pad = monthDays[0] ? berlinWeekdayMon0(monthDays[0]!) : 0;

  function shiftMonth(delta: number) {
    let y = viewY;
    let m = viewM + delta;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    setViewY(y);
    setViewM(m);
  }

  function onDayClick(d: string) {
    if (!selA || (selA && selB)) {
      setSelA(d);
      setSelB(null);
      return;
    }
    if (d < selA) {
      setSelB(selA);
      setSelA(d);
    } else {
      setSelB(d);
    }
  }

  const overlay: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: 16,
    paddingBottom: "max(16px, env(safe-area-inset-bottom))",
  };

  const panel: CSSProperties = {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    background: "linear-gradient(165deg, rgba(30,30,38,0.98), rgba(18,18,24,0.99))",
    border: "0.5px solid rgba(255,255,255,0.12)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
    backdropFilter: "blur(20px)",
    padding: 18,
    maxHeight: "90vh",
    overflow: "auto",
  };

  if (!open) return null;

  const canApply = selA && selB;

  return (
    <div style={overlay} role="presentation" onClick={onClose} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div style={panel} role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              onQuick7();
              onClose();
            }}
            className="rounded-full px-3 py-1.5 text-xs font-bold"
            style={{ border: `1px solid ${OR}`, background: "rgba(255,92,26,0.12)", color: "#fff", cursor: "pointer" }}
          >
            7 Tage
          </button>
          <button
            type="button"
            onClick={() => {
              const { fromYmd, toYmd } = presetThisMonthBerlin();
              onApplyRange(fromYmd, toYmd);
              onClose();
            }}
            className="rounded-full px-3 py-1.5 text-xs font-bold"
            style={{ border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "#fff", cursor: "pointer" }}
          >
            Monat
          </button>
          <button
            type="button"
            onClick={() => {
              const { fromYmd, toYmd } = presetThisYearBerlin();
              onApplyRange(fromYmd, toYmd);
              onClose();
            }}
            className="rounded-full px-3 py-1.5 text-xs font-bold"
            style={{ border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "#fff", cursor: "pointer" }}
          >
            Jahr
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Vorheriger Monat"
            onClick={() => shiftMonth(-1)}
            style={{ border: "none", background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 18 }}
          >
            ‹
          </button>
          <span style={{ fontWeight: 800, color: "#fff", fontSize: 15 }}>{monthTitleDe(viewY, viewM)}</span>
          <button
            type="button"
            aria-label="Nächster Monat"
            onClick={() => shiftMonth(1)}
            style={{ border: "none", background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 18 }}
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>
          {weekdayLabels.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: pad }).map((_, i) => (
            <div key={`p-${i}`} />
          ))}
          {monthDays.map((d) => {
            const inSel = selA && selB && ymdInRange(d, selA, selB);
            const isEnd = d === selA || d === selB;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onDayClick(d)}
                className="aspect-square rounded-xl text-sm font-bold"
                style={{
                  border: isEnd ? `1px solid ${OR}` : "1px solid transparent",
                  background: inSel ? "rgba(255,92,26,0.22)" : "rgba(255,255,255,0.04)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                {Number(d.slice(8, 10))}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-center text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
          Zwei Daten antippen (Start → Ende), dann übernehmen.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-3 text-sm font-bold"
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.75)",
              cursor: "pointer",
            }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={!canApply}
            onClick={() => {
              if (!selA || !selB) return;
              const lo = selA <= selB ? selA : selB;
              const hi = selA <= selB ? selB : selA;
              onApplyRange(lo, hi);
              onClose();
            }}
            className="flex-1 rounded-xl py-3 text-sm font-bold"
            style={{
              border: "none",
              background: canApply ? OR : "rgba(255,255,255,0.1)",
              color: "#fff",
              cursor: canApply ? "pointer" : "not-allowed",
              opacity: canApply ? 1 : 0.5,
            }}
          >
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}
