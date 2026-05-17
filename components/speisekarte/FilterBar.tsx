"use client";

import {
  FILTER_KEYS,
  FILTER_LABELS,
  ALLERGEN_IDS,
  ALLERGEN_LABELS,
  type FilterKey,
} from "./constants";

export type MainTabItem = { key: string; label: string };

/** Ebene 1: Haupt-Tabs — immer diese drei, setzen mainTab. */
const MAIN_TABS: MainTabItem[] = [
  { key: "speisen", label: "Speisen" },
  { key: "getraenke", label: "Getränke" },
  { key: "snacks", label: "Snacks" },
];

/** Ebene 2: Sub-Kategorien pro Haupt-Tab (kategorie). */
const SUB_CATEGORIES_BY_MAIN: Record<string, string[]> = {
  speisen: ["Vorspeisen", "Hauptgerichte", "Desserts", "Frühstück"],
  getraenke: ["Cocktails", "Bier", "Wein", "Softdrinks", "Warmgetränke"],
  snacks: ["Snacks & Burger"],
};

type FilterBarProps = {
  mainTab: string;
  onMainTabChange: (key: string) => void;
  subCategory: string | null;
  onSubCategoryChange: (cat: string | null) => void;
  filter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
  activeAllergenCount: number;
  onAllergenOpen: () => void;
  /** Wenn gesetzt: dynamische Haupt-Tabs (z. B. Standard-Speisekarte). Sonst: hardcodierte [ Speisen | Getränke | Snacks ]. */
  mainTabs?: MainTabItem[];
  /** Wenn gesetzt: dynamische Sub-Kategorien. Sonst: hardcodierte Kategorien je mainTab. */
  subCategories?: string[];
};

