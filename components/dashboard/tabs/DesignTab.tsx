"use client";

import { useEffect, useState } from "react";
import { dash, dashPrimaryButtonStyle } from "../constants";
import { TemplatePreview, type PreviewTemplateId } from "../templatePreviews";

type TemplateOption = {
  id: PreviewTemplateId;
  label: string;
  description: string;
  colorInfo: string;
};

const TEMPLATE_OPTIONS: ReadonlyArray<TemplateOption> = [
  { id: "heritage", label: "Heritage", description: "Klassisch & warm — ideal für Wirtshäuser", colorInfo: "Beige + Gold · Georgia Serif" },
  { id: "noir", label: "Noir", description: "Elegant & dunkel — ideal für Bars & Lounges", colorInfo: "Schwarz + Gold · Cormorant Garamond" },
  { id: "clean", label: "Clean", description: "Hell & frisch — ideal für Cafés & Bistros", colorInfo: "Beige + Grün · Playfair Display" },
  { id: "trattoria", label: "Trattoria", description: "Rustikal & warm — ideal für Italiener & Pizzerien", colorInfo: "Beige + Rot · Lora Italic" },
  { id: "minimal", label: "Minimal", description: "Schlicht & klar — passt zu fast jedem Restaurant", colorInfo: "Weiß + Schwarz · Inter" },
  { id: "playful", label: "Playful", description: "Verspielt & bold — ideal für Trendbars & Streetfood", colorInfo: "Pink + Magenta · Syne" },
  { id: "asian-dark", label: "Asian Dark", description: "Modern & dunkel — ideal für asiatische Küche", colorInfo: "Schwarz + Rot + Gold · Noto Sans JP" },
  { id: "street-food", label: "Street Food", description: "Kräftig & schnell — ideal für Burger & Fast Casual", colorInfo: "Schwarz + Gelb · Bebas Neue" },
  { id: "mediterranean", label: "Mediterranean", description: "Warm & mediterran — ideal für türkische & arabische Küche", colorInfo: "Beige + Terracotta · Inter" },
];

type Props = {
  slideClass: string;
  template: string | null;
  onTemplateChange: (key: string) => Promise<void>;
  onToast: (msg: string) => void;
};

export function DesignTab({ slideClass, template, onTemplateChange, onToast }: Props) {
  const [preview, setPreview] = useState<TemplateOption | null>(null);
  const [saving, setSaving] = useState(false);

  /** Modal-Open: scroll smooth to top + body lock. Cleanup setzt overflow
   *  zurück, auch wenn Component unmountet während Modal offen ist. */
  useEffect(() => {
    if (!preview) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [preview]);

  async function applyTemplate() {
    if (!preview || saving) return;
    if (preview.id === template) {
      setPreview(null);
      return;
    }
    setSaving(true);
    try {
      await onTemplateChange(preview.id);
      onToast("Template gespeichert");
      setPreview(null);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
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
                <TemplatePreview id={opt.id} width={isSplit ? 60 : 100} />
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
            className="w-full max-w-[720px] overflow-hidden rounded-[18px] border"
            style={{ background: dash.bg, borderColor: dash.bo, maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-stretch sm:p-7" style={{ maxHeight: "calc(90vh - 80px)", overflow: "auto" }}>
              <div
                className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
                style={{ background: "rgba(0,0,0,0.5)", padding: 16, alignSelf: "center" }}
              >
                <TemplatePreview id={preview.id} width={preview.id === "clean" || preview.id === "playful" ? 130 : 240} />
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
                disabled={saving || preview.id === template}
                className="flex-[2] rounded-[10px] py-3 text-[13px] font-bold transition disabled:opacity-60"
                style={{ ...dashPrimaryButtonStyle, borderRadius: 10 }}
              >
                {saving ? "Speichert …" : preview.id === template ? "Aktuell aktiv" : "Design übernehmen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
