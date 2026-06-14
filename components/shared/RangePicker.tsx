"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type Range = "7d" | "14d" | "30d" | "month" | "custom";

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatRangeButtonLabel(
  range: Range,
  customFrom: string,
  customTo: string,
): string {
  switch (range) {
    case "7d":
      return "Letzte 7 Tage";
    case "14d":
      return "Letzte 14 Tage";
    case "30d":
      return "Letzte 30 Tage";
    case "month":
      return "Dieser Monat";
    case "custom": {
      if (!customFrom || !customTo) return "Benutzerdefiniert";
      const f = new Date(`${customFrom}T00:00:00`);
      const t = new Date(`${customTo}T00:00:00`);
      return `${pad2(f.getDate())}.${pad2(f.getMonth() + 1)}. – ${pad2(t.getDate())}.${pad2(t.getMonth() + 1)}.${t.getFullYear()}`;
    }
  }
}

const QUICK_RANGE_OPTIONS: { key: Exclude<Range, "custom">; label: string }[] = [
  { key: "7d", label: "Letzte 7 Tage" },
  { key: "14d", label: "Letzte 14 Tage" },
  { key: "30d", label: "Letzte 30 Tage" },
  { key: "month", label: "Dieser Monat" },
];

type RangePickerProps = {
  range: Range;
  onRangeChange: (r: Range) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
  /** Optionaler Slot links vom Button (z.B. ein Hint-Tooltip). */
  leadingSlot?: ReactNode;
};

