import { berlinYmd, berlinYearMonthFromIso, iterateBerlinDaysInclusive, startOfBerlinYmdUtcIso } from "@/lib/berlin-time";

export type RawRestaurantEventRow = {
  id: string;
  session_id: string | null;
  event_type: string;
  created_at: string;
  stunde: number | null;
  wochentag: number | null;
  tisch_nummer: number | null;
  item_id: string | null;
  item_name: string | null;
  kategorie: string | null;
  main_tab: string | null;
  duration_seconds: number | null;
  session_duration: number | null;
  bounce: boolean | null;
  return_visit: boolean | null;
  device_type: string | null;
  tier: number;
  restaurant_id: string | null;
};

export type RestaurantAnalyticsGranularity = "day" | "month";

export type DrinkCategoryKey = "bier" | "softdrinks" | "spirits" | "hot";

export type RestaurantAnalyticsComputed = {
  granularity: RestaurantAnalyticsGranularity;
  chartLabels: string[];
  chartScanCounts: number[];

  /** Tagesblock-Sessions — Morgen/Mittag/Abend/Nacht */
  timeBlocks: { morning: number; midday: number; evening: number; night: number };

  /** Meistgeklickte Gerichte (Speisen — ohne Getränke) */
  topItems: Array<{ name: string; count: number }>;
  /** Meistbesuchte Kategorien (alle Klicks). */
  topCategories: Array<{ name: string; count: number }>;

  /** Meistgeklickte Getränke. */
  topDrinks: Array<{ name: string; count: number }>;
  /** Klick-Verteilung über die 4 Getränke-Subkategorien. */
  drinkCategoryBreakdown: Record<DrinkCategoryKey, number>;
  /** Dominante Getränke-Kategorie (höchster Anteil), null wenn keine Drink-Klicks. */
  dominantDrinkCategory: DrinkCategoryKey | null;

  /** Bounce-Rate: Sessions ohne item_detail / total. `available` = `false`,
   *  wenn weniger als 5 Sessions im Zeitraum (zu wenig Signal). */
  bounce: { available: boolean; rate: number; bounced: number; totalSessions: number };
  /** Ø Session-Dauer in Sekunden (aus session_end-Events). */
  avgSessionDurationSeconds: number;
  /** Wiederkehrend vs. Erstbesuch.
   *  `available` = `false`, wenn `return_visit` nie gesetzt wurde
   *  (= aktuell der Fall, weil der Tracker kein persistentes
   *   Visitor-localStorage hat). */
  returningVisitor: { available: boolean; returningPct: number; firstVisitPct: number };
  /** Häufigster Wochentag (Mo=1 … So=7), null wenn keine Daten. */
  peakDayOfWeek: { dayIndex: number; dayLabel: string; count: number } | null;
  /** Peak-Stunde mit ±1h Fenster. */
  peakHourWindow: { peakHour: number; fromHour: number; toHour: number; sessionsInWindow: number } | null;
  /** "Impressionen" — Summe item_detail-Klicks im Zeitraum. */
  totalImpressions: number;

  /** Consent-Funnel. */
  consent: {
    totalSessions: number;
    withConsent: number;
    withoutConsent: number;
    ratePct: number;
  };

  /** Roh-Scans pro Berlin-Tag (für CSV). */
  scansByBerlinDay: Record<string, number>;
};

export function sessionKey(e: RawRestaurantEventRow): string {
  const sidRaw = e.session_id?.trim() ? e.session_id : e.id;
  if (sidRaw.length > 0) return sidRaw;
  return `row:${e.created_at}:${e.event_type}:${e.restaurant_id ?? ""}`;
}

export function eventHourBerlin(e: RawRestaurantEventRow): number {
  if (e.stunde != null && Number.isFinite(e.stunde) && e.stunde >= 0 && e.stunde <= 23) {
    return e.stunde;
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date(e.created_at));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return Number.isFinite(h) ? h : 0;
}

/** Wochentag in Berlin-Zeit (Mo=1 … So=7). */
export function eventBerlinWeekday(e: RawRestaurantEventRow): number {
  if (e.wochentag != null && Number.isFinite(e.wochentag) && e.wochentag >= 1 && e.wochentag <= 7) {
    return e.wochentag;
  }
  const d = new Date(e.created_at);
  // toLocaleDateString liefert „Mon"|„Tue"…
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    weekday: "short",
  }).format(d);
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return map[parts] ?? 1;
}

export function timeBlockForHour(h: number): "morning" | "midday" | "evening" | "night" {
  if (h >= 6 && h < 11) return "morning";
  if (h >= 11 && h < 15) return "midday";
  if (h >= 15 && h < 22) return "evening";
  return "night";
}

