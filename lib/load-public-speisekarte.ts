import { supabase, fetchDailyPushes, fetchLunchOffers } from "@/lib/supabase";
import type { Restaurant, MenuItem, DailyPush, LunchOffer } from "@/lib/supabase";
import { orderedCategoriesFromItems } from "@/components/speisekarte/menu-layout";

const RESTAURANT_SELECT_PUBLIC =
  "id, slug, name, template, background_mode, custom_bg_color, custom_text_color, accent_color, logo_url, guest_note, aktiv, published, active_languages";

const MENU_EXTENDED_SELECT =
  "id, restaurant_id, name, beschreibung, preis, kategorie, bild_url, aktiv, sold_out, tags, emoji, allergens_text, sort_order, main_tab, zutaten, geschmacksprofil, story_text, name_en, name_tr, name_ar, name_ru, name_it, name_fr, beschreibung_en, beschreibung_tr, beschreibung_ar, beschreibung_ru, beschreibung_it, beschreibung_fr";

const MENU_BASE_SELECT =
  "id, restaurant_id, name, beschreibung, preis, kategorie, main_tab, bild_url, aktiv, sold_out, tags, zutaten, geschmacksprofil, story_text, sort_order, allergens_text";

export type PublicSpeisekarteRestaurant = Restaurant & {
  accent_color?: string | null;
  logo_url?: string | null;
};

export type PublicSpeisekarteData = {
  restaurant: PublicSpeisekarteRestaurant;
  menuItems: MenuItem[];
  categories: string[];
  dailyPushes: DailyPush[];
  lunchOffers: LunchOffer[];
};

export async function loadPublicSpeisekarteBySlug(
  slug: string,
): Promise<PublicSpeisekarteData | null> {
  const { data: restaurantData, error: restaurantError } = await supabase
    .from("restaurants")
    .select(RESTAURANT_SELECT_PUBLIC)
    .eq("slug", slug)
    .single();

  if (restaurantError || !restaurantData) {
    return null;
  }

  const restaurant = restaurantData as PublicSpeisekarteRestaurant;
  // Gäste sehen nur Karten, die explizit freigegeben sind.
  if (restaurant.published === false || restaurant.aktiv === false) return null;

  let itemsData: unknown = null;
  let itemsError: { message: string } | null = null;

  const res = await supabase
    .from("menu_items")
    .select(MENU_EXTENDED_SELECT)
    .eq("restaurant_id", restaurant.id)
    .eq("aktiv", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("kategorie", { ascending: true })
    .order("name", { ascending: true });
  itemsData = res.data;
  itemsError = res.error;

  if (itemsError?.message?.includes("column") || itemsError?.message?.includes("does not exist")) {
    const fallback = await supabase
      .from("menu_items")
      .select(MENU_BASE_SELECT)
      .eq("restaurant_id", restaurant.id)
      .eq("aktiv", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("kategorie", { ascending: true })
      .order("name", { ascending: true });
    itemsData = fallback.data;
    itemsError = fallback.error;
  }

  if (itemsError) {
    console.error("Supabase menu_items:", itemsError);
    return null;
  }

  const menuItems = (itemsData ?? []) as MenuItem[];

  const categories = orderedCategoriesFromItems(menuItems);

  const [dailyPushes, lunchOffers] = await Promise.all([
    fetchDailyPushes(restaurant.id),
    fetchLunchOffers(restaurant.id),
  ]);

  return {
    restaurant,
    menuItems,
    categories,
    dailyPushes,
    lunchOffers,
  };
}
