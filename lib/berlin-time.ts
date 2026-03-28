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
