import type { RawRestaurantEventRow } from "@/lib/restaurant-analytics-aggregate";

export type TopItemEntry = {
  name: string;
  clicks: number;
  /** Anzahl Item-Views (Card im Viewport ≥ 0.5 für ≥ 500ms, einmal pro Session).
   *  Optional — bestehende Aggregat-Rows vor dem 12.05.2026 haben dieses Feld nicht. */
  views?: number;
  /** Häufigster (modaler) Preis bei diesem Item; null wenn nie ein Preis erfasst wurde. */
  price: number | null;
};

export type RestaurantAnalyticsDailyRow = {
  restaurant_id: string;
  day_berlin: string;
  scan_count: number;
  item_detail_count: number;
  category_enter_count: number;
  scans_morning: number;
  scans_midday: number;
  scans_evening: number;
  scans_night: number;
  sessions_count: number;
  sessions_with_consent: number;
  /** Käufer-Metriken (additiv ergänzt) */
  category_clicks: Record<string, number>;
  beverage_subcategory_clicks: Record<string, number>;
  top_items: TopItemEntry[];
  vegan_clicks: number;
  vegetarian_clicks: number;
  avg_item_price_clicked: number | null;
  /** Erweiterte Aggregate (Migration 20260529100100) */
  price_bucket_clicks: Record<string, number>;
  beverage_by_hour: Record<"morning" | "midday" | "evening" | "night", Record<string, number>>;
  avg_wishlist_value: number | null;
  top_categories_by_month: Record<string, Record<string, number>>;
  updated_at: string;
};

function sessionKey(e: RawRestaurantEventRow): string {
  const sidRaw = e.session_id?.trim() ? e.session_id : e.id;
  if (sidRaw.length > 0) return sidRaw;
  return `row:${e.created_at}:${e.event_type}:${e.restaurant_id ?? ""}`;
}