export function RangePicker({
  range,
  onRangeChange,
  customFrom,
  customTo,
  onCustomChange,
  leadingSlot,
}: RangePickerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [pendingStart, setPendingStart] = useState<Date | null>(null);
  const [pendingEnd, setPendingEnd] = useState<Date | null>(null);
  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const [viewLeft, setViewLeft] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth() - 1, 1),
  );

  useEffect(() => {
    if (!open) return;
    if (range === "custom" && customFrom && customTo) {
      const a = new Date(`${customFrom}T00:00:00`);
      const b = new Date(`${customTo}T00:00:00`);
      setPendingStart(a);
      setPendingEnd(b);
      setViewLeft(new Date(b.getFullYear(), b.getMonth() - 1, 1));
    } else {
      setPendingStart(null);
      setPendingEnd(null);
    }
  }, [open, range, customFrom, customTo]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pickQuick(k: Exclude<Range, "custom">) {
    onRangeChange(k);
    setOpen(false);
  }

  function applyCustom() {
    if (!pendingStart || !pendingEnd) return;
    let a = pendingStart;
    let b = pendingEnd;
    if (b < a) [a, b] = [b, a];
    onCustomChange(toIso(a), toIso(b));
    onRangeChange("custom");
    setOpen(false);
  }

  function handleDayClick(d: Date) {
    if (!pendingStart || (pendingStart && pendingEnd)) {
      setPendingStart(d);
      setPendingEnd(null);
      return;
    }
    setPendingEnd(d);
  }

  const viewRight = useMemo(
    () => new Date(viewLeft.getFullYear(), viewLeft.getMonth() + 1, 1),
    [viewLeft],
  );
  const canNavNext = useMemo(() => {
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return viewRight < currentMonthStart;
  }, [viewRight, today]);

  const label = formatRangeButtonLabel(range, customFrom, customTo);

  return (
    <div className="flex items-center gap-2">
      {leadingSlot}
      <div ref={wrapperRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-[10px] border px-3.5 py-2 text-[12px] font-semibold transition"
          style={{
            borderColor: open
              ? "color-mix(in srgb, var(--qrave-accent) 50%, transparent)"
              : "rgba(255,255,255,0.1)",
            background: open
              ? "color-mix(in srgb, var(--qrave-accent) 18%, transparent)"
              : "rgba(255,255,255,0.04)",
            color: open ? "var(--qrave-accent-soft)" : "#f2f2f2",
          }}
        >
          <i className="fa-regular fa-calendar text-[12px]" aria-hidden />
          <span>{label}</span>
          <i
            className={`fa-solid fa-chevron-${open ? "up" : "down"} text-[10px]`}
            aria-hidden
          />
        </button>

        {open ? (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 sm:hidden"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-[20px] border-t sm:absolute sm:bottom-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-none sm:w-[640px] sm:max-w-[calc(100vw-32px)] sm:rounded-[16px] sm:border sm:border-t"
              style={{
                background: "#06040e",
                borderColor: "rgba(255,255,255,0.08)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
              }}
              role="dialog"
              aria-label="Zeitraum wählen"
            >
              <div className="p-5">
                <div
                  className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "rgba(242,242,242,0.5)" }}
                >
                  Schnellauswahl
                </div>
                <div className="space-y-1">
                  {QUICK_RANGE_OPTIONS.map((opt) => {
                    const active = range === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => pickQuick(opt.key)}
                        className="flex w-full items-center justify-between rounded-[8px] px-3 py-2.5 text-[13px] font-semibold transition hover:bg-white/[0.04]"
                        style={{
                          background: active
                            ? "color-mix(in srgb, var(--qrave-accent) 15%, transparent)"
                            : "transparent",
                          color: active ? "var(--qrave-accent-soft)" : "#f2f2f2",
                        }}
                      >
                        <span>{opt.label}</span>
                        {active ? (
                          <i className="fa-solid fa-check text-[11px]" aria-hidden />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div
                  className="my-4 h-px"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                />

                <div className="mb-3 flex items-center justify-between">
                  <div
                    className="text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: "rgba(242,242,242,0.5)" }}
                  >
                    Benutzerdefiniert
                  </div>
                  <div className="flex items-center gap-1">
                    <CalNavBtn
                      icon="fa-chevron-left"
                      ariaLabel="Vorheriger Monat"
                      onClick={() =>
                        setViewLeft(
                          new Date(viewLeft.getFullYear(), viewLeft.getMonth() - 1, 1),
                        )
                      }
                    />
                    <CalNavBtn
                      icon="fa-chevron-right"
                      ariaLabel="Nächster Monat"
                      disabled={!canNavNext}
                      onClick={() =>
                        setViewLeft(
                          new Date(viewLeft.getFullYear(), viewLeft.getMonth() + 1, 1),
                        )
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">
                  <MonthGrid
                    month={viewLeft}
                    today={today}
                    pendingStart={pendingStart}
                    pendingEnd={pendingEnd}
                    onDayClick={handleDayClick}
                  />
                  <MonthGrid
                    month={viewRight}
                    today={today}
                    pendingStart={pendingStart}
                    pendingEnd={pendingEnd}
                    onDayClick={handleDayClick}
                  />
                </div>

                <button
                  type="button"
                  onClick={applyCustom}
                  disabled={!pendingStart || !pendingEnd}
                  className="mt-5 w-full rounded-[10px] py-3 text-[13px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: "var(--qrave-accent-gradient)",
                    boxShadow: "0 6px 20px var(--qrave-accent-glow)",
                  }}
                >
                  Übernehmen
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function CalNavBtn({
  icon,
  ariaLabel,
  onClick,
  disabled,
}: {
  icon: string;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[11px] transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      style={{ color: "rgba(242,242,242,0.6)" }}
    >
      <i className={`fa-solid ${icon}`} aria-hidden />
    </button>
  );
}

const WEEK_LABELS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

function MonthGrid({
  month,
  today,
  pendingStart,
  pendingEnd,
  onDayClick,
}: {
  month: Date;
  today: Date;
  pendingStart: Date | null;
  pendingEnd: Date | null;
  onDayClick: (d: Date) => void;
}) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const firstWeekday = new Date(year, m, 1).getDay();
  const offset = (firstWeekday + 6) % 7;

  const monthLabel = month.toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });

  let rangeStart = pendingStart;
  let rangeEnd = pendingEnd;
  if (rangeStart && rangeEnd && rangeEnd < rangeStart) {
    [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
  }

  return (
    <div className="min-w-0 flex-1">
      <div
        className="mb-2 text-center text-[12px] font-bold capitalize"
        style={{ color: "#f2f2f2" }}
      >
        {monthLabel}
      </div>
      <div
        className="mb-1 grid grid-cols-7 gap-1 text-center text-[9px] font-semibold uppercase tracking-wider"
        style={{ color: "rgba(242,242,242,0.4)" }}
      >
        {WEEK_LABELS_DE.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`pad-${i}`} aria-hidden />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const d = new Date(year, m, day);
          const isFuture = d > today;
          const isToday = sameDay(d, today);
          const isStart = rangeStart ? sameDay(d, rangeStart) : false;
          const isEnd = rangeEnd ? sameDay(d, rangeEnd) : false;
          const inRange =
            rangeStart && rangeEnd && d > rangeStart && d < rangeEnd ? true : false;

          let style: React.CSSProperties;
          if (isStart || isEnd) {
            style = {
              background: "var(--qrave-accent)",
              color: "#ffffff",
            };
          } else if (inRange) {
            style = {
              background: "color-mix(in srgb, var(--qrave-accent) 20%, transparent)",
              color: "var(--qrave-accent-soft)",
            };
          } else if (isFuture) {
            style = { color: "rgba(242,242,242,0.25)" };
          } else {
            style = { color: "#f2f2f2" };
          }

          return (
            <button
              key={day}
              type="button"
              onClick={() => !isFuture && onDayClick(d)}
              disabled={isFuture}
              className="relative aspect-square w-full rounded-[6px] text-[12px] font-semibold transition hover:enabled:bg-white/[0.06] disabled:cursor-not-allowed"
              style={style}
            >
              {day}
              {isToday && !isStart && !isEnd ? (
                <span
                  className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                  style={{ background: "var(--qrave-accent)" }}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
