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

/** Kategorien, die NIE als „Oft zusammen bestellt"-Suggestion erscheinen
 *  sollen — egal welches Speisengericht der Gast offen hat. */
const SUGGESTION_BLACKLIST: ReadonlySet<string> = new Set([
  "Spirituosen",
  "Longdrinks",
  "Rum",
  "Whiskey",
  "Aperitif",
  "Shots",
]);

type ItemType = "veg" | "meat" | "fish" | "dessert" | "default";

/** Per Item-Typ erlaubte Drink-Kategorien (case-sensitive Match auf
 *  `menu_items.kategorie`). Items aus Kategorien, die in der Blacklist
 *  stehen, werden zusätzlich global verworfen. */
const SUGGESTION_ALLOW_BY_TYPE: Record<ItemType, ReadonlySet<string>> = {
  veg: new Set(["Softdrinks", "Säfte", "Weine", "Apfelwein"]),
  meat: new Set(["Biere vom Fass", "Flaschenbiere", "Weine", "Softdrinks", "Apfelwein"]),
  fish: new Set(["Weine", "Softdrinks", "Säfte"]),
  dessert: new Set(["Heissgetränke"]),
  default: new Set([
    "Softdrinks",
    "Säfte",
    "Weine",
    "Biere vom Fass",
    "Flaschenbiere",
    "Apfelwein",
    "Heissgetränke",
  ]),
};

function classifyItem(it: MenuItem): ItemType {
  const kat = (it.kategorie ?? "").trim().toLowerCase();
  if (
    kat.includes("dessert") ||
    kat.includes("nachspeise") ||
    kat.includes("kuchen") ||
    kat.includes("eis") ||
    kat.includes("torte")
  ) {
    return "dessert";
  }
  if (kat.includes("fisch") || kat.includes("fish") || kat.includes("seafood")) {
    return "fish";
  }
  const tags = (it.tags ?? []).map((t) => t.trim().toLowerCase());
  if (
    tags.includes("vegan") ||
    tags.includes("vegetarisch") ||
    tags.includes("veg") ||
    kat.includes("vegan") ||
    kat.includes("vegetarisch") ||
    kat === "salate"
  ) {
    return "veg";
  }
  if (
    kat.includes("schnitzel") ||
    kat.includes("burger") ||
    kat.includes("hauptgericht") ||
    kat.includes("steak") ||
    kat.includes("wurst") ||
    kat.includes("braten") ||
    kat.includes("fleisch")
  ) {
    return "meat";
  }
  return "default";
}

export function getDrinkSuggestions(
  menuItems: MenuItem[],
  currentItem: MenuItem,
  sponsoredItems: SponsoredItem[],
  limit = 5,
): (MenuItem | SponsoredSuggestion)[] {
  const results: (MenuItem | SponsoredSuggestion)[] = [];

  const cat = (currentItem.kategorie ?? "").trim().toLowerCase();
  const itemType = classifyItem(currentItem);
  const allowedCats = SUGGESTION_ALLOW_BY_TYPE[itemType];

  const triggered = sponsoredItems.filter((s) => {
    if (!s.aktiv) return false;

    const categoryMatch = (s.trigger_kategorien ?? []).some((t) => {
      const tl = t.trim().toLowerCase();
      return tl === cat || tl === "all";
    });
    if (!categoryMatch) return false;

    // Sponsored-Items aus blacklisteten Kategorien verwerfen — kein
    // Spirituosen-Push neben einem Salat.
    const sCat = (s.kategorie ?? "").trim();
    if (SUGGESTION_BLACKLIST.has(sCat)) return false;

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
      const mCat = (m.kategorie ?? "").trim();
      if (SUGGESTION_BLACKLIST.has(mCat)) return false;
      if (!allowedCats.has(mCat)) return false;
      if (isHotDrink(m) && itemType !== "dessert" && !isBreakfastOrDessert(currentItem)) {
        return false;
      }
      return true;
    })
    .filter(
      (d) => !results.some((r) => "item_name" in r && r.item_name === d.name),
    )
    .sort(() => Math.random() - 0.5);

  return [...results, ...drinks].slice(0, limit);
}

