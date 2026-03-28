import type { Restaurant } from "@/lib/supabase";

/** Zeilen wie in der Spezifikation (scan_events, letzte 7 Tage) */
export type FounderScanEventRow = {
  id?: string;
  session_id?: string | null;
  event_type: string;
  stunde: number | null;
  wochentag: number | null;
  monat: number | null;
  tisch_nummer: number | null;
  item_name: string | null;
  kategorie: string | null;
  main_tab: string | null;
  duration_seconds: number | null;
  tier: number;
  created_at: string;
  restaurant_id: string | null;
};

export type FounderRestaurantRow = Restaurant & {
  created_at?: string | null;
};

export type FounderRestaurantExtRow = {
  id: string;
  restaurant_id: string;
  next_visit: string | null;
  last_visit: string | null;
  note: string | null;
  sticker_tier: string | null;
  sticker_paid: boolean;
  sticker_count: number;
  updated_at: string;
};

export type FounderPipelineRow = {
  id: string;
  name: string;
  area: string | null;
  phone: string | null;
  contact: string | null;
  stage: string | null;
  heat: string | null;
  note: string | null;
  added_at: string;
};

export type FounderTodoRow = {
  id: string;
  text: string;
  sub: string | null;
  prio: string | null;
  done: boolean;
  created_at: string;
};

export type FounderWerbepartnerRow = {
  id: string;
  name: string;
  company: string | null;
  contact: string | null;
  phone: string | null;
  mrr_monthly: number | null;
  note: string | null;
  created_at: string;
};

/** Founder-Tisch-QR (Migration restaurant_tables). */
export type FounderRestaurantTableRow = {
  id: string;
  restaurant_id: string;
  tisch_nummer: number;
  bereich: string | null;
  qr_url: string | null;
  nfc_programmiert: boolean;
  sticker_angebracht: boolean;
  created_at: string;
};

export type FounderDashboardData = {
  restaurants: FounderRestaurantRow[];
  /** @deprecated Alias für scanEventsWeek (Kompatibilität). */
  scanEvents: FounderScanEventRow[];
  scanEventsToday: FounderScanEventRow[];
  scanEventsWeek: FounderScanEventRow[];
  scanEventsMonth: FounderScanEventRow[];
  scanEventsYear: FounderScanEventRow[];
  pipeline: FounderPipelineRow[];
  todos: FounderTodoRow[];
  restaurantExtras: FounderRestaurantExtRow[];
  restaurantTables: FounderRestaurantTableRow[];
};
