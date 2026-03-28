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
  sponsored?: boolean;
  partner_name?: string | null;
  preis_volumen?: PreisVolumen | null;
  is_highlight?: boolean;
  section_subtitle?: string | null;
};

export type DailyPush = {
  id: string;
  restaurant_id: string;
  active_date: string;
  item_emoji: string;
  item_name: string;
  item_desc: string | null;
};

/** NFC / QR-Tischplatzierung (public.tables) */
export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  tisch_nummer: number;
  zone: string;
  qr_code_url: string | null;
  nfc_aktiv: boolean;
  aktiv: boolean;
  created_at: string;
  scans_total?: number;
  scans_today?: number;
  last_scan_at?: string | null;
}

/** Fetches today's daily_push for a restaurant. */
export async function fetchDailyPush(restaurantId: string): Promise<DailyPush | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("daily_push")
    .select("id, restaurant_id, active_date, item_emoji, item_name, item_desc")
    .eq("restaurant_id", restaurantId)
    .eq("active_date", today)
    .maybeSingle();
  if (error || !data) return null;
  return data as DailyPush;
}