/** Kategorie-basierte „Oft zusammen bestellt"-Logik (substring-match,
 *  case-insensitive). Jeder Eintrag mappt einen *aktuellen* Item-Typ
 *  auf eine Liste passender Companion-Kategorien (substring-Pattern).
 *  Hauptgerichte zeigen Drinks, Drinks zeigen Speisen — fluid in beide
 *  Richtungen. */
const COMPANION_RULES: { test: string[]; companions: string[] }[] = [
  // Speisen → Drinks
  { test: ["suppe"], companions: ["brot", "bier", "wasser"] },
  { test: ["vorspeise"], companions: ["apfelwein", "bier", "softdrink", "wasser"] },
  { test: ["salat"], companions: ["wasser", "softdrink", "wein"] },
  { test: ["burger"], companions: ["bier", "softdrink", "cola"] },
  { test: ["fisch", "fish", "seafood"], companions: ["wein", "wasser", "softdrink"] },
  { test: ["flammkuchen"], companions: ["wein", "bier", "apfelwein"] },
  { test: ["dessert", "nachspeise", "kuchen", "torte", "eis"], companions: ["heissgetränk", "kaffee", "espresso", "tee"] },
  { test: ["beilage"], companions: ["hauptgericht", "schnitzel", "braten", "steak", "wurst"] },
  // Drinks → Speisen
  { test: ["heissgetränk", "kaffee", "espresso", "tee", "kakao"], companions: ["dessert", "nachspeise", "kuchen", "torte", "eis"] },
  { test: ["bier", "wein", "apfelwein", "sekt"], companions: ["hauptgericht", "schnitzel", "vorspeise", "flammkuchen", "burger"] },
  { test: ["softdrink", "saft", "limo"], companions: ["hauptgericht", "schnitzel", "burger", "salat"] },
  // Catch-all für Hauptgerichte (zuletzt, damit "schnitzel" oben für Beilagen-Match nicht zuerst hier landet)
  { test: ["hauptgericht", "schnitzel", "braten", "steak", "wurst", "fleisch", "pasta", "nudel", "pizza"], companions: ["bier", "apfelwein", "softdrink", "wein"] },
];

function matchesAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n));
}

/** Bestimmt die Companion-Pattern für ein aktuelles Item nach den Regeln.
 *  Null, wenn keine Regel greift. */
function companionPatternsFor(item: MenuItem): string[] | null {
  const kat = (item.kategorie ?? "").toLowerCase();
  const name = (item.name ?? "").toLowerCase();
  for (const rule of COMPANION_RULES) {
    if (matchesAny(kat, rule.test) || matchesAny(name, rule.test)) {
      return rule.companions;
    }
  }
  return null;
}

/** Liefert bis zu `limit` Items, die laut COMPANION_RULES gut zum aktuellen
 *  Item passen. Items mit `bild_url` werden bevorzugt; danach randomisiert. */
export function getCompanionSuggestions(
  menuItems: MenuItem[],
  currentItem: MenuItem,
  limit = 3,
): MenuItem[] {
  const patterns = companionPatternsFor(currentItem);
  if (!patterns) return [];

  const candidates = menuItems.filter((m) => {
    if (m.id === currentItem.id) return false;
    if (m.aktiv === false || m.sold_out === true) return false;
    return matchesAny(m.kategorie ?? "", patterns);
  });

  const withImage = candidates.filter((m) => (m.bild_url ?? "").trim().length > 0);
  const withoutImage = candidates.filter((m) => (m.bild_url ?? "").trim().length === 0);

  // Innerhalb der beiden Buckets randomisieren, dann zusammensetzen.
  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return [...shuffle(withImage), ...shuffle(withoutImage)].slice(0, limit);
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