export default function FilterBar({
  mainTab,
  onMainTabChange,
  subCategory,
  onSubCategoryChange,
  filter,
  onFilterChange,
  activeAllergenCount,
  onAllergenOpen,
  mainTabs: mainTabsProp,
  subCategories: subCategoriesProp,
}: FilterBarProps) {
  const navBorder = "#e8e4dc";
  const tabActive = "#b8966a";
  const tabInactive = "#9a948a";
  const subInactiveBg = "white";
  const subInactiveBorder = "#e8e4dc";
  const filterActiveBg = "rgba(184,150,106,0.07)";
  const allergenInactiveBg = "#f5f4f0";

  const mainTabs = mainTabsProp && mainTabsProp.length > 0 ? mainTabsProp : MAIN_TABS;
  const subCategories =
    subCategoriesProp && subCategoriesProp.length > 0
      ? subCategoriesProp
      : mainTabs.some((t) => t.key === mainTab)
        ? SUB_CATEGORIES_BY_MAIN[mainTab] ?? []
        : [];

  return (
    <>
      {/* Ebene 1: Haupt-Tabs — [ Speisen ] [ Getränke ] [ Snacks ] oder dynamisch aus mainTabs */}
      <nav className="flex overflow-x-auto scrollbar-hide border-b -mb-px gap-1" style={{ borderColor: navBorder }}>
        {mainTabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onMainTabChange(key)}
            className="flex-shrink-0 border-b-2 pb-2.5 pt-2 px-4 text-[0.74rem] font-medium uppercase tracking-wide whitespace-nowrap transition-all"
            style={{
              borderColor: mainTab === key ? tabActive : "transparent",
              color: mainTab === key ? tabActive : tabInactive,
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Ebene 2: Sub-Tabs — nur sichtbar wenn mainTab gesetzt; Kategorien je nach Haupt-Tab */}
      {subCategories.length > 0 && (
        <div className="pt-2 pb-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
          <button
            type="button"
            onClick={() => onSubCategoryChange(null)}
            className="flex-shrink-0 rounded-full border px-3.5 py-1.5 text-[0.71rem]"
            style={
              !subCategory
                ? { backgroundColor: "#1a1916", color: "#fafaf8", borderColor: "#1a1916" }
                : { backgroundColor: subInactiveBg, borderColor: subInactiveBorder, color: tabInactive }
            }
          >
            Alle
          </button>
          {subCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onSubCategoryChange(cat)}
              className="flex-shrink-0 rounded-full border px-3.5 py-1.5 text-[0.71rem]"
              style={
                subCategory === cat
                  ? { backgroundColor: "#1a1916", color: "#fafaf8", borderColor: "#1a1916" }
                  : { backgroundColor: subInactiveBg, borderColor: subInactiveBorder, color: tabInactive }
              }
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Filter-Pills + Allergene */}
      <div className="flex items-center gap-1.5 py-2 border-t" style={{ borderColor: "#f0ece5" }}>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1">
          {FILTER_KEYS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFilterChange(f)}
              className="flex-shrink-0 rounded-full border px-2.5 py-1 text-[0.68rem]"
              style={
                filter === f
                  ? { borderColor: tabActive, color: tabActive, backgroundColor: filterActiveBg }
                  : { borderColor: "transparent", color: tabInactive }
              }
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onAllergenOpen}
          className="flex-shrink-0 flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[0.68rem] font-semibold"
          style={
            activeAllergenCount > 0
              ? { backgroundColor: "rgba(185,58,58,0.08)", borderColor: "#c84030", color: "#c84030" }
              : { borderColor: subInactiveBorder, backgroundColor: allergenInactiveBg, color: tabInactive }
          }
        >
          ⚠️ {activeAllergenCount > 0 ? `Filter (${activeAllergenCount})` : "Allergene"}
        </button>
      </div>
    </>
  );
}

export type AllergenSheetTheme = "light" | "dark" | "playful";

type AllergenSheetThemeTokens = {
  sheetBg: string;
  sheetBorder: string;
  text: string;
  textMuted: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  ctaBg: string;
  ctaText: string;
  hintBg: string;
  hintText: string;
  overlay: string;
};

const ALLERGEN_SHEET_THEMES: Record<AllergenSheetTheme, AllergenSheetThemeTokens> = {
  light: {
    sheetBg: "#ffffff",
    sheetBorder: "#e8e4dc",
    text: "#1a1916",
    textMuted: "#9a948a",
    pillBg: "#f5f4f0",
    pillBorder: "#e8e4dc",
    pillText: "#1a1916",
    activeBg: "rgba(185,58,58,0.08)",
    activeBorder: "#c84030",
    activeText: "#c84030",
    ctaBg: "#b8966a",
    ctaText: "#ffffff",
    hintBg: "#fff7ed",
    hintText: "#9a4d18",
    overlay: "rgba(0,0,0,0.5)",
  },
  dark: {
    sheetBg: "#0d0d0f",
    sheetBorder: "rgba(255,255,255,0.08)",
    text: "#f0eee8",
    textMuted: "rgba(240,238,232,0.5)",
    pillBg: "rgba(255,255,255,0.04)",
    pillBorder: "rgba(255,255,255,0.1)",
    pillText: "rgba(240,238,232,0.85)",
    activeBg: "rgba(232,40,46,0.12)",
    activeBorder: "#e8282e",
    activeText: "#ff6b70",
    ctaBg: "#c9a84c",
    ctaText: "#0d0d0f",
    hintBg: "rgba(255,180,80,0.1)",
    hintText: "#e8c97a",
    overlay: "rgba(0,0,0,0.7)",
  },
  playful: {
    sheetBg: "#ffffff",
    sheetBorder: "rgba(26,10,18,0.12)",
    text: "#1a0a12",
    textMuted: "rgba(26,10,18,0.5)",
    pillBg: "#ffe5f0",
    pillBorder: "rgba(255,61,127,0.2)",
    pillText: "#1a0a12",
    activeBg: "rgba(255,61,127,0.12)",
    activeBorder: "#ff3d7f",
    activeText: "#ff3d7f",
    ctaBg: "#ff3d7f",
    ctaText: "#ffffff",
    hintBg: "rgba(255,184,0,0.15)",
    hintText: "#8a5a00",
    overlay: "rgba(26,10,18,0.5)",
  },
};

type AllergenSheetProps = {
  open: boolean;
  onClose: () => void;
  activeAllergens: Set<string>;
  onToggleAllergen: (id: string) => void;
  onApply: () => void;
  onClearAll: () => void;
  theme?: AllergenSheetTheme;
};

export function AllergenSheet({
  open,
  onClose,
  activeAllergens,
  onToggleAllergen,
  onApply,
  onClearAll,
  theme = "light",
}: AllergenSheetProps) {
  if (!open) return null;
  const t = ALLERGEN_SHEET_THEMES[theme];
  return (
    <div className="fixed inset-0 z-[600] flex items-end justify-center backdrop-blur-sm" style={{ background: t.overlay }} onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-t-3xl p-5 pb-10 animate-[slideUp_0.28s_ease]"
        style={{ background: t.sheetBg, border: `1px solid ${t.sheetBorder}`, borderBottom: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-[1.45rem] font-normal mb-0.5" style={{ color: t.text }}>Allergene filtern</h3>
        <p className="text-[0.76rem] mb-3 leading-snug" style={{ color: t.textMuted }}>Gerichte mit diesen Zutaten werden ausgeblendet.</p>
        <div className="mb-4 flex items-start gap-2 rounded-xl p-3 text-[0.74rem] leading-snug" style={{ background: t.hintBg, color: t.hintText }} role="note">
          <span aria-hidden>⚠️</span>
          <span>Bitte informieren Sie zusätzlich unser Service-Team über Ihre Allergien.</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-5">
          {ALLERGEN_IDS.map((id) => {
            const active = activeAllergens.has(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onToggleAllergen(id)}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.76rem] font-medium transition-all"
                style={{
                  background: active ? t.activeBg : t.pillBg,
                  borderColor: active ? t.activeBorder : t.pillBorder,
                  color: active ? t.activeText : t.pillText,
                  fontWeight: active ? 600 : 500,
                }}
              >
                {ALLERGEN_LABELS[id]}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onApply} className="w-full py-3 rounded-xl font-bold text-[0.86rem] mb-2" style={{ background: t.ctaBg, color: t.ctaText, border: "none" }}>Anwenden</button>
        <button type="button" onClick={onClearAll} className="w-full py-2 rounded-xl text-[0.76rem]" style={{ border: `1px solid ${t.sheetBorder}`, background: "transparent", color: t.textMuted }}>Alle entfernen</button>
      </div>
    </div>
  );
}
