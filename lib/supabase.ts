import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Ein Tag in opening_hours (Mo–So, 7 Einträge) */
export type OpeningHoursDay = {
  day: string;
  open: string;
  close: string;
  closed: boolean;
};

export type OpeningHours = OpeningHoursDay[];

export const OPENING_HOURS_DAY_KEYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

export function defaultOpeningHours(): OpeningHours {
  return OPENING_HOURS_DAY_KEYS.map((day, i) => ({
    day,
    open: "11:00",
    close: "22:00",
    closed: i === 6,
  }));
}

/** Parst JSON aus Supabase; bei null/ungültig → Defaults (Mo–Sa 11–22, So zu). */
export function parseOpeningHours(raw: unknown): OpeningHours {
  if (!Array.isArray(raw) || raw.length !== 7) {
    return defaultOpeningHours();
  }
  const result: OpeningHours = [];
  for (let i = 0; i < 7; i++) {
    const o = raw[i];
    if (!o || typeof o !== "object") {
      return defaultOpeningHours();
    }
    const rec = o as Record<string, unknown>;
    const day = typeof rec.day === "string" ? rec.day : OPENING_HOURS_DAY_KEYS[i];
    const open = typeof rec.open === "string" ? rec.open : "11:00";
    const close = typeof rec.close === "string" ? rec.close : "22:00";
    const closed = typeof rec.closed === "boolean" ? rec.closed : i === 6;
    result.push({ day, open, close, closed });
  }
  return result;
}

export type Restaurant = {
  id: string;
  slug: string;
  name: string;
  template?: string | null;
  stadt: string | null;
  adresse: string | null;
  telefon: string | null;
  email: string | null;
  aktiv: boolean;
  /** Founder-Modal / CRM (Migration restaurants) */
  ansprechpartner?: string | null;
  /** z. B. in_einrichtung | live | offline */
  status?: string | null;
  naechster_besuch?: string | null;
  notiz?: string | null;
  ansprechpartner_name: string | null;
  notizen: string | null;
  letzter_kontakt: string | null; // ISO-Date
  naechster_termin: string | null; // ISO-Date
  vertragsstatus: "aktiv" | "pausiert" | "gekündigt" | null;
  sticker_anzahl: number | null;
  scans_heute: number | null;
  umsatz_monat: number | null;
  aktive_partner: number | null;
  /** Kurzinfo für Gäste (Speisekarte / Preview) */
  guest_note?: string | null;
  /** Wochenplan Mo–So */
  opening_hours?: OpeningHours | null;
  /** Öffentliche URL zum Logo (Supabase Storage, z. B. restaurant-assets) */
  logo_url?: string | null;
};

/** Mehrpreise z.B. 0,2l / 0,3l / 0,5l / Flasche */
export type PreisVolumen = Record<string, string>;

export type MenuItem = {
  id: string;
  restaurant_id: string;
  name: string;
  beschreibung: string | null;
  preis: number;
  kategorie: string;
  bild_url: string | null;
  tags: string[] | null;
  aktiv: boolean;
  /** Verfügbarkeit (Zeit/Datum je nach DB-Typ, meist ISO-String) */
  verfuegbar_von?: string | null;
  verfuegbar_bis?: string | null;
  /** z. B. Wochentage als Array oder serialisiert — je nach Spaltentyp in der DB */
  verfuegbar_tage?: number[] | string | null;
  ist_mittagsmenu?: boolean | null;
  mittagsmenu_preis?: number | null;
  reihenfolge?: number | null;
  created_at?: string;
  /** Haupt-Tab: speisen, getraenke, snacks, … */
  main_tab?: string | null;
  zutaten?: { emoji: string; name: string; subtext: string }[] | null;
  geschmacksprofil?: Record<string, number> | null;
  story_text?: string | null;
  /** Einzelnes Emoji (z.B. 🍺) */
  emoji?: string | null;
  sort_order?: number;
  /** Allergene: gluten, milk, egg, nuts, shellfish, fish, soy (nicht in allen DB-Versionen) */
  allergen_ids?: string[] | null;
  /** Freitext-Allergene & Zutaten (vom PDF-Import autom. vorbefuellt). */
  allergens_text?: string | null;
  sponsored?: boolean;
  partner_name?: string | null;
  preis_volumen?: PreisVolumen | null;
  is_highlight?: boolean;
  section_subtitle?: string | null;
  /** Scan-Events (z. B. pro Woche), für Stat-Pills im Item-Modal */
  scan_count?: number | null;
};

