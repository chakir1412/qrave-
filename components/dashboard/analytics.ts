export type AnalyticsEventRow = {
  item_id: string | null;
  item_name: string | null;
  event_type: string | null;
  filter_key: string | null;
  created_at: string;
};

function startOfWeekMonday(ref: Date): Date {
  const d = new Date(ref);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 7 Werte Mo–So der aktuellen Woche (Scan = jedes Event). */
export function weekScanCounts(events: AnalyticsEventRow[], now = new Date()): number[] {
  const monday = startOfWeekMonday(now);
  const counts: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (const e of events) {
    const t = new Date(e.created_at);
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      if (sameDay(t, day)) {
        counts[i] += 1;
        break;
      }
    }
  }
  return counts;
}

export type PeakRow = { label: string; count: number };

/** Stundenfenster heute (z. B. 12–13h) nach Event-Anzahl. */
export function peakHoursToday(events: AnalyticsEventRow[], now = new Date()): PeakRow[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const buckets = new Map<number, number>();
  for (const e of events) {
    const t = new Date(e.created_at);
    if (t < start || t > end) continue;
    const h = t.getHours();
    buckets.set(h, (buckets.get(h) ?? 0) + 1);
  }

  const rows: PeakRow[] = [...buckets.entries()]
    .map(([h, count]) => ({
      label: `${h}–${h + 1}h`,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return rows;
}

export function isLikelyDrinkCategory(kategorie: string | null | undefined): boolean {
  if (!kategorie) return false;
  const k = kategorie.toLowerCase();
  return (
    k.includes("getränk") ||
    k.includes("getraenk") ||
    k.includes("cocktail") ||
    k.includes("bier") ||
    k.includes("wein") ||
    k.includes("drink") ||
    k.includes("alkoholfrei")
  );
}