/** Kurze Zeiträume (≤ 40 Tage): ein Balken pro Tag. Sonst: ein Balken pro Monat. */
export function pickGranularity(fromYmd: string, toYmd: string): RestaurantAnalyticsGranularity {
  return iterateBerlinDaysInclusive(fromYmd, toYmd).length <= 40 ? "day" : "month";
}

export function formatDeShort(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

const WEEKDAY_LABELS = ["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

/** Ein Item gilt als Getränk, wenn es im "getraenke"-Tab liegt oder
 *  Name/Kategorie auf eine bekannte Getränke-Subkategorie matcht. */
export function classifyDrinkCategory(
  kategorie: string | null,
  name: string | null,
): DrinkCategoryKey | null {
  const blob = `${(kategorie ?? "").toLowerCase()} ${(name ?? "").toLowerCase()}`;
  if (
    /\b(bier|pils|weiz|hefeweiss|hefeweiz|lager|altbier|kölsch|kolsch|stout|ipa|ale\b|bock\b|weisse|berliner)\b/.test(
      blob,
    )
  ) {
    return "bier";
  }
  if (
    /\b(kaffee|espresso|cappuccino|latte|mocca|mokka|chai|kakao|heißgetränk|heissgetraenk|schoko|teekanne)\b/.test(
      blob,
    ) ||
    /\btee\b/.test(blob)
  ) {
    return "hot";
  }
  if (
    /\b(spirituos|gin\b|whisky|whiskey|wodka|vodka|tequila|cognac|likör|liqueur|aperol|campari|aperitif|cocktail|long\s?drink|shot|jägermeister|jagermeister|martini\b|hugo|lillet|bourbon|sambuca|amaretto|baileys|sambuca|absinth|grappa|mezcal)\b/.test(
      blob,
    ) ||
    /\brum\b/.test(blob) ||
    /\b(wein|wine|sekt|prosecco|champagne|champagner|crémant|cava|riesling|chardonnay)\b/.test(blob)
  ) {
    return "spirits";
  }
  if (
    /\b(cola|fanta|sprite|spezi|limo|saft|schorle|softdrink|kola|sodawasser|fritz|red\s?bull|club\s?mate|mate|tonic|ginger|bitter\s?lemon)\b/.test(
      blob,
    ) ||
    /\b(wasser|mineralwasser)\b/.test(blob)
  ) {
    return "softdrinks";
  }
  return null;
}

export function isDrinkItem(
  mainTab: string | null,
  kategorie: string | null,
  name: string | null,
): boolean {
  const mt = (mainTab ?? "").toLowerCase();
  if (mt === "getraenke" || mt === "getränke" || mt === "drinks" || mt === "bar") return true;
  return classifyDrinkCategory(kategorie, name) !== null;
}

export function aggregateRestaurantAnalytics(
  events: RawRestaurantEventRow[],
  fromYmd: string,
  toYmd: string,
): RestaurantAnalyticsComputed {
  // ---- Sessions: 1× pro session_id ----
  type SessionMeta = {
    firstHour: number;
    firstWeekday: number;
    maxTier: number;
    hasItemDetail: boolean;
    hasBounceEvent: boolean;
    sessionDurationSeconds: number | null;
    returnVisit: boolean | null;
  };
  const sessions = new Map<string, SessionMeta>();
  for (const e of events) {
    const k = sessionKey(e);
    const cur = sessions.get(k);
    const h = eventHourBerlin(e);
    const wd = eventBerlinWeekday(e);
    const tier = e.tier ?? 0;
    if (cur) {
      if (h < cur.firstHour) {
        cur.firstHour = h;
        cur.firstWeekday = wd;
      }
      if (tier > cur.maxTier) cur.maxTier = tier;
      if (e.event_type === "item_detail") cur.hasItemDetail = true;
      if (e.event_type === "bounce" || e.bounce === true) cur.hasBounceEvent = true;
      if (e.event_type === "session_end" && typeof e.session_duration === "number") {
        cur.sessionDurationSeconds = e.session_duration;
      }
      if (e.return_visit === true) cur.returnVisit = true;
    } else {
      sessions.set(k, {
        firstHour: h,
        firstWeekday: wd,
        maxTier: tier,
        hasItemDetail: e.event_type === "item_detail",
        hasBounceEvent: e.event_type === "bounce" || e.bounce === true,
        sessionDurationSeconds:
          e.event_type === "session_end" && typeof e.session_duration === "number"
            ? e.session_duration
            : null,
        returnVisit: e.return_visit === true ? true : null,
      });
    }
  }
  const totalSessions = sessions.size;

  // ---- Roh-Scans pro Berlin-Tag: 1× pro Session, an deren ersten Hour-Bucket ----
  const scansByBerlinDay: Record<string, number> = {};
  for (const [, m] of sessions) {
    void m; // unused
  }
  // Wir mappen Session → erstes Event-Datum (Berlin)
  const sessionFirstDate = new Map<string, string>();
  for (const e of events) {
    const k = sessionKey(e);
    const ymd = berlinYmd(new Date(e.created_at));
    const cur = sessionFirstDate.get(k);
    if (!cur || ymd < cur) sessionFirstDate.set(k, ymd);
  }
  for (const [, ymd] of sessionFirstDate) {
    scansByBerlinDay[ymd] = (scansByBerlinDay[ymd] ?? 0) + 1;
  }

  // ---- Chart ----
  const granularity = pickGranularity(fromYmd, toYmd);
  let chartLabels: string[] = [];
  let chartScanCounts: number[] = [];
  if (granularity === "day") {
    const days = iterateBerlinDaysInclusive(fromYmd, toYmd);
    chartLabels = days.map((d) => formatDeShort(d));
    chartScanCounts = days.map((d) => scansByBerlinDay[d] ?? 0);
  } else {
    const monthOrder: string[] = [];
    const seen = new Set<string>();
    for (const day of iterateBerlinDaysInclusive(fromYmd, toYmd)) {
      const iso = new Date(startOfBerlinYmdUtcIso(day)).toISOString();
      const { y, m } = berlinYearMonthFromIso(iso);
      const key = `${y}-${String(m).padStart(2, "0")}`;
      if (!seen.has(key)) {
        seen.add(key);
        monthOrder.push(key);
      }
    }
    chartLabels = monthOrder.map((k) => {
      const [ys, ms] = k.split("-").map(Number);
      return new Date(ys, ms - 1, 1).toLocaleDateString("de-DE", { month: "short", year: "numeric" });
    });
    chartScanCounts = monthOrder.map((k) => {
      const [ys, ms] = k.split("-").map(Number);
      let c = 0;
      for (const day of iterateBerlinDaysInclusive(fromYmd, toYmd)) {
        const iso = new Date(startOfBerlinYmdUtcIso(day)).toISOString();
        const ym = berlinYearMonthFromIso(iso);
        if (ym.y === ys && ym.m === ms) c += scansByBerlinDay[day] ?? 0;
      }
      return c;
    });
  }

  // ---- Tagesblöcke (1× pro Session, frühester Hour) ----
  const blocks = { morning: 0, midday: 0, evening: 0, night: 0 };
  for (const m of sessions.values()) {
    blocks[timeBlockForHour(m.firstHour)]++;
  }

  // ---- Top-Items (alle), Top-Speisen, Top-Drinks ----
  const itemMap = new Map<string, { count: number; isDrink: boolean }>();
  const drinkBreakdown: Record<DrinkCategoryKey, number> = {
    bier: 0,
    softdrinks: 0,
    spirits: 0,
    hot: 0,
  };
  for (const e of events) {
    if (e.event_type !== "item_detail") continue;
    const n = e.item_name?.trim();
    if (!n) continue;
    const drink = isDrinkItem(e.main_tab, e.kategorie, n);
    const cur = itemMap.get(n) ?? { count: 0, isDrink: drink };
    cur.count += 1;
    cur.isDrink = cur.isDrink || drink;
    itemMap.set(n, cur);
    if (drink) {
      const sub = classifyDrinkCategory(e.kategorie, n);
      if (sub) drinkBreakdown[sub] += 1;
    }
  }
  const totalImpressions = [...itemMap.values()].reduce((acc, v) => acc + v.count, 0);
  const sortedItems = [...itemMap.entries()].sort((a, b) => b[1].count - a[1].count);
  const topItems = sortedItems
    .filter(([, v]) => !v.isDrink)
    .slice(0, 10)
    .map(([name, v]) => ({ name, count: v.count }));
  const topDrinks = sortedItems
    .filter(([, v]) => v.isDrink)
    .slice(0, 10)
    .map(([name, v]) => ({ name, count: v.count }));

  let dominantDrinkCategory: DrinkCategoryKey | null = null;
  {
    let max = 0;
    for (const k of ["bier", "softdrinks", "spirits", "hot"] as DrinkCategoryKey[]) {
      if (drinkBreakdown[k] > max) {
        max = drinkBreakdown[k];
        dominantDrinkCategory = k;
      }
    }
  }

  // ---- Top-Kategorien ----
  const catMap = new Map<string, number>();
  for (const e of events) {
    if (e.event_type !== "category_enter") continue;
    const k = e.kategorie?.trim();
    if (!k) continue;
    catMap.set(k, (catMap.get(k) ?? 0) + 1);
  }
  const topCategories = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // ---- Bounce-Rate (Sessions die kein item_detail geöffnet haben). ----
  const bouncedSessions = [...sessions.values()].filter((s) => !s.hasItemDetail).length;
  const bounceAvailable = totalSessions >= 5;
  const bounceRate = totalSessions > 0 ? Math.round((bouncedSessions / totalSessions) * 100) : 0;

  // ---- Ø Session-Dauer (aus session_end events, fallback auf max-min pro Session). ----
  const sessionMinMax = new Map<string, { min: string; max: string }>();
  for (const e of events) {
    const k = sessionKey(e);
    const cur = sessionMinMax.get(k);
    if (cur) {
      if (e.created_at < cur.min) cur.min = e.created_at;
      if (e.created_at > cur.max) cur.max = e.created_at;
    } else {
      sessionMinMax.set(k, { min: e.created_at, max: e.created_at });
    }
  }
  let durationSum = 0;
  let durationCount = 0;
  for (const [k, m] of sessions) {
    if (typeof m.sessionDurationSeconds === "number") {
      durationSum += m.sessionDurationSeconds;
      durationCount += 1;
      continue;
    }
    const mm = sessionMinMax.get(k);
    if (mm) {
      const ms = new Date(mm.max).getTime() - new Date(mm.min).getTime();
      const secs = Math.max(0, Math.round(ms / 1000));
      // Fallback nur bei mehreren Events (Single-Event-Sessions würden 0 → Bias).
      if (secs > 0) {
        durationSum += secs;
        durationCount += 1;
      }
    }
  }
  const avgSessionDurationSeconds = durationCount > 0 ? Math.round(durationSum / durationCount) : 0;

  // ---- Wiederkehrende Besucher.
  // Aktuelle scan_events.return_visit wird vom Tracker NICHT gesetzt
  // (kein persistenter Visitor-Identifier in localStorage). Wir geben das
  // dem Client transparent mit, der zeigt einen Hinweis. ----
  const returningCount = [...sessions.values()].filter((s) => s.returnVisit === true).length;
  const returningPct =
    totalSessions > 0 ? Math.round((returningCount / totalSessions) * 100) : 0;
  const returningAvailable = returningCount > 0; // nur "echt verfügbar", wenn schon mind. 1 Returning getrackt
  const returningVisitor = {
    available: returningAvailable,
    returningPct,
    firstVisitPct: 100 - returningPct,
  };

  // ---- Peak-Tag (1× pro Session, frühester Wochentag). ----
  const dayCounts: Record<number, number> = {};
  for (const m of sessions.values()) {
    dayCounts[m.firstWeekday] = (dayCounts[m.firstWeekday] ?? 0) + 1;
  }
  let peakDay: { dayIndex: number; count: number } | null = null;
  for (const [k, v] of Object.entries(dayCounts)) {
    const i = Number(k);
    if (!peakDay || v > peakDay.count) peakDay = { dayIndex: i, count: v };
  }
  const peakDayOfWeek = peakDay
    ? { dayIndex: peakDay.dayIndex, dayLabel: WEEKDAY_LABELS[peakDay.dayIndex] ?? "—", count: peakDay.count }
    : null;

  // ---- Peak-Stunde (±1h Fenster). ----
  const hourCounts: Record<number, number> = {};
  for (const m of sessions.values()) {
    hourCounts[m.firstHour] = (hourCounts[m.firstHour] ?? 0) + 1;
  }
  let peakHour: { hour: number; count: number } | null = null;
  for (const [k, v] of Object.entries(hourCounts)) {
    const h = Number(k);
    if (!peakHour || v > peakHour.count) peakHour = { hour: h, count: v };
  }
  const peakHourWindow = peakHour
    ? {
        peakHour: peakHour.hour,
        fromHour: Math.max(0, peakHour.hour - 1),
        toHour: Math.min(23, peakHour.hour + 1),
        sessionsInWindow:
          (hourCounts[Math.max(0, peakHour.hour - 1)] ?? 0) +
          (hourCounts[peakHour.hour] ?? 0) +
          (hourCounts[Math.min(23, peakHour.hour + 1)] ?? 0),
      }
    : null;

  // ---- Consent ----
  const withConsent = [...sessions.values()].filter((s) => s.maxTier >= 1).length;
  const withoutConsent = totalSessions - withConsent;
  const ratePct = totalSessions > 0 ? Math.round((withConsent / totalSessions) * 100) : 0;

  return {
    granularity,
    chartLabels,
    chartScanCounts,
    timeBlocks: blocks,
    topItems,
    topCategories,
    topDrinks,
    drinkCategoryBreakdown: drinkBreakdown,
    dominantDrinkCategory,
    bounce: {
      available: bounceAvailable,
      rate: bounceRate,
      bounced: bouncedSessions,
      totalSessions,
    },
    avgSessionDurationSeconds,
    returningVisitor,
    peakDayOfWeek,
    peakHourWindow,
    totalImpressions,
    consent: {
      totalSessions,
      withConsent,
      withoutConsent,
      ratePct,
    },
    scansByBerlinDay,
  };
}