function eventHourBerlin(e: RawRestaurantEventRow): number {
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

function timeBlockForHour(h: number): "morning" | "midday" | "evening" | "night" {
  if (h >= 6 && h < 11) return "morning";
  if (h >= 11 && h < 15) return "midday";
  if (h >= 15 && h < 22) return "evening";
  return "night";
}

/** Preis-Bucket aus EUR-Preis (gespiegelt zu lib/tracking.ts). Server-seitig
 *  als Sicherheitsnetz für Roh-Events deren `price_bucket`-Spalte null ist. */
function priceBucketFromEur(price: number | null | undefined): "budget" | "mid" | "premium" | null {
  if (price == null || !Number.isFinite(price) || price < 0) return null;
  if (price < 5) return "budget";
  if (price <= 15) return "mid";
  return "premium";
}

/** Modaler Preis (häufigster Wert) eines Items. Bei Gleichstand: höchster
 *  Wert (deterministisch). Null wenn kein einziger Preis erfasst wurde. */
function modePrice(prices: number[]): number | null {
  if (prices.length === 0) return null;
  const counts = new Map<number, number>();
  for (const p of prices) {
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  let bestPrice: number | null = null;
  let bestCount = 0;
  for (const [price, count] of counts) {
    if (count > bestCount || (count === bestCount && bestPrice != null && price > bestPrice)) {
      bestPrice = price;
      bestCount = count;
    }
  }
  return bestPrice;
}

function metricsForRestaurantEvents(
  restaurantId: string,
  dayYmd: string,
  events: RawRestaurantEventRow[],
): RestaurantAnalyticsDailyRow {
  // Eine "Session" = ein eindeutiger Besuch der Speisekarte. Wir nehmen die
  // session_id, fallen sonst auf die Event-ID zurück. Ein "Scan" wird
  // semantisch als der Beginn einer Session interpretiert — der frühest
  // gesehene Hour-Bucket pro Session entscheidet die Tageszeit.
  //
  // Hintergrund: `event_type === "scan"` wird nur vom Tier-0-Server-Pfad
  // (`/<slug>/<tischSegment>`) geschrieben — bei direktem Slug-Aufruf
  // entstehen keine "scan"-Rows, obwohl der Gast die Karte sieht. Vorher
  // war scan_count deshalb für die meisten Restaurants 0.
  const sessions = new Map<
    string,
    { firstHour: number; maxTier: number }
  >();
  for (const e of events) {
    const k = sessionKey(e);
    const h = eventHourBerlin(e);
    const t = e.tier ?? 0;
    const cur = sessions.get(k);
    if (cur) {
      if (h < cur.firstHour) cur.firstHour = h;
      if (t > cur.maxTier) cur.maxTier = t;
    } else {
      sessions.set(k, { firstHour: h, maxTier: t });
    }
  }

  const blocks = { morning: 0, midday: 0, evening: 0, night: 0 };
  for (const s of sessions.values()) {
    blocks[timeBlockForHour(s.firstHour)]++;
  }

  const sessionsCount = sessions.size;
  const withConsent = [...sessions.values()].filter((s) => s.maxTier >= 1).length;

  // ---- Käufer-Metriken ----
  // category_clicks: zählt category_enter UND item_detail Events nach kategorie
  // (User-Definition: "category_enter oder item_detail" — alle inhaltlichen Klicks).
  const categoryClicks: Record<string, number> = {};
  for (const e of events) {
    if (e.event_type !== "category_enter" && e.event_type !== "item_detail") continue;
    const k = e.kategorie?.trim();
    if (!k) continue;
    categoryClicks[k] = (categoryClicks[k] ?? 0) + 1;
  }

  // beverage_subcategory_clicks: alle Events mit gesetzter Subkategorie (nicht
  // nur item_detail — wenn ein anderer Event-Typ sie mitführt, zählt er auch).
  const beverageSubcategoryClicks: Record<string, number> = {};
  for (const e of events) {
    const sub = e.beverage_subcategory?.trim();
    if (!sub) continue;
    beverageSubcategoryClicks[sub] = (beverageSubcategoryClicks[sub] ?? 0) + 1;
  }

  // top_items: zählt clicks (item_detail) + views (item_view) pro Name.
  // views = Item-Card war ≥ 0.5 im Viewport für ≥ 500ms (einmal pro Session).
  // clicks = Modal-Open.
  const itemStats = new Map<string, { clicks: number; views: number; prices: number[] }>();
  let veganClicks = 0;
  let vegetarianClicks = 0;
  const allPrices: number[] = [];
  for (const e of events) {
    if (e.event_type !== "item_detail" && e.event_type !== "item_view") continue;
    const name = e.item_name?.trim();
    if (name) {
      const cur = itemStats.get(name) ?? { clicks: 0, views: 0, prices: [] };
      if (e.event_type === "item_detail") {
        cur.clicks += 1;
        if (e.item_price != null && Number.isFinite(e.item_price)) {
          cur.prices.push(Number(e.item_price));
        }
      } else {
        cur.views += 1;
      }
      itemStats.set(name, cur);
    }
    if (e.event_type === "item_detail") {
      const tags = Array.isArray(e.item_tags) ? e.item_tags : [];
      if (tags.includes("vegan")) veganClicks += 1;
      if (tags.includes("vegetarisch")) vegetarianClicks += 1;
      if (e.item_price != null && Number.isFinite(e.item_price)) {
        allPrices.push(Number(e.item_price));
      }
    }
  }

  // Top 10 nach clicks DESC. Items mit views aber ohne clicks landen nicht
  // in der Top-Liste — werden aber in scan_events.event_type='item_view'
  // weiterhin für Konversions-Analysen vorgehalten.
  const topItems: TopItemEntry[] = [...itemStats.entries()]
    .filter(([, v]) => v.clicks > 0 || v.views > 0)
    .map(([name, v]) => ({ name, clicks: v.clicks, views: v.views, price: modePrice(v.prices) }))
    .sort((a, b) => b.clicks - a.clicks || (b.views ?? 0) - (a.views ?? 0) || a.name.localeCompare(b.name, "de"))
    .slice(0, 10);

  const avgItemPriceClicked =
    allPrices.length === 0
      ? null
      : Math.round((allPrices.reduce((s, p) => s + p, 0) / allPrices.length) * 100) / 100;

  // ---- Erweiterte Aggregate (Migration 20260529100100) ----
  // E2: Preis-Bucket-Klicks (nur item_detail).
  const priceBucketClicks: Record<string, number> = {};
  for (const e of events) {
    if (e.event_type !== "item_detail") continue;
    const bucket = e.price_bucket?.trim() || priceBucketFromEur(e.item_price);
    if (!bucket) continue;
    priceBucketClicks[bucket] = (priceBucketClicks[bucket] ?? 0) + 1;
  }

  // E3: Getränke-Subkategorie × Tagesblock (für item_detail bei Getränken).
  const beverageByHour: Record<"morning" | "midday" | "evening" | "night", Record<string, number>> = {
    morning: {},
    midday: {},
    evening: {},
    night: {},
  };
  for (const e of events) {
    const sub = e.beverage_subcategory?.trim();
    if (!sub) continue;
    const block = timeBlockForHour(eventHourBerlin(e));
    beverageByHour[block][sub] = (beverageByHour[block][sub] ?? 0) + 1;
  }

  // E4: Ø-Wert der Wishlist-Adds an diesem Tag.
  const wishlistPrices: number[] = [];
  for (const e of events) {
    if (e.event_type !== "wishlist_add") continue;
    if (e.item_price == null || !Number.isFinite(e.item_price)) continue;
    wishlistPrices.push(Number(e.item_price));
  }
  const avgWishlistValue =
    wishlistPrices.length === 0
      ? null
      : Math.round((wishlistPrices.reduce((s, p) => s + p, 0) / wishlistPrices.length) * 100) / 100;

  // E5: Kategorien-Klicks nach Monat. Tages-Row enthält i. d. R. nur einen
  // Monat — die jsonb-Form ermöglicht Aufsummierung über mehrere Tages-Rows
  // hinweg in Read-Queries.
  const topCategoriesByMonth: Record<string, Record<string, number>> = {};
  for (const e of events) {
    if (e.event_type !== "item_detail" && e.event_type !== "category_enter") continue;
    const cat = e.kategorie?.trim();
    if (!cat) continue;
    const monatKey = e.monat != null && Number.isFinite(e.monat)
      ? String(e.monat)
      : String(new Date(e.created_at).getUTCMonth() + 1);
    const map = topCategoriesByMonth[monatKey] ?? {};
    map[cat] = (map[cat] ?? 0) + 1;
    topCategoriesByMonth[monatKey] = map;
  }

  return {
    restaurant_id: restaurantId,
    day_berlin: dayYmd,
    scan_count: sessionsCount,
    item_detail_count: events.filter((e) => e.event_type === "item_detail").length,
    category_enter_count: events.filter((e) => e.event_type === "category_enter").length,
    scans_morning: blocks.morning,
    scans_midday: blocks.midday,
    scans_evening: blocks.evening,
    scans_night: blocks.night,
    sessions_count: sessionsCount,
    sessions_with_consent: withConsent,
    category_clicks: categoryClicks,
    beverage_subcategory_clicks: beverageSubcategoryClicks,
    top_items: topItems,
    vegan_clicks: veganClicks,
    vegetarian_clicks: vegetarianClicks,
    avg_item_price_clicked: avgItemPriceClicked,
    price_bucket_clicks: priceBucketClicks,
    beverage_by_hour: beverageByHour,
    avg_wishlist_value: avgWishlistValue,
    top_categories_by_month: topCategoriesByMonth,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Roh-Events müssen alle zum gleichen Kalendertag `dayYmd` (Europe/Berlin) gehören.
 */
export function buildDailyRowsFromEvents(
  dayYmd: string,
  events: RawRestaurantEventRow[],
): RestaurantAnalyticsDailyRow[] {
  const byRestaurant = new Map<string, RawRestaurantEventRow[]>();
  for (const e of events) {
    const rid = e.restaurant_id?.trim();
    if (!rid) continue;
    const list = byRestaurant.get(rid) ?? [];
    list.push(e);
    byRestaurant.set(rid, list);
  }
  const rows: RestaurantAnalyticsDailyRow[] = [];
  for (const [restaurantId, list] of byRestaurant) {
    rows.push(metricsForRestaurantEvents(restaurantId, dayYmd, list));
  }
  return rows;
}