/** Partner-Einträge für gesponserte „Dazu passend“-Karten (Tabelle sponsored_items) */
export type SponsoredItem = {
  id: string;
  partner_name: string;
  item_name: string;
  beschreibung?: string | null;
  bild_url?: string | null;
  preis: number | null;
  kategorie: string;
  trigger_kategorien: string[];
  restaurant_ids: string[];
  aktiv: boolean;
  created_at?: string;
  /** Nur gesetzt, wenn die Zeile als Karte im Modal gerendert wird */
  isSponsored?: true;
};

export type DailyPush = {
  id: string;
  restaurant_id: string;
  active_date: string;
  item_emoji: string;
  item_name: string;
  item_desc: string | null;
  created_at?: string;
};

/** Wochentags-Keys, wie in `lunch_offers.weekdays text[]` und im UI verwendet. */
export const LUNCH_WEEKDAY_KEYS = ["mo", "di", "mi", "do", "fr", "sa", "so"] as const;
export type LunchWeekday = (typeof LUNCH_WEEKDAY_KEYS)[number];

/** Mittagsangebot-Eintrag (public.lunch_offers).
 *  Ein Eintrag ist entweder Single-Item (`item_id` gesetzt, `is_bundle=false`)
 *  oder Bundle (`is_bundle=true`, `bundle_items` enthält menu_item-IDs,
 *  `lunch_price` ist der Gesamtpreis). */
export type LunchOffer = {
  id: string;
  restaurant_id: string;
  /** Bei Single-Items gesetzt; bei Bundles NULL. */
  item_id: string | null;
  /** Optional abweichender Mittagspreis (Single) bzw. Gesamtpreis (Bundle). */
  lunch_price: number | null;
  /** ISO-Time "HH:MM" oder "HH:MM:SS". */
  time_from: string;
  time_to: string;
  /** Auswahl aus LUNCH_WEEKDAY_KEYS, z. B. ["mo","di","mi","do","fr"]. */
  weekdays: string[];
  aktiv: boolean;
  is_bundle: boolean;
  /** Bei Bundles: Liste der enthaltenen menu_items.id; sonst []. */
  bundle_items: string[];
  /** Anzeigename des Bundles (z. B. „Mittagsmenü 1"). */
  bundle_name: string | null;
  created_at?: string;
};

const LUNCH_OFFER_SELECT =
  "id, restaurant_id, item_id, lunch_price, time_from, time_to, weekdays, aktiv, is_bundle, bundle_items, bundle_name, created_at";

/** Liefert alle aktiven Mittagsangebote für ein Restaurant. */
export async function fetchLunchOffers(restaurantId: string): Promise<LunchOffer[]> {
  const { data, error } = await supabase
    .from("lunch_offers")
    .select(LUNCH_OFFER_SELECT)
    .eq("restaurant_id", restaurantId)
    .eq("aktiv", true);
  if (error || !data) return [];
  return data as LunchOffer[];
}

/** NFC / QR-Tischplatzierung (public.restaurant_tables) */
export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  tisch_nummer: number;
  bereich: string | null;
  qr_url: string | null;
  nfc_programmiert: boolean;
  nfc_installiert: boolean;
  sticker_angebracht: boolean;
  sticker_installiert: boolean;
  aktiv: boolean;
  created_at: string;
}

/** Fetches today's daily_push entries for a restaurant (bis zu 3 Specials). */
export async function fetchDailyPushes(restaurantId: string): Promise<DailyPush[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("daily_push")
    .select("id, restaurant_id, active_date, item_emoji, item_name, item_desc, created_at")
    .eq("restaurant_id", restaurantId)
    .eq("active_date", today)
    .order("created_at", { ascending: true })
    .limit(3);
  if (error || !data) return [];
  return data as DailyPush[];
}

/** @deprecated nutze fetchDailyPushes — gibt erstes Special oder null zurück. */
export async function fetchDailyPush(restaurantId: string): Promise<DailyPush | null> {
  const list = await fetchDailyPushes(restaurantId);
  return list[0] ?? null;
}
