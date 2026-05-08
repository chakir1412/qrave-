/**
 * Mapping `kategorie` → `beverage_subcategory` für `scan_events`.
 *
 * Der Tier-1-Tracker leitet die Subkategorie beim item_detail-Event aus dem
 * Item-Kategorie-String ab; im DB-Aggregat zählt `beverage_subcategory_clicks`
 * dann nach diesem Wert.
 *
 * Mögliche Rückgaben:
 *   - "bier", "wein", "softdrinks", "cocktails", "wasser", "kaffee", "energy"
 *   - "sonstiges_getraenk" — Item liegt im DRINKS-Tab, passt aber zu keinem
 *     der spezifischen Patterns
 *   - `null` — Item ist kein Getränk
 *
 * `mainTab` wird optional übergeben, damit auch unscharfe Kategorien
 * (z. B. "Hausspezialitäten") als "sonstiges_getraenk" klassifiziert werden,
 * sobald sie im Drinks-Tab liegen.
 */
export function mapBeverageSubcategory(
  kategorie: string | null | undefined,
  mainTab?: string | null,
): string | null {
  const cat = (kategorie ?? "").toLowerCase();
  if (/(bier|beer)/.test(cat)) return "bier";
  if (/(wein|wine)/.test(cat)) return "wein";
  if (/cocktail/.test(cat)) return "cocktails";
  if (/(softdrink|limo|cola)/.test(cat)) return "softdrinks";
  if (/(wasser|water)/.test(cat)) return "wasser";
  if (/(kaffee|coffee|espresso)/.test(cat)) return "kaffee";
  if (/energy/.test(cat)) return "energy";

  // Im DRINKS-Tab, aber keine bekannte Subkategorie → "sonstiges_getraenk".
  const tab = (mainTab ?? "").toLowerCase();
  if (tab === "drinks" || tab === "getraenke" || tab === "getränke" || tab === "bar") {
    return "sonstiges_getraenk";
  }

  return null;
}

/** Erlaubte Werte für `scan_events.item_tags`. */
const ALLOWED_ITEM_TAGS = new Set(["vegetarisch", "vegan", "glutenfrei", "alkoholfrei"]);

/** Filtert die `tags`-Liste eines MenuItems auf das erlaubte Subset. */
export function filterTrackingItemTags(tags: string[] | null | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  for (const t of tags) {
    if (typeof t !== "string") continue;
    const norm = t.trim().toLowerCase();
    if (ALLOWED_ITEM_TAGS.has(norm) && !out.includes(norm)) out.push(norm);
  }
  return out;
}
