"use client";

import { useEffect, useMemo, useState } from "react";
import type { MenuItem } from "@/lib/supabase";
import { dash, dashPrimaryButtonStyle } from "../constants";
import { TemplatePreview, type PreviewTemplateId } from "../templatePreviews";

type TemplateOption = {
  id: PreviewTemplateId;
  label: string;
  description: string;
  colorInfo: string;
  defaultAccent: string;
  swatches: ReadonlyArray<string>;
};

const TEMPLATE_OPTIONS: ReadonlyArray<TemplateOption> = [
  {
    id: "heritage", label: "Heritage", description: "Klassisch & warm — ideal für Wirtshäuser",
    colorInfo: "Beige + Gold · Lora Italic",
    defaultAccent: "#c0580a",
    swatches: ["#c0580a", "#c8894e", "#b86c2a", "#8b5a2b", "#5c3a1c", "#2c1410"],
  },
  {
    id: "noir", label: "Noir", description: "Elegant & dunkel — ideal für Bars & Lounges",
    colorInfo: "Schwarz + Gold · Cormorant Garamond",
    defaultAccent: "#c9a84c",
    swatches: ["#c9a84c", "#e8c97a", "#d4a64a", "#a08440", "#6b5a35", "#f4d97a"],
  },
  {
    id: "clean", label: "Clean", description: "Hell & frisch — ideal für Cafés & Bistros",
    colorInfo: "Beige + Grün · Playfair Display",
    defaultAccent: "#2d6a4f",
    swatches: ["#2d6a4f", "#4a8c6a", "#1a4d36", "#66a583", "#346f53", "#0a3120"],
  },
  {
    id: "trattoria", label: "Trattoria", description: "Rustikal & warm — ideal für Italiener & Pizzerien",
    colorInfo: "Beige + Rot · Lora Italic",
    defaultAccent: "#c0392b",
    swatches: ["#c0392b", "#e74c3c", "#a02817", "#8c1a0b", "#f9c46c", "#5a1308"],
  },
  {
    id: "minimal", label: "Minimal", description: "Schlicht & klar — passt zu fast jedem Restaurant",
    colorInfo: "Weiß + Schwarz · Inter",
    defaultAccent: "#111111",
    swatches: ["#111111", "#2563eb", "#c0392b", "#2d6a4f", "#c0580a", "#6b21a8"],
  },
  {
    id: "playful", label: "Playful", description: "Verspielt & bold — ideal für Trendbars & Streetfood",
    colorInfo: "Pink + Magenta · Syne",
    defaultAccent: "#ff3d7f",
    swatches: ["#ff3d7f", "#ffb800", "#00d9ff", "#c084fc", "#34d399", "#fb7185"],
  },
  {
    id: "asian-dark", label: "Asian Dark", description: "Modern & dunkel — ideal für asiatische Küche",
    colorInfo: "Schwarz + Rot · Noto Sans JP",
    defaultAccent: "#e8282e",
    swatches: ["#e8282e", "#ff6b35", "#c9a84c", "#d4a64a", "#ff4422", "#b91c1c"],
  },
  {
    id: "street-food", label: "Street Food", description: "Kräftig & schnell — ideal für Burger & Fast Casual",
    colorInfo: "Schwarz + Gelb · Bebas Neue",
    defaultAccent: "#e8b400",
    swatches: ["#e8b400", "#ff4422", "#f59e0b", "#fbbf24", "#facc15", "#ffd54f"],
  },
  {
    id: "mediterranean", label: "Mediterranean", description: "Warm & mediterran — ideal für türkische & arabische Küche",
    colorInfo: "Beige + Terracotta · Inter",
    defaultAccent: "#c0580a",
    swatches: ["#c0580a", "#d4613a", "#c9972a", "#5c8a3c", "#8b5a2b", "#2c1a0e"],
  },
];

const MAX_RECOMMENDED_CATEGORIES = 5;

type Props = {
  slideClass: string;
  template: string | null;
  accentColor: string | null;
  menuItems: MenuItem[];
  onTemplateChange: (input: { template: string; accentColor: string }) => Promise<void>;
  onTabChange: (tab: "karte") => void;
  onToast: (msg: string) => void;
};

