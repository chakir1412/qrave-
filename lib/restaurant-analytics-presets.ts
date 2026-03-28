import { berlinYmd, lastNCalendarDaysBerlin } from "@/lib/berlin-time";

export function defaultLast7Ymd(): { fromYmd: string; toYmd: string } {
  const days = lastNCalendarDaysBerlin(7);
  return { fromYmd: days[0]!, toYmd: days[days.length - 1]! };
}

export function presetThisMonthBerlin(ref: Date = new Date()): { fromYmd: string; toYmd: string } {
  const y = Number(ref.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin", year: "numeric" }));
  const m = Number(ref.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin", month: "numeric" }));
  const pad = (n: number) => String(n).padStart(2, "0");
  const fromYmd = `${y}-${pad(m)}-01`;
  const toYmd = berlinYmd(ref);
  return { fromYmd, toYmd };
}

export function presetThisYearBerlin(ref: Date = new Date()): { fromYmd: string; toYmd: string } {
  const y = Number(ref.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin", year: "numeric" }));
  const fromYmd = `${y}-01-01`;
  const toYmd = berlinYmd(ref);
  return { fromYmd, toYmd };
}

export function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
