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

/** "bar-soleil" = Dark Luxury: helle Texte, Kupfer-Akzente */
type FilterBarTheme = "light" | "bar-soleil";

type FilterBarProps = {
  mainTab: string;
  onMainTabChange: (key: string) => void;
  subCategory: string | null;
  onSubCategoryChange: (cat: string | null) => void;
  filter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
  activeAllergenCount: number;
  onAllergenOpen: () => void;
  theme?: FilterBarTheme;
  /** Wenn gesetzt: dynamische Haupt-Tabs (z. B. Standard-Speisekarte). Sonst: hardcodierte [ Speisen | Getränke | Snacks ]. */
  mainTabs?: MainTabItem[];
  /** Wenn gesetzt: dynamische Sub-Kategorien. Sonst: hardcodierte Kategorien je mainTab. */
  subCategories?: string[];
};

const barSoleilFilter = {
  muted: "#8A7E70",
  copper2: "#E8A96E",
  border: "rgba(255,255,255,0.07)",
  border2: "rgba(255,255,255,0.12)",
  bg: "#0F0D0A",
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
  theme = "light",
  mainTabs: mainTabsProp,
  subCategories: subCategoriesProp,
}: FilterBarProps) {
  const dark = theme === "bar-soleil";
  const navBorder = dark ? barSoleilFilter.border : "#e8e4dc";
  const tabActive = dark ? barSoleilFilter.copper2 : "#b8966a";
  const tabInactive = dark ? barSoleilFilter.muted : "#9a948a";
  const subInactiveBg = dark ? "rgba(255,255,255,0.04)" : "white";
  const subInactiveBorder = dark ? barSoleilFilter.border : "#e8e4dc";
  const filterActiveBg = dark ? "rgba(200,137,78,0.08)" : "rgba(184,150,106,0.07)";
  const allergenInactiveBg = dark ? "rgba(255,255,255,0.05)" : "#f5f4f0";

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
      <nav className="flex overflow-x-auto scrollbar-hide border-b -mb-px" style={{ borderColor: navBorder }}>
        {mainTabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onMainTabChange(key)}
            className="flex-shrink-0 flex-1 min-w-0 border-b-2 pb-2.5 pt-2 px-4 text-[0.74rem] font-medium uppercase tracking-wide whitespace-nowrap transition-all"
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
                ? { backgroundColor: dark ? barSoleilFilter.copper2 : "#1a1916", color: "#fafaf8", borderColor: dark ? barSoleilFilter.copper2 : "#1a1916" }
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
                  ? { backgroundColor: dark ? barSoleilFilter.copper2 : "#1a1916", color: "#fafaf8", borderColor: dark ? barSoleilFilter.copper2 : "#1a1916" }
                  : { backgroundColor: subInactiveBg, borderColor: subInactiveBorder, color: tabInactive }
              }
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Filter-Pills + Allergene */}
      <div className="flex items-center gap-1.5 py-2 border-t" style={{ borderColor: dark ? barSoleilFilter.border : "#f0ece5" }}>
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

type AllergenSheetProps = {
  open: boolean;
  onClose: () => void;
  activeAllergens: Set<string>;
  onToggleAllergen: (id: string) => void;
  onApply: () => void;
  onClearAll: () => void;
};

export function AllergenSheet({
  open,
  onClose,
  activeAllergens,
  onToggleAllergen,
  onApply,
  onClearAll,
}: AllergenSheetProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[600] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[480px] bg-white rounded-t-3xl p-5 pb-10 border border-[#e8e4dc] border-b-0 animate-[slideUp_0.28s_ease]" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-[1.45rem] font-normal mb-0.5">Allergene filtern</h3>
        <p className="text-[0.76rem] text-[#9a948a] mb-4 leading-snug">Gerichte mit diesen Zutaten werden ausgeblendet.</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {ALLERGEN_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onToggleAllergen(id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.76rem] font-medium transition-all ${
                activeAllergens.has(id) ? "bg-[rgba(185,58,58,0.08)] border-[#c84030] text-[#c84030] font-semibold" : "bg-[#f5f4f0] border-[#e8e4dc] text-[#1a1916]"
              }`}
            >
              {ALLERGEN_LABELS[id]}
            </button>
          ))}
        </div>
        <button type="button" onClick={onApply} className="w-full py-3 rounded-xl bg-[#b8966a] text-white font-bold text-[0.86rem] mb-2">Anwenden</button>
        <button type="button" onClick={onClearAll} className="w-full py-2 rounded-xl border border-[#e8e4dc] text-[0.76rem] text-[#9a948a]">Alle entfernen</button>
      </div>
    </div>
  );
}
