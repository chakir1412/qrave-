import { berlinDateParts } from "@/lib/berlin-time";
import {
  OEFFNUNGSZEITEN_WEEKDAY_KEYS,
  type OeffnungszeitenTag,
  type OeffnungszeitenWeekday,
  type OeffnungszeitenWoche,
} from "@/lib/supabase";

export const WEEKDAY_LABELS: Record<OeffnungszeitenWeekday, string> = {
  mo: "Montag",
  di: "Dienstag",
  mi: "Mittwoch",
  do: "Donnerstag",
  fr: "Freitag",
  sa: "Samstag",
  so: "Sonntag",
};

export const WEEKDAY_LABELS_SHORT: Record<OeffnungszeitenWeekday, string> = {
  mo: "Mo",
  di: "Di",
  mi: "Mi",
  do: "Do",
  fr: "Fr",
  sa: "Sa",
  so: "So",
};

/** Wandelt den Berlin-Wochentag (1=Mo … 7=So) auf den jsonb-Key. */
function weekdayKeyFromMon1(weekdayMon1: number): OeffnungszeitenWeekday {
  const idx = ((weekdayMon1 - 1) % 7 + 7) % 7;
  return OEFFNUNGSZEITEN_WEEKDAY_KEYS[idx] ?? "mo";
}

/** Parst "HH:MM" → Minuten seit Mitternacht. -1 wenn ungültig. */
function parseHhmm(s: string | undefined | null): number {
  if (typeof s !== "string") return -1;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return -1;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return -1;
  if (h < 0 || h > 24 || min < 0 || min > 59) return -1;
  return h * 60 + min;
}

export type OpenStatus =
  | { kind: "open"; closesAt: string }
  | { kind: "opens-later"; opensAt: string }
  | { kind: "closed-today" }
  | { kind: "no-data" };

/** Aktuellen Öffnungsstatus für `now` ermitteln (Berlin-Zeit). */
export function getOpenStatus(
  plan: OeffnungszeitenWoche | null | undefined,
  now: Date = new Date(),
): OpenStatus {
  if (!plan || typeof plan !== "object") return { kind: "no-data" };
  const { hour, weekdayMon1 } = berlinDateParts(now);
  // Minute aus dem aktuellen Berlin-Zeit ableiten (berlinDateParts liefert nur Stunde).
  const minutes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    minute: "2-digit",
  }).formatToParts(now);
  const min = Number(minutes.find((p) => p.type === "minute")?.value ?? "0");
  const nowMinutes = hour * 60 + (Number.isFinite(min) ? min : 0);

  const key = weekdayKeyFromMon1(weekdayMon1);
  const today: OeffnungszeitenTag | undefined = plan[key];
  if (!today) return { kind: "closed-today" };

  const open = parseHhmm(today.open);
  const close = parseHhmm(today.close);
  if (open < 0 || close < 0) return { kind: "closed-today" };

  // Über-Mitternacht-Schicht (z. B. 18:00–02:00): close < open.
  if (close > open) {
    if (nowMinutes >= open && nowMinutes < close) {
      return { kind: "open", closesAt: today.close };
    }
    if (nowMinutes < open) {
      return { kind: "opens-later", opensAt: today.open };
    }
    return { kind: "closed-today" };
  } else {
    // close <= open: Schicht über Mitternacht.
    if (nowMinutes >= open || nowMinutes < close) {
      return { kind: "open", closesAt: today.close };
    }
    return { kind: "opens-later", opensAt: today.open };
  }
}

/** Default-Plan: Mo–Sa 11:00–22:00, So geschlossen. */
export function defaultOeffnungszeiten(): OeffnungszeitenWoche {
  return {
    mo: { open: "11:00", close: "22:00" },
    di: { open: "11:00", close: "22:00" },
    mi: { open: "11:00", close: "22:00" },
    do: { open: "11:00", close: "22:00" },
    fr: { open: "11:00", close: "22:00" },
    sa: { open: "11:00", close: "22:00" },
    so: null,
  };
}
