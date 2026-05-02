import { supabase } from "./supabase";
import type { MenuItem, SponsoredItem } from "./supabase";

/** Gesponserte Karte in der Vorschlagsliste */
export type SponsoredSuggestion = SponsoredItem & { isSponsored: true };

const DRINK_KEYWORDS = [
  "getränk",
  "getränke",
  "getraenk",
  "getraenke",
  "drink",
  "drinks",
  "wein",
  "weine",
  "bier",
  "cocktail",
  "cocktails",
  "softdrink",
  "saft",
  "wasser",
  "kaffee",
  "tee",
  "sake",
  "spirits",
  "alkohol",
];

const HOT_DRINK_KEYWORDS = [
  "kaffee",
  "espresso",
  "cappuccino",
  "latte",
  "flat white",
  "cortado",
  "tee",
  "matcha",
  "chai",
  "hot drinks",
];

const BREAKFAST_DESSERT_KEYWORDS = [
  "frühstück",
  "breakfast",
  "dessert",
  "nachspeise",
  "kuchen",
  "torte",
  "pancake",
];

export function isDrinkItem(item: MenuItem): boolean {
  return DRINK_KEYWORDS.some(
    (k) =>
      (item.kategorie ?? "").toLowerCase().includes(k) ||
      (item.main_tab ?? "").toLowerCase().includes(k) ||
      item.main_tab?.toLowerCase() === "drinks",
  );
}

function isHotDrink(item: MenuItem): boolean {
  return HOT_DRINK_KEYWORDS.some(
    (k) =>
      (item.kategorie ?? "").toLowerCase().includes(k) ||
      (item.name ?? "").toLowerCase().includes(k),
  );
}

function isBreakfastOrDessert(item: MenuItem): boolean {
  return BREAKFAST_DESSERT_KEYWORDS.some((k) =>
    (item.kategorie ?? "").toLowerCase().includes(k),
  );
}

export function getDrinkSuggestions(
  menuItems: MenuItem[],
  currentItem: MenuItem,
  sponsoredItems: SponsoredItem[],
  limit = 5,
): (MenuItem | SponsoredSuggestion)[] {
  const results: (MenuItem | SponsoredSuggestion)[] = [];

  const cat = (currentItem.kategorie ?? "").trim().toLowerCase();

  const triggered = sponsoredItems.filter((s) => {
    if (!s.aktiv) return false;

    const categoryMatch = (s.trigger_kategorien ?? []).some((t) => {
      const tl = t.trim().toLowerCase();
      return tl === cat || tl === "all";
    });
    if (!categoryMatch) return false;

    const partnerKeywords = [
      (s.partner_name ?? "").toLowerCase(),
      (s.item_name ?? "").toLowerCase().split(" ").filter(Boolean)[0] ?? "",
    ].filter(Boolean);

    const hasProductOnMenu = menuItems.some(
      (m) =>
        isDrinkItem(m) &&
        partnerKeywords.some((k) => (m.name ?? "").toLowerCase().includes(k)),
    );

    return hasProductOnMenu;
  });

  if (triggered.length > 0) {
    results.push({ ...triggered[0], isSponsored: true });
  }

  const drinks = menuItems
    .filter((m) => {
      if (m.id === currentItem.id) return false;
      if (!isDrinkItem(m)) return false;
      if (isHotDrink(m) && !isBreakfastOrDessert(currentItem)) return false;
      return true;
    })
    .filter(
      (d) => !results.some((r) => "item_name" in r && r.item_name === d.name),
    )
    .sort(() => Math.random() - 0.5);

  return [...results, ...drinks].slice(0, limit);
}

/** Lädt aktive Sponsored-Rows; leeres `restaurant_ids` = alle Restaurants. */
export async function loadSponsoredItems(restaurantId: string): Promise<SponsoredItem[]> {
  const { data, error } = await supabase
    .from("sponsored_items")
    .select("*")
    .eq("aktiv", true);

  if (error) {
    console.error("loadSponsoredItems", error);
    return [];
  }

  const rows = (data ?? []) as SponsoredItem[];
  return rows.filter((s) => {
    const ids = s.restaurant_ids;
    if (!ids || ids.length === 0) return true;
    return ids.includes(restaurantId);
  });
}
