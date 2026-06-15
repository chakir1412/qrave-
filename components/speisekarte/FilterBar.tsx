"use client";

import type { MenuItem } from "@/lib/supabase";
import { t } from "@/lib/i18n-menu";

export type AllergenSheetTheme = "light" | "dark" | "playful";

type AllergenSheetThemeTokens = {
  sheetBg: string;
  sheetBorder: string;
  text: string;
  textMuted: string;
  rowBg: string;
  rowBorder: string;
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
    rowBg: "#f5f4f0",
    rowBorder: "#e8e4dc",
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
    rowBg: "rgba(255,255,255,0.04)",
    rowBorder: "rgba(255,255,255,0.1)",
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
    rowBg: "#ffe5f0",
    rowBorder: "rgba(255,61,127,0.2)",
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
  menuItems: MenuItem[];
  theme?: AllergenSheetTheme;
  /** UI-Sprache (von der Speisekarte). Default `"de"`. */
  locale?: string;
};

/** Passives Info-Sheet: zeigt die im Restaurant vorkommenden Allergen-/
 *  Zutaten-Hinweise (`allergens_text`) als deduppliziertes Listing.
 *  Filter-Mechanik wurde entfernt, da die DB-Spalte `allergen_ids` nie
 *  befüllt wurde. `allergens_text` ist die einzige funktionierende Quelle
 *  und wird zusätzlich im Item-Detail-Modal pro Gericht angezeigt. */
export function AllergenSheet({
  open,
  onClose,
  menuItems,
  theme = "light",
  locale = "de",
}: AllergenSheetProps) {
  if (!open) return null;
  const tokens = ALLERGEN_SHEET_THEMES[theme];

  // Unique allergen-Texte sammeln (Trim + LowerCase als Dedupe-Key, Original
  // für die Anzeige). Items ohne `allergens_text` werden übersprungen.
  const seen = new Set<string>();
  const allergenLines: string[] = [];
  for (const item of menuItems) {
    const raw = (item.allergens_text ?? "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    allergenLines.push(raw);
  }

  return (
    <div
      className="fixed inset-0 z-[600] flex items-end justify-center backdrop-blur-sm"
      style={{ background: tokens.overlay }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-t-3xl p-5 pb-10 animate-[slideUp_0.28s_ease] max-h-[80vh] overflow-y-auto"
        style={{ background: tokens.sheetBg, border: `1px solid ${tokens.sheetBorder}`, borderBottom: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-[1.45rem] font-normal mb-0.5" style={{ color: tokens.text }}>
          {t("allergens_and_ingredients", locale)}
        </h3>
        <p className="text-[0.76rem] mb-3 leading-snug" style={{ color: tokens.textMuted }}>
          {t("allergens_info", locale)}
        </p>
        <div
          className="mb-4 flex items-start gap-2 rounded-xl p-3 text-[0.74rem] leading-snug"
          style={{ background: tokens.hintBg, color: tokens.hintText }}
          role="note"
        >
          <span aria-hidden>⚠️</span>
          <span>{t("allergens_service", locale)}</span>
        </div>

        {allergenLines.length > 0 ? (
          <ul className="mb-5 flex flex-col gap-1.5">
            {allergenLines.map((line) => (
              <li
                key={line}
                className="rounded-xl border px-3 py-2 text-[0.78rem] leading-snug"
                style={{ background: tokens.rowBg, borderColor: tokens.rowBorder, color: tokens.text }}
              >
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-5 text-[0.78rem] italic" style={{ color: tokens.textMuted }}>
            Für dieses Restaurant sind aktuell keine schriftlichen
            Allergen-Hinweise hinterlegt.
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl font-bold text-[0.86rem]"
          style={{ background: tokens.ctaBg, color: tokens.ctaText, border: "none" }}
        >
          Schließen
        </button>
      </div>
    </div>
  );
}