export function DesignTab({
  slideClass,
  template,
  accentColor,
  menuItems,
  onTemplateChange,
  onTabChange,
  onToast,
}: Props) {
  const [preview, setPreview] = useState<TemplateOption | null>(null);
  const [selectedAccent, setSelectedAccent] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Anzahl distinct-Kategorien aus der aktuellen Speisekarte.
  const categoryCount = useMemo(() => {
    const set = new Set<string>();
    for (const it of menuItems) {
      const k = (it.kategorie ?? "").trim();
      if (k) set.add(k);
    }
    return set.size;
  }, [menuItems]);

  useEffect(() => {
    if (!preview) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [preview]);

  /** Beim Öffnen des Modals: Akzent vorinitialisieren — wenn der User das
   *  aktuell aktive Template anschaut, übernimm dessen aktuellen accent_color,
   *  sonst den Template-Default. */
  useEffect(() => {
    if (!preview) return;
    if (preview.id === template && accentColor) setSelectedAccent(accentColor);
    else setSelectedAccent(preview.defaultAccent);
  }, [preview, template, accentColor]);

  const hasItems = menuItems.length > 0;

  async function applyTemplate() {
    if (!preview || saving) return;
    setSaving(true);
    try {
      // Fallback wenn selectedAccent noch leer ist (race vor useEffect-Init).
      const accentToSave = selectedAccent || preview.defaultAccent;
      await onTemplateChange({ template: preview.id, accentColor: accentToSave });
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
                <TemplatePreview id={opt.id} width={isSplit ? 60 : 100} accentColor={previewAccent} />
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

      {preview ? (
        <div
          className="fixed inset-0 z-[700] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
          onClick={() => !saving && setPreview(null)}
        >
          <div
            className="w-full max-w-[760px] overflow-hidden rounded-[18px] border"
            style={{ background: dash.bg, borderColor: dash.bo, maxHeight: "92vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-stretch sm:p-7" style={{ maxHeight: "calc(92vh - 80px)", overflow: "auto" }}>
              <div
                className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
                style={{ background: "rgba(0,0,0,0.5)", padding: 16, alignSelf: "center" }}
              >
                <TemplatePreview
                  id={preview.id}
                  width={preview.id === "clean" || preview.id === "playful" ? 130 : 240}
                  accentColor={selectedAccent || preview.defaultAccent}
                />
              </div>
              <div className="flex flex-1 flex-col justify-between gap-5">
                <div>
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

                  {/* Color-Picker */}
                  <div className="mt-4">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: dash.mi }}>
                      Akzentfarbe anpassen
                    </div>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="color"
                        value={selectedAccent || preview.defaultAccent}
                        onChange={(e) => setSelectedAccent(e.target.value)}
                        aria-label="Akzentfarbe"
                        style={{
                          width: 36, height: 36, padding: 0, border: `1px solid ${dash.bo}`,
                          borderRadius: 8, background: "transparent", cursor: "pointer",
                        }}
                      />
                      <div className="flex flex-1 flex-wrap gap-1.5">
                        {preview.swatches.map((c) => {
                          const isActive = selectedAccent.toLowerCase() === c.toLowerCase();
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setSelectedAccent(c)}
                              aria-label={`Akzentfarbe ${c}`}
                              style={{
                                width: 28, height: 28, borderRadius: 8, background: c,
                                border: isActive ? `2px solid ${dash.tx}` : `1px solid ${dash.bo}`,
                                boxShadow: isActive ? `0 0 0 2px ${dash.bg}` : "none",
                                cursor: "pointer",
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>

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
                </div>
              </div>
            </div>
            <div className="flex gap-2 border-t p-4 sm:p-5" style={{ borderColor: dash.bo, background: dash.s1 }}>
              <button
                type="button"
                onClick={() => setPreview(null)}
                disabled={saving}
                className="flex-1 rounded-[10px] border px-4 py-3 text-[13px] font-semibold transition disabled:opacity-60"
                style={{ borderColor: dash.bo, color: dash.mi, background: "transparent" }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => void applyTemplate()}
                disabled={saving}
                className="flex-[2] rounded-[10px] py-3 text-[13px] font-bold transition disabled:opacity-60"
                style={{ ...dashPrimaryButtonStyle, borderRadius: 10 }}
              >
                {saving ? "Speichert …" : "Design übernehmen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
