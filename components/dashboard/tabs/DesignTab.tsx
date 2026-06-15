"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MenuItem } from "@/lib/supabase";
import { dash, dashPrimaryButtonStyle } from "../constants";
import { TemplatePreview, type PreviewTemplateId } from "../templatePreviews";
import { isDarkHex, resolveBackground, suggestAccentColors } from "@/lib/template-background";

type TemplateOption = {
  id: PreviewTemplateId;
  label: string;
  description: string;
  colorInfo: string;
  defaultAccent: string;
};

const TEMPLATE_OPTIONS: ReadonlyArray<TemplateOption> = [
  {
    id: "heritage", label: "Heritage", description: "Klassisch & warm — ideal für Wirtshäuser",
    colorInfo: "Beige + Gold · Lora Italic",
    defaultAccent: "#c0580a",
  },
  {
    id: "noir", label: "Noir", description: "Elegant & dunkel — ideal für Bars & Lounges",
    colorInfo: "Schwarz + Gold · Cormorant Garamond",
    defaultAccent: "#c9a84c",
  },
  {
    id: "clean", label: "Clean", description: "Hell & frisch — ideal für Cafés & Bistros",
    colorInfo: "Beige + Grün · Playfair Display",
    defaultAccent: "#2d6a4f",
  },
  {
    id: "trattoria", label: "Trattoria", description: "Rustikal & warm — ideal für Italiener & Pizzerien",
    colorInfo: "Beige + Rot · Lora Italic",
    defaultAccent: "#c0392b",
  },
  {
    id: "minimal", label: "Minimal", description: "Schlicht & klar — passt zu fast jedem Restaurant",
    colorInfo: "Weiß + Schwarz · Inter",
    defaultAccent: "#111111",
  },
  {
    id: "playful", label: "Playful", description: "Verspielt & bold — ideal für Trendbars & Streetfood",
    colorInfo: "Pink + Magenta · Syne",
    defaultAccent: "#ff3d7f",
  },
  {
    id: "asian-dark", label: "Asian Dark", description: "Modern & dunkel — ideal für asiatische Küche",
    colorInfo: "Schwarz + Rot · Noto Sans JP",
    defaultAccent: "#e8282e",
  },
  {
    id: "street-food", label: "Street Food", description: "Kräftig & schnell — ideal für Burger & Fast Casual",
    colorInfo: "Schwarz + Gelb · Bebas Neue",
    defaultAccent: "#e8b400",
  },
  {
    id: "mediterranean", label: "Mediterranean", description: "Warm & mediterran — ideal für türkische & arabische Küche",
    colorInfo: "Beige + Terracotta · Inter",
    defaultAccent: "#c0580a",
  },
  {
    id: "blossom", label: "Blossom", description: "Hell & verspielt — ideal für Brunch & Cafés",
    colorInfo: "Creme + Coral · Lora Italic & Nunito",
    defaultAccent: "#e8836a",
  },
];

const MAX_RECOMMENDED_CATEGORIES = 5;

/** Default-18-Hintergrund-Farben (3 Reihen × 6): hell, mittel/dunkel, spezial. */
const BG_PALETTE_DEFAULT: ReadonlyArray<string> = [
  "#ffffff", "#faf8f5", "#f5f0e8", "#e8e4dc", "#d4cfc5", "#b8b2a8",
  "#c0580a", "#8b3a3a", "#4a3728", "#1a2332", "#1c3a2a", "#1c1c1e",
  "#c9a07a", "#d4b896", "#5c6b3a", "#2d4a5c", "#3d1a4a", "#0a0805",
];

/** Template-spezifische BG-Palette — Override des Defaults pro Template.
 *  Pro Eintrag 12 Farben in 4 Gruppen à 3 (Blossom: 16 Farben in 4er-Gruppen).
 *  Playful fehlt absichtlich — keine BG-Wahl im UI (eigene fixe CI). */
