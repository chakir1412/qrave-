/** Priorität für Kategorie-Reihenfolge (KI-Import / Anzeige). Kleinster Index = zuerst. */
export const CATEGORY_ORDER = [
  "vorspeisen",
  "starters",
  "salate",
  "salads",
  "suppen",
  "soups",
  "hauptgerichte",
  "main",
  "mains",
  "pasta",
  "pizza",
  "burger",
  "fleisch",
  "fisch",
  "vegetarisch",
  "vegan",
  "beilagen",
  "sides",
  "snacks",
  "bites",
  "desserts",
  "dessert",
  "nachtisch",
  "getränke",
  "getraenke",
  "drinks",
  "beverages",
  "cocktails",
  "weine",
  "wines",
  "bier",
  "beer",
  "softdrinks",
  "heißgetränke",
  "heissgetraenke",
  "kaffee",
  "coffee",
] as const;

/** sort_order für DB: Index in CATEGORY_ORDER oder 99. */
export function sortOrderIndexForKategorie(kategorie: string): number {
  const k = kategorie.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  for (let i = 0; i < CATEGORY_ORDER.length; i++) {
    const term = CATEGORY_ORDER[i];
    if (k.includes(term)) return i;
  }
  return 99;
}

export function compareKategorieOrder(a: string, b: string): number {
  const ia = sortOrderIndexForKategorie(a);
  const ib = sortOrderIndexForKategorie(b);
  if (ia !== ib) return ia - ib;
  return a.localeCompare(b, "de");
}
