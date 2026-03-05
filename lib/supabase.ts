import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Restaurant = {
  id: string;
  slug: string;
  name: string;
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
  aktiv: boolean;
  tags: string[] | null;
  /** Einzelnes Emoji (z.B. 🍺) */
  emoji?: string | null;
  /** Allergene: gluten, milk, egg, nuts, shellfish, fish, soy */
  allergen_ids?: string[] | null;
  sponsored?: boolean;
  partner_name?: string | null;
  preis_volumen?: PreisVolumen | null;
  sort_order?: number;
  is_highlight?: boolean;
  /** Haupt-Tab: speisen, cocktails, bier_wein, alkoholfrei, snacks */
  main_tab?: string | null;
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