const BG_PALETTE_PER_TEMPLATE: Partial<Record<string, ReadonlyArray<string>>> = {
  heritage: [
    "#f5ede0", "#f0e8d8", "#ede0cc",
    "#f0e0c8", "#e8d0b0", "#dfc090",
    "#2a2018", "#1c1810", "#0e0c08",
    "#d8d0c8", "#c0b8b0", "#a09890",
  ],
  noir: [
    "#000000", "#0a0a0a", "#111111",
    "#1a1a1a", "#222222", "#2a2a2a",
    "#1a1510", "#100d08", "#0a0805",
    "#1a1500", "#151000", "#0a0800",
  ],
  clean: [
    "#ffffff", "#f8f8f4", "#f2f2ec",
    "#f5f0e8", "#f0ece0", "#ece8d8",
    "#f0f5f0", "#e8f0e8", "#e0ece0",
    "#f5ede0", "#f0e8d8", "#ece0cc",
  ],
  trattoria: [
    "#fdf5e8", "#f8f0e0", "#f2e8d4",
    "#f5e8dc", "#f0ddd0", "#e8d0c0",
    "#2c1810", "#201008", "#140a04",
    "#3a1a10", "#2a1008", "#1a0804",
  ],
  minimal: [
    "#ffffff", "#fafafa", "#f5f5f5",
    "#f0f0f0", "#e8e8e8", "#e0e0e0",
    "#d0d0d0", "#c0c0c0", "#b0b0b0",
    "#1a1a1a", "#111111", "#000000",
  ],
  "asian-dark": [
    "#000000", "#050505", "#0a0a0a",
    "#0d0d0d", "#111111", "#151515",
    "#100808", "#150a0a", "#1a0c0c",
    "#1a0505", "#150404", "#100303",
  ],
  "street-food": [
    "#000000", "#0a0a0a", "#111111",
    "#1a1a1a", "#222222", "#2a2a2a",
    "#1a1500", "#151000", "#0a0800",
    "#1a1a10", "#151510", "#101008",
  ],
  mediterranean: [
    "#fdf5e8", "#f8f0e0", "#f5ece0",
    "#f0e8d8", "#ece0cc", "#e8d8c0",
    "#f5e0d0", "#f0d8c8", "#e8ccb8",
    "#2a1808", "#201005", "#180c04",
  ],
  blossom: [
    "#fdf6f0", "#fff5ee", "#f5f0e8", "#ffffff",
    "#fde8dc", "#f9d4c5", "#fce4f0", "#f5e6f5",
    "#e8f5e8", "#f0f7e0", "#e0f0e8", "#f5f0e0",
    "#fce8f0", "#f8d8e8", "#f5cce0", "#f0c0d8",
  ],
};

