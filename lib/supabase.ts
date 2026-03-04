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
};
