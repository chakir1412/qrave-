import type { LunchOffer, LunchWeekday } from "./supabase";
import { LUNCH_WEEKDAY_KEYS } from "./supabase";

/** Liefert den Wochentag als 2-Buchstaben-Key für die `weekdays`-Spalte. */
export function currentWeekdayKey(now = new Date()): LunchWeekday {
  // JS Date.getDay(): 0 = Sonntag, 1 = Montag, ...
  const jsDay = now.getDay();
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  return LUNCH_WEEKDAY_KEYS[idx];
}

/** "HH:MM:SS" oder "HH:MM" → Minuten seit 00:00. */
function timeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  const h = Number.parseInt(m[1], 10);
  const min = Number.parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

/** Prüft, ob das Lunch-Angebot aktuell aktiv ist (Wochentag + Zeitfenster). */
export function isLunchActiveNow(offer: LunchOffer, now = new Date()): boolean {
  if (!offer.aktiv) return false;
  const today = currentWeekdayKey(now);
  const weekdays = (offer.weekdays ?? []).map((w) => w.toLowerCase());
  if (!weekdays.includes(today)) return false;
  const from = timeToMinutes(offer.time_from);
  const to = timeToMinutes(offer.time_to);
  if (from == null || to == null) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= from && cur <= to;
}

/** Filtert die übergebenen Mittagsangebote auf aktuell aktive. */
export function activeLunchOffers(offers: LunchOffer[], now = new Date()): LunchOffer[] {
  return offers.filter((o) => isLunchActiveNow(o, now));
}
