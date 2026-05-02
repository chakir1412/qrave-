import type { MenuItem } from "@/lib/supabase";
import { compareKategorieOrder } from "@/lib/category-sort-order";
import type { Section } from "./MenuGrid";

/** Interner Key für den Tab „Alle“ (Kollision mit echter Kategorie „Alle“ vermeiden). */
export const CATEGORY_TAB_ALLE_KEY = "__alle__";

export type MainTabDef = { key: string; label: string };

export function categoryTabLabel(key: string): string {
  return key === CATEGORY_TAB_ALLE_KEY ? "Alle" : key;
}

function compareItemsBySortOrder(a: MenuItem, b: MenuItem): number {
  const sa = a.sort_order ?? 99;
  const sb = b.sort_order ?? 99;
  if (sa !== sb) return sa - sb;
  return a.name.localeCompare(b.name, "de");
}

/**
 * Eindeutige Kategorien in der Reihenfolge wie nach DB-Sortierung (sort_order → kategorie → Name).
 */
export function orderedCategoriesFromItems(menuItems: MenuItem[]): string[] {
  const sorted = [...menuItems].sort((a, b) => {
    const sa = a.sort_order ?? 999999;
    const sb = b.sort_order ?? 999999;
    if (sa !== sb) return sa - sb;
    const ca = a.kategorie?.trim() || "Sonstiges";
    const cb = b.kategorie?.trim() || "Sonstiges";
    if (ca !== cb) return ca.localeCompare(cb, "de");
    return a.name.localeCompare(b.name, "de");
  });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of sorted) {
    const c = i.kategorie?.trim() || "Sonstiges";
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

/**
 * Tabs: immer zuerst „Alle“, danach jede vorkommende Kategorie (Reihenfolge wie in der DB).
 * `main_tab` wird nicht verwendet.
 */
export function deriveCategoryTabsFromItems(menuItems: MenuItem[]): MainTabDef[] {
  const cats = orderedCategoriesFromItems(menuItems);
  return [{ key: CATEGORY_TAB_ALLE_KEY, label: "Alle" }, ...cats.map((c) => ({ key: c, label: c }))];
}

/**
 * Sichtbare Sektionen für den gewählten Kategorie-Tab.
 * – „Alle“: alle Items, gruppiert nach `kategorie`
 * – sonst: nur diese Kategorie
 */
export function buildSectionsForCategoryTab(activeKey: string, menuItems: MenuItem[]): Section[] {
  const items =
    activeKey === CATEGORY_TAB_ALLE_KEY
      ? menuItems
      : menuItems.filter((i) => (i.kategorie?.trim() || "Sonstiges") === activeKey);

  const byCat = new Map<string, MenuItem[]>();
  for (const item of items) {
    const cat = item.kategorie?.trim() || "Sonstiges";
    let arr = byCat.get(cat);
    if (!arr) {
      arr = [];
      byCat.set(cat, arr);
    }
    arr.push(item);
  }

  const keys =
    activeKey === CATEGORY_TAB_ALLE_KEY
      ? [...byCat.keys()].sort(compareKategorieOrder)
      : [activeKey].filter((k) => byCat.has(k));

  const sections: Section[] = [];
  for (const k of keys) {
    const raw = byCat.get(k);
    if (!raw?.length) continue;
    const sorted = [...raw].sort(compareItemsBySortOrder);
    sections.push({
      kategorie: k,
      subtitle: sorted[0]?.section_subtitle ?? null,
      items: sorted,
    });
  }
  return sections;
}

/** @deprecated Nur Kompatibilität; nutze `CATEGORY_TAB_ALLE_KEY`. */
export const UNIFIED_MAIN_TAB_KEY = CATEGORY_TAB_ALLE_KEY;
