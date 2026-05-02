import type { Restaurant } from "@/lib/supabase";

/** Restaurant-Zeile mit den fürs Dashboard geladenen Spalten */
export type DashboardRestaurant = Pick<
  Restaurant,
  | "id"
  | "slug"
  | "name"
  | "template"
  | "aktiv"
  | "guest_note"
  | "opening_hours"
  | "adresse"
  | "stadt"
  | "email"
> & {
  accent_color?: string | null;
  logo_url?: string | null;
  auth_user_id?: string | null;
};

export type DashboardTab = "home" | "karte" | "tische";

export type KarteSub = "menu" | "heute" | "notiz";

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
  settings: boolean;
  editItem: boolean;
  addCat: boolean;
  oeffnung: boolean;
};

export type PagesState = {
  tischeConfig: boolean;
  preview: boolean;
};

export function heatFromScans(scans: number): TischHeat {
  if (scans > 7) return "hot";
  if (scans >= 3) return "warm";
  if (scans >= 1) return "cold";
  return "dead";
}