function bgPaletteFor(templateId: string | null | undefined): ReadonlyArray<string> {
  if (templateId && BG_PALETTE_PER_TEMPLATE[templateId]) {
    return BG_PALETTE_PER_TEMPLATE[templateId] as ReadonlyArray<string>;
  }
  return BG_PALETTE_DEFAULT;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/** WCAG-Relative-Luminance (sRGB linearisiert). */
function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const L1 = relativeLuminance(a);
  const L2 = relativeLuminance(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

/** Abgeleitete Schriftfarbe für einen gegebenen Hintergrund. */
function deriveTextColor(bgHex: string): string {
  return isDarkHex(bgHex) ? "#f0eee8" : "#1a1a1a";
}

type Props = {
  slideClass: string;
  template: string | null;
  accentColor: string | null;
  backgroundMode: string | null;
  customBgColor: string | null;
  menuItems: MenuItem[];
  onTemplateChange: (input: {
    template: string;
    accentColor: string;
    backgroundMode: null;
    customBgColor: string;
    customTextColor: string;
  }) => Promise<void>;
  onTabChange: (tab: "karte") => void;
  onToast: (msg: string) => void;
};

export function DesignTab({
  slideClass,
  template,
  accentColor,
  backgroundMode,
  customBgColor,
  menuItems,
  onTemplateChange,
  onTabChange,
  onToast,
}: Props) {
  const [preview, setPreview] = useState<TemplateOption | null>(null);
  const [selectedBg, setSelectedBg] = useState<string>("");
  const [selectedAccent, setSelectedAccent] = useState<string>("");
  const selectedAccentRef = useRef<string>("");
  useEffect(() => {
    selectedAccentRef.current = selectedAccent;
  }, [selectedAccent]);
  const [saving, setSaving] = useState(false);

  /** Bg-Click resettet Akzent auf den vorgeschlagenen [3]-Eintrag —
   *  Wenn der Wirt einen anderen Akzent wollte, kann er aus den 4 auswählen. */
  function handleBgChange(newBg: string) {
    setSelectedBg(newBg);
    setSelectedAccent(suggestAccentColors(preview?.id ?? null, newBg)[3]);
  }

  const categoryCount = useMemo(() => {
    const set = new Set<string>();
    for (const it of menuItems) {
      const k = (it.kategorie ?? "").trim();
      if (k) set.add(k);
    }
    return set.size;
  }, [menuItems]);

  /** Beim Öffnen der Vorschau Hintergrund + Akzent initialisieren. */
  useEffect(() => {
    if (!preview) return;
    const isActive = preview.id === template;
    let initialBg: string;
    if (isActive && customBgColor) {
      initialBg = customBgColor;
    } else {
      const base = resolveBackground(preview.id, backgroundMode as never);
      initialBg = /^#[0-9a-f]{6}$/i.test(base.bg) ? base.bg : "#ffffff";
    }
    setSelectedBg(initialBg);
    setSelectedAccent(
      isActive && accentColor ? accentColor : suggestAccentColors(preview.id, initialBg)[3],
    );
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [preview, template, backgroundMode, customBgColor, accentColor]);

  const hasItems = menuItems.length > 0;

  async function applyTemplate() {
    if (!preview || saving) return;
    const bgToSave = selectedBg || "#ffffff";
    // Ref statt State — robust gegen Re-Renders die mitten im Save den Closure
    // überschreiben könnten (z. B. wenn der Parent-State während des await
    // updated wird und der useEffect den State zurücksetzt).
    const accentToSave = selectedAccentRef.current || selectedAccent || suggestAccentColors(preview.id, bgToSave)[3];
    const textToSave = deriveTextColor(bgToSave);
    setSaving(true);
    try {
      await onTemplateChange({
        template: preview.id,
        accentColor: accentToSave,
        backgroundMode: null,
        customBgColor: bgToSave,
        customTextColor: textToSave,
      });
      onToast("Template gespeichert");
      setPreview(null);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  if (!hasItems) {
    return (
      <div className={slideClass}>
        <div className="mb-2 text-[20px] font-extrabold leading-tight">Dein Template</div>
        <div className="mb-5 text-[13px] leading-[1.55]" style={{ color: dash.mi }}>
          Wähle das visuelle Design für deine öffentliche Speisekarte.
        </div>
        <div
          className="rounded-[14px] border p-6"
          style={{ background: dash.s1, borderColor: dash.bo }}
        >
          <div className="text-[16px] font-bold leading-tight" style={{ color: dash.tx }}>
            Noch keine Speisekarte
          </div>
          <p className="mt-2 text-[13px] leading-[1.55]" style={{ color: dash.mi }}>
            Lege zuerst deine Speisekarte an bevor du ein Design wählst.
          </p>
          <button
            type="button"
            onClick={() => onTabChange("karte")}
            className="mt-5 rounded-[10px] px-5 py-3 text-[13px] font-bold transition"
            style={{ ...dashPrimaryButtonStyle, borderRadius: 10 }}
          >
            Zur Speisekarte →
          </button>
        </div>
      </div>
    );
  }

  const tooManyCategories = categoryCount > MAX_RECOMMENDED_CATEGORIES;

  if (preview) {
    const previewBg = selectedBg || "#ffffff";
    const previewText = deriveTextColor(previewBg);
    const accentSuggestions = suggestAccentColors(preview.id, previewBg);
    const bgPalette = bgPaletteFor(preview.id);
    const previewAccent = selectedAccent || accentSuggestions[3];
    const ratio = contrastRatio(previewBg, previewText);
    const goodContrast = ratio >= 3.0;

    return (
      <div className={slideClass}>
        <button
          type="button"
          onClick={() => !saving && setPreview(null)}
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold transition"
          style={{ color: dash.mi }}
        >
          <span aria-hidden>←</span> Zurück zur Auswahl
        </button>

        <div
          className="mb-5 flex items-center justify-center overflow-hidden rounded-[14px]"
          style={{ background: "rgba(0,0,0,0.5)", padding: 16 }}
        >
          <TemplatePreview
            id={preview.id}
            width={preview.id === "clean" || preview.id === "playful" ? 130 : 240}
            accentColor={previewAccent}
            customBgColor={previewBg}
            customTextColor={previewText}
          />
        </div>

        <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: dash.primaryBg }}>
          Template-Vorschau
        </div>
        <h2 className="mt-1 text-[26px] font-extrabold leading-tight" style={{ color: dash.tx }}>
          {preview.label}
        </h2>
        <p className="mt-3 text-[14px] leading-[1.55]" style={{ color: dash.mi }}>
          {preview.description}
        </p>
        <div
          className="mt-4 rounded-[10px] border px-3.5 py-3 text-[12px] leading-[1.55]"
          style={{ borderColor: dash.bo, color: dash.mi, background: dash.s2 }}
        >
          <span className="block text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: dash.primaryBg }}>
            Stil
          </span>
          <span className="mt-1 block" style={{ color: dash.tx }}>{preview.colorInfo}</span>
        </div>

        {/* Playful hat eine feste CI — Farbwahl ausblenden. */}
        {preview.id !== "playful" ? (
          <>
            {/* Hintergrund-Palette — Schrift wird automatisch abgeleitet */}
            <ColorPalette
              label="Hintergrundfarbe"
              colors={bgPalette}
              selected={selectedBg}
              onSelect={handleBgChange}
            />

            {/* Akzentfarbe — 4 zur Bg-Farbe passende Vorschläge */}
            <ColorPalette
              label="Akzentfarbe"
              colors={accentSuggestions}
              selected={selectedAccent}
              onSelect={setSelectedAccent}
            />

            {/* WCAG-Kontrast-Hinweis */}
            <div
              className="mt-3 rounded-[10px] border px-3.5 py-2.5 text-[12px] leading-[1.5]"
              style={{
                background: goodContrast ? "rgba(34,197,94,0.08)" : "rgba(250,204,21,0.08)",
                borderColor: goodContrast ? "rgba(34,197,94,0.3)" : "rgba(250,204,21,0.35)",
                color: goodContrast ? "#86efac" : "#fde68a",
              }}
            >
              {goodContrast
                ? `✓ Gute Lesbarkeit (Kontrast ${ratio.toFixed(1)}:1)`
                : `⚠ Diese Farbkombination ist schwer lesbar (Kontrast ${ratio.toFixed(1)}:1)`}
            </div>
          </>
        ) : null}

        {/* Kategorien-Warnung — nur für Templates mit Splash (Clean/Playful) */}
        {tooManyCategories && (preview.id === "clean" || preview.id === "playful") ? (
          <div
            className="mt-4 flex items-start gap-2 rounded-[10px] border px-3.5 py-3 text-[12px] leading-[1.55]"
            style={{
              background: "rgba(250,204,21,0.08)",
              borderColor: "rgba(250,204,21,0.35)",
              color: "#fde68a",
            }}
            role="note"
          >
            <span aria-hidden>⚠️</span>
            <span>
              Deine Speisekarte hat {categoryCount} Kategorien. Für beste Darstellung empfehlen wir max. {MAX_RECOMMENDED_CATEGORIES}.
            </span>
          </div>
        ) : null}

        {preview.id === template ? (
          <div
            className="mt-4 inline-block rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em]"
            style={{ backgroundColor: "rgba(147,51,234,0.15)", color: dash.primaryBg }}
          >
            Bereits aktiv
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void applyTemplate()}
          disabled={saving}
          className="mt-6 w-full rounded-[10px] py-3.5 text-[14px] font-bold transition disabled:opacity-60"
          style={{ ...dashPrimaryButtonStyle, borderRadius: 10 }}
        >
          {saving ? "Speichert …" : "Design übernehmen"}
        </button>
      </div>
    );
  }

  return (
    <div className={slideClass}>
      <div className="mb-2 text-[20px] font-extrabold leading-tight">Dein Template</div>
      <div className="mb-5 text-[13px] leading-[1.55]" style={{ color: dash.mi }}>
        Wähle das visuelle Design für deine öffentliche Speisekarte. Klick auf eine Karte zeigt eine Vorschau — Aktivierung erst nach Bestätigung.
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TEMPLATE_OPTIONS.map((opt) => {
          const active = template === opt.id;
          const previewAccent = active && accentColor ? accentColor : opt.defaultAccent;
          const gridCustomBg = active && customBgColor ? customBgColor : null;
          const gridCustomText = gridCustomBg ? deriveTextColor(gridCustomBg) : null;
          const isSplit = opt.id === "clean" || opt.id === "playful";
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPreview(opt)}
              className="relative rounded-[14px] border p-3 text-left transition active:scale-[0.99]"
              style={{
                backgroundColor: active ? "rgba(147,51,234,0.08)" : dash.s1,
                borderColor: active ? dash.primaryBg : dash.bo,
                borderWidth: active ? 1.5 : 1,
              }}
            >
              <div
                className="mb-2.5 flex items-center justify-center overflow-hidden rounded-[10px]"
                style={{ background: "rgba(0,0,0,0.4)", padding: 6, minHeight: isSplit ? 110 : 178 }}
              >
                <TemplatePreview
                  id={opt.id}
                  width={isSplit ? 60 : 100}
                  accentColor={previewAccent}
                  customBgColor={gridCustomBg}
                  customTextColor={gridCustomText}
                />
              </div>

              <div className="flex items-start justify-between gap-2">
                <div className="text-[14px] font-bold leading-tight" style={{ color: active ? dash.primaryBg : dash.tx }}>
                  {opt.label}
                </div>
                {active ? (
                  <span
                    aria-hidden
                    className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full"
                    style={{ backgroundColor: dash.primaryBg, color: dash.primaryFg }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l4 4L19 7" />
                    </svg>
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-[11.5px] leading-[1.45]" style={{ color: dash.mi }}>
                {opt.description}
              </div>
              {active ? (
                <div
                  className="mt-2 inline-block rounded-full px-2 py-[2px] text-[9.5px] font-bold uppercase tracking-[0.08em]"
                  style={{ backgroundColor: "rgba(147,51,234,0.15)", color: dash.primaryBg }}
                >
                  Aktiv
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 6×3 Grid mit Kreisen; aktive Farbe bekommt Ring abhängig von der
 *  Farb-Helligkeit (dunkler Ring auf hellen Farben, weiß auf dunklen). */
function ColorPalette({
  label,
  colors,
  selected,
  onSelect,
}: {
  label: string;
  colors: ReadonlyArray<string>;
  selected: string;
  onSelect: (c: string) => void;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: dash.mi }}>
        {label}
      </div>
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(6, 36px)", gap: 8, justifyContent: "space-between" }}
      >
        {colors.map((c) => {
          const isActive = selected.toLowerCase() === c.toLowerCase();
          const ringColor = isDarkHex(c) ? "#ffffff" : "#1a1a1a";
          return (
            <button
              key={c}
              type="button"
              onClick={() => onSelect(c)}
              aria-label={`${label} ${c}`}
              aria-pressed={isActive}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: c,
                border: "none",
                outline: isActive ? `2px solid ${ringColor}` : "none",
                outlineOffset: isActive ? 2 : 0,
                cursor: "pointer",
                padding: 0,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
