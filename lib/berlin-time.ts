/** Kalendertag `YYYY-MM-DD` in Europe/Berlin für einen UTC-Zeitpunkt. */
export function berlinYmd(d: Date = new Date()): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

function isBerlinMidnight(inst: Date, ymd: string): boolean {
  if (inst.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) !== ymd) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(inst);
  const h = parts.find((p) => p.type === "hour")?.value;
  const m = parts.find((p) => p.type === "minute")?.value;
  const s = parts.find((p) => p.type === "second")?.value;
  return h === "00" && m === "00" && s === "00";
}

/** UTC-Instant (ISO) für 00:00:00 des Kalendertags `ymd` in Europe/Berlin. */
export function startOfBerlinYmdUtcIso(ymd: string): string {
  const [Y, M, D] = ymd.split("-").map(Number);
  const t0 = Date.UTC(Y, M - 1, D - 1, 0, 0, 0);
  const t1 = Date.UTC(Y, M - 1, D + 2, 23, 59, 59);
  for (let t = t0; t <= t1; t += 60_000) {
    const inst = new Date(t);
    if (isBerlinMidnight(inst, ymd)) return inst.toISOString();
  }
  return new Date(Date.UTC(Y, M - 1, D, 5, 0, 0)).toISOString();
}

/** Heute 00:00 Uhr Europe/Berlin als UTC-ISO. */
export function startOfBerlinTodayUtcIso(now: Date = new Date()): string {
  return startOfBerlinYmdUtcIso(berlinYmd(now));
}

/**
 * Anteil des laufenden Berlin-Kalendertags \[0..1] bis zum Zeitpunkt `now`
 * (Mitternacht → Ende des Kalendertags in Europe/Berlin).
 */
export function berlinDayElapsedFraction(now: Date = new Date()): number {
  const ymd = berlinYmd(now);
  const startMs = new Date(startOfBerlinYmdUtcIso(ymd)).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.min(1, Math.max(0, (now.getTime() - startMs) / dayMs));
}

/** 1. Januar 00:00 Uhr Europe/Berlin (Jahr des übergebenen Datums in Berlin). */
export function startOfBerlinYearUtcIso(now: Date = new Date()): string {
  const y = Number(
    now.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin", year: "numeric" }),
  );
  return startOfBerlinYmdUtcIso(`${y}-01-01`);
}

/** Vorheriger Kalendertag (Europe/Berlin) zu `YYYY-MM-DD`. */
export function prevBerlinYmd(ymd: string): string {
  const t0 = new Date(startOfBerlinYmdUtcIso(ymd)).getTime();
  return berlinYmd(new Date(t0 - 1));
}

/** `ymd` minus `days` Kalendertage (Europe/Berlin). */
export function berlinMinusCalendarDays(ymd: string, days: number): string {
  let d = ymd;
  for (let i = 0; i < days; i++) d = prevBerlinYmd(d);
  return d;
}

/** Nächster Kalendertag (Europe/Berlin) zu `YYYY-MM-DD`. */
export function nextBerlinYmd(ymd: string): string {
  const startMs = new Date(startOfBerlinYmdUtcIso(ymd)).getTime();
  for (let h = 20; h <= 30; h++) {
    const y = berlinYmd(new Date(startMs + h * 60 * 60 * 1000));
    if (y !== ymd) return y;
  }
  return berlinYmd(new Date(startMs + 48 * 60 * 60 * 1000));
}

/** Inklusive Tage von `fromYmd` bis `toYmd` (beide Europe/Berlin). */
export function iterateBerlinDaysInclusive(fromYmd: string, toYmd: string): string[] {
  const out: string[] = [];
  let y = fromYmd;
  for (let guard = 0; guard < 4000; guard++) {
    out.push(y);
    if (y === toYmd) break;
    y = nextBerlinYmd(y);
  }
  return out;
}

/** Anzahl Kalendertage inklusive Endpunkte. */
export function berlinDaySpanInclusive(fromYmd: string, toYmd: string): number {
  return iterateBerlinDaysInclusive(fromYmd, toYmd).length;
}

/** Mo–So: Mo = 0 … So = 6 (Europe/Berlin, Mitternacht des Tags). */
export function berlinWeekdayMon0(ymd: string): number {
  const short = new Date(startOfBerlinYmdUtcIso(ymd)).toLocaleDateString("en-US", {
    timeZone: "Europe/Berlin",
    weekday: "short",
  });
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[short.slice(0, 3)] ?? 0;
}

/** Montag der Kalenderwoche (Europe/Berlin), die `ymd` enthält. */
export function mondayBerlinYmdFromYmd(ymd: string): string {
  const w = berlinWeekdayMon0(ymd);
  let cur = ymd;
  for (let i = 0; i < w; i++) {
    cur = prevBerlinYmd(cur);
  }
  return cur;
}

/** Jahr und Monat (1–12) in Europe/Berlin für einen ISO-Zeitpunkt. */
export function berlinYearMonthFromIso(iso: string): { y: number; m: number } {
  const d = new Date(iso);
  const y = Number(d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin", year: "numeric" }));
  const m = Number(d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin", month: "numeric" }));
  return { y, m };
}

/** Alle Kalendertage eines Monats (1–12) in Europe/Berlin. */
export function iterateBerlinMonthDays(year: number, month1to12: number): string[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  let ymd = `${year}-${pad(month1to12)}-01`;
  const out: string[] = [];
  for (let guard = 0; guard < 35; guard++) {
    const d = new Date(startOfBerlinYmdUtcIso(ymd));
    const cy = Number(d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin", year: "numeric" }));
    const cm = Number(d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin", month: "numeric" }));
    if (cy !== year || cm !== month1to12) break;
    out.push(ymd);
    ymd = nextBerlinYmd(ymd);
  }
  return out;
}

/** Letzte `n` Kalendertage in Berlin, ältester zuerst (letzter Eintrag = heute Berlin). */
export function lastNCalendarDaysBerlin(n: number, ref: Date = new Date()): string[] {
  const out: string[] = [];
  let y = berlinYmd(ref);
  for (let i = 0; i < n; i++) {
    out.unshift(y);
    y = prevBerlinYmd(y);
  }
  return out;
}
