import { supabase } from "@/lib/supabase";
import type { MenuItem } from "@/lib/supabase";

/** Exakt die Spalten der produktiven `menu_items`-Tabelle (keine Extras). */
const MENU_SELECT =
  "id, restaurant_id, name, beschreibung, preis, kategorie, bild_url, tags, aktiv, verfuegbar_von, verfuegbar_bis, verfuegbar_tage, ist_mittagsmenu, mittagsmenu_preis, reihenfolge, created_at, main_tab, zutaten, geschmacksprofil, story_text, emoji, sort_order";

/** Lädt alle Menüzeilen für die Bearbeitung (inkl. inaktiver). */
export async function fetchMenuItemsForDashboard(
  restaurantId: string,
): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select(MENU_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.error(
      "fetchMenuItemsForDashboard:",
      JSON.stringify(error),
      error.message,
      error.code,
      error.details,
    );
    return [];
  }
  return (data ?? []) as MenuItem[];
}
