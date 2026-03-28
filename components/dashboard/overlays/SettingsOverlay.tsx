"use client";

import type { ChangeEvent } from "react";
import type { DashboardRestaurant } from "../types";
import { TEMPLATE_CARDS, dash } from "../constants";

type Props = {
  open: boolean;
  onClose: () => void;
  restaurant: DashboardRestaurant;
  savingTemplate: boolean;
  onTemplateChange: (id: string) => void;
  onOpenOeffnung: () => void;
  onLogout: () => void;
  colorInput: string;
  onColorPickerChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onHexInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  logoPreview: string | null;
  onLogoFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  extracting: boolean;
  savingBranding: boolean;
  onSaveBranding: () => void;
  brandingMessage: string | null;
  currentLogoUrl: string | null;
  currentLogoFilename: string | null;
  extractedColor: string | null;
};

export function SettingsOverlay({
  open,
  onClose,
  restaurant,
  savingTemplate,
  onTemplateChange,
  onOpenOeffnung,
  onLogout,
  colorInput,
  onColorPickerChange,
  onHexInputChange,
  logoPreview,
  onLogoFileChange,
  extracting,
  savingBranding,
  onSaveBranding,
  brandingMessage,
  currentLogoUrl,
  currentLogoFilename,
  extractedColor,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center backdrop-blur-[4px]"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div
        className="relative z-10 max-h-[92vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] border-t px-5 pb-10 pt-4"
        style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 h-1 w-9 rounded-full"
          style={{ backgroundColor: dash.s3 }}
        />
        <h2 id="settings-title" className="mb-4 text-xl font-extrabold tracking-tight">
          Einstellungen
        </h2>

        <div className="mb-6">
          <div
            className="mb-2.5 text-[10px] font-medium uppercase tracking-widest"
            style={{ color: dash.mu }}
          >
            Template
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATE_CARDS.map((tpl) => {
              const active = restaurant.template === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onTemplateChange(tpl.id)}
                  className="aspect-[0.6] overflow-hidden rounded-xl border-2 transition"
                  style={{
                    borderColor: active ? dash.or : "transparent",
                    background: "linear-gradient(135deg,#0a0a0a,#1c1c1c)",
                  }}
                >
                  <div className="flex h-full flex-col p-2">
                    <div className="text-lg">{tpl.icon}</div>
                    <div className="mt-auto space-y-1 px-1">
                      <div
                        className="h-1 rounded-sm"
                        style={{
                          width: "60%",
                          backgroundColor: active ? dash.or : "rgba(255,255,255,0.12)",
                        }}
                      />
                      <div
                        className="h-1 rounded-sm"
                        style={{
                          width: "45%",
                          backgroundColor: "rgba(255,255,255,0.12)",
                        }}
                      />
                    </div>
                    <div
                      className="mt-1 text-center text-[9px] font-semibold tracking-wide"
                      style={{ color: dash.mu }}
                    >
                      {tpl.label}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {savingTemplate && (
            <p className="mt-2 text-[11px]" style={{ color: dash.mu }}>
              Template wird gespeichert …
            </p>
          )}
        </div>

        {brandingMessage && (
          <div
            className="mb-4 rounded-xl border px-3 py-2 text-[12px]"
            style={{
              borderColor: brandingMessage.startsWith("✓")
                ? "rgba(76,175,125,0.3)"
                : "rgba(224,92,92,0.25)",
              backgroundColor: brandingMessage.startsWith("✓")
                ? "rgba(76,175,125,0.08)"
                : "rgba(224,92,92,0.08)",
              color: brandingMessage.startsWith("✓") ? dash.gr : dash.re,
            }}
          >
            {brandingMessage}
          </div>
        )}

        <div className="mb-6">
          <div
            className="mb-2.5 text-[10px] font-medium uppercase tracking-widest"
            style={{ color: dash.mu }}
          >
            Logo &amp; Akzentfarbe
          </div>
          <div
            className="space-y-3 rounded-xl border p-3.5"
            style={{ backgroundColor: dash.s2, borderColor: dash.bo }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold">Logo</span>
              {extracting && (
                <span className="text-[11px]" style={{ color: dash.mu }}>
                  Farbe wird analysiert …
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
                style={{ backgroundColor: dash.s1, borderColor: dash.bo }}
              >
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xl opacity-40">🏷</span>
                )}
              </div>
              <label className="flex-1">
                <span
                  className="inline-flex cursor-pointer items-center justify-center rounded-full border px-3 py-2 text-[12px] font-semibold"
                  style={{ borderColor: dash.bo }}
                >
                  Logo auswählen
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={onLogoFileChange}
                />
              </label>
            </div>
            {extractedColor && (
              <p className="text-[11px]" style={{ color: dash.mu }}>
                Vorschlag aus Logo:{" "}
                <span className="font-mono" style={{ color: dash.tx }}>
                  {extractedColor}
                </span>
              </p>
            )}
            {currentLogoUrl && (
              <p className="truncate text-[10px] font-mono" style={{ color: dash.mu }}>
                {currentLogoFilename ?? "logo"}
              </p>
            )}

            <div className="h-px" style={{ backgroundColor: dash.bo }} />

            <div className="flex items-center gap-3">
              <input
                type="color"
                value={colorInput.length === 7 ? colorInput : "#111111"}
                onChange={onColorPickerChange}
                className="h-10 w-10 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 text-[11px]" style={{ color: dash.mu }}>
                  Hex
                </div>
                <input
                  value={colorInput}
                  onChange={onHexInputChange}
                  className="w-full rounded-lg border px-2 py-1.5 font-mono text-xs outline-none"
                  style={{
                    borderColor: dash.bo,
                    backgroundColor: dash.s1,
                    color: dash.tx,
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={onSaveBranding}
              disabled={savingBranding}
              className="w-full rounded-[13px] py-3.5 text-[15px] font-bold text-white shadow-lg disabled:opacity-60"
              style={{
                background: `linear-gradient(135deg, ${dash.or}, ${dash.or2})`,
                boxShadow: "0 6px 20px rgba(232,80,2,0.3)",
              }}
            >
              {savingBranding ? "Speichert …" : "Logo & Farbe speichern"}
            </button>
          </div>
        </div>

        <div
          className="mb-3 overflow-hidden rounded-xl border"
          style={{ borderColor: dash.bo }}
        >
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenOeffnung();
            }}
            className="flex w-full items-center justify-between border-b px-3.5 py-3.5 text-left text-[14px] font-medium transition active:bg-white/5"
            style={{ borderColor: dash.bo, backgroundColor: dash.s2 }}
          >
            <span className="flex items-center gap-2.5">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg text-sm"
                style={{ backgroundColor: dash.s3 }}
              >
                🕐
              </span>
              <span>Öffnungszeiten</span>
            </span>
            <span style={{ color: dash.mu }}>›</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full rounded-[11px] border py-3 text-[14px] font-bold"
          style={{
            borderColor: "rgba(224,92,92,0.25)",
            color: dash.re,
            backgroundColor: "transparent",
          }}
        >
          Abmelden
        </button>
      </div>
    </div>
  );
}
