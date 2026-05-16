import type { Restaurant } from "@/lib/supabase";

/** Restaurant-Zeile mit den fürs Dashboard geladenen Spalten */
export type DashboardRestaurant = Pick<
  Restaurant,
  | "id"
  | "slug"
  | "name"
  | "template"
  | "aktiv"
  | "published"
  | "guest_note"
  | "adresse"
  | "stadt"
  | "telefon"
  | "email"
  | "whatsapp"
  | "instagram"
  | "maps_url"
  | "oeffnungszeiten"
  | "active_languages"
  | "splash_media_url"
  | "splash_media_type"
  | "tisch_bereiche"
> & {
  accent_color?: string | null;
  logo_url?: string | null;
  auth_user_id?: string | null;
};

export type DashboardTab = "home" | "karte" | "design" | "tische";

export type KarteSub = "menu" | "heute" | "lunch" | "notiz";

export type TischHeat = "hot" | "warm" | "cold" | "dead";

export type Tisch = {
  id: string;
  nr: number;
  scans: number;
  active: boolean;
};

export type Bereich = {
  key: string;
  emoji: string;
  label: string;
  tische: Tisch[];
  open: boolean;
};

export type OverlaysState = {
  editItem: boolean;
  addCat: boolean;
};

export type PagesState = {
  preview: boolean;
};

export function heatFromScans(scans: number): TischHeat {
  if (scans > 7) return "hot";
  if (scans >= 3) return "warm";
  if (scans >= 1) return "cold";
  return "dead";
}
