import { supabase, fetchDailyPush } from "@/lib/supabase";
import type { Restaurant, MenuItem } from "@/lib/supabase";
import { orderedCategoriesFromItems } from "@/components/speisekarte/menu-layout";

const RESTAURANT_SELECT_PUBLIC =
  "id, slug, name, template, accent_color, logo_url";

const MENU_EXTENDED_SELECT =
  "id, restaurant_id, name, beschreibung, preis, kategorie, bild_url, aktiv, tags, emoji, allergen_ids, sponsored, partner_name, preis_volumen, sort_order, is_highlight, main_tab, section_subtitle, zutaten, geschmacksprofil, story_text";

const MENU_BASE_SELECT =
  "id, restaurant_id, name, beschreibung, preis, kategorie, main_tab, bild_url, aktiv, tags, zutaten, geschmacksprofil, story_text, sort_order";

export type PublicSpeisekarteRestaurant = Restaurant & {
  accent_color?: string | null;
  logo_url?: string | null;
};

export type PublicSpeisekarteData = {
  restaurant: PublicSpeisekarteRestaurant;
  menuItems: MenuItem[];
  categories: string[];
  highlights: MenuItem[];
  dailyPush: Awaited<ReturnType<typeof fetchDailyPush>>;
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

  const highlights = menuItems.filter((item) => item.is_highlight === true);
  const dailyPush = await fetchDailyPush(restaurant.id);

  return {
    restaurant,
    menuItems,
    categories,
    highlights,
    dailyPush,
  };
}
