import type { MenuItem } from "@/lib/supabase";
import { compareKategorieOrder } from "@/lib/category-sort-order";
import { MAIN_TAB_LABELS } from "./constants";
import type { Section } from "./MenuGrid";

/** Ein Tab „Speisekarte“, wenn kein `main_tab` gesetzt ist. */
export const UNIFIED_MAIN_TAB_KEY = "speisekarte";

export type MainTabDef = { key: string; label: string };

const MAIN_TAB_PRIORITY = ["speisen", "getraenke", "snacks", UNIFIED_MAIN_TAB_KEY] as const;

export function compareMainTabKeys(a: string, b: string): number {
  const ia = (MAIN_TAB_PRIORITY as readonly string[]).indexOf(a);
  const ib = (MAIN_TAB_PRIORITY as readonly string[]).indexOf(b);
  const ra = ia === -1 ? 1000 : ia;
  const rb = ib === -1 ? 1000 : ib;
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b, "de");
}

function labelForMainTab(key: string): string {
  if (key === UNIFIED_MAIN_TAB_KEY) return "Speisekarte";
  return MAIN_TAB_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Dynamische Haupt-Tabs nur für Tabs mit mindestens einem Item.
 * Kein main_tab gesetzt → ein Tab „Speisekarte“ mit allen Items.
 */
export function deriveMainTabsFromItems(menuItems: MenuItem[]): {
  tabs: MainTabDef[];
  unified: boolean;
} {
  let anyMainTab = false;
  let anyEmptyMainTab = false;
  for (const i of menuItems) {
    const m = (i.main_tab ?? "").trim();
    if (m) anyMainTab = true;
    else anyEmptyMainTab = true;
  }

  if (!anyMainTab) {
    return {
      tabs: [{ key: UNIFIED_MAIN_TAB_KEY, label: "Speisekarte" }],
      unified: true,
    };
  }

  const keys = new Set<string>();
  for (const i of menuItems) {
    const m = (i.main_tab ?? "").trim().toLowerCase();
    if (m) keys.add(m);
  }
  if (anyEmptyMainTab) {
    keys.add(UNIFIED_MAIN_TAB_KEY);
  }

  const sorted = [...keys].sort(compareMainTabKeys);
  return {
    tabs: sorted.map((k) => ({ key: k, label: labelForMainTab(k) })),
    unified: false,
  };
}

function compareItemsBySortOrder(a: MenuItem, b: MenuItem): number {
  const sa = a.sort_order ?? 99;
  const sb = b.sort_order ?? 99;
  if (sa !== sb) return sa - sb;
  return a.name.localeCompare(b.name, "de");
}

export function buildSectionsByMainTab(
  menuItems: MenuItem[],
  unified: boolean,
): Map<string, Section[]> {
  const map = new Map<string, Section[]>();
  for (const item of menuItems) {
    const main = unified
      ? UNIFIED_MAIN_TAB_KEY
      : (item.main_tab ?? "").trim().toLowerCase() || UNIFIED_MAIN_TAB_KEY;
    const cat = item.kategorie?.trim() || "Sonstiges";
    let list = map.get(main);
    if (!list) {
      list = [];
      map.set(main, list);
    }
    let sec = list.find((s) => s.kategorie === cat);
    if (!sec) {
      sec = { kategorie: cat, subtitle: item.section_subtitle ?? null, items: [] };
      list.push(sec);
    }
    sec.items.push(item);
  }
  map.forEach((list) => {
    list.sort((a, b) => compareKategorieOrder(a.kategorie, b.kategorie));
    list.forEach((section) => {
      section.items.sort(compareItemsBySortOrder);
    });
  });
  return map;
}
