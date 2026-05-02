"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseOpeningHours } from "@/lib/supabase";
import type { DashboardRestaurant } from "../types";
import { TEMPLATE_CARDS, dash } from "../constants";

const ACCENT_PRESETS = [
  "#00c8a0",
  "#ff5c1a",
  "#5b9bff",
  "#ffd426",
  "#ff4b6e",
  "#a855f7",
  "#e11d48",
  "#0ea5e9",
] as const;

const TEMPLATE_GRADIENT: Record<string, string> = {
  "bar-soleil": "linear-gradient(155deg, #050a08 0%, #0f2218 45%, #00c8a028 100%)",
  "kiosk-no7": "linear-gradient(155deg, #2a2618 0%, #f5e6b8 55%, #ffd42635 100%)",
  "compound-cafe": "linear-gradient(155deg, #120a06 0%, #2a1810 50%, #ff5c1a30 100%)",
  "nami-sushi": "linear-gradient(155deg, #0a0608 0%, #2a1014 50%, #e11d4840 100%)",
  "da-mario": "linear-gradient(155deg, #140c0a 0%, #3a1810 50%, #ff5c1a45 100%)",
  "roots": "linear-gradient(155deg, #06120c 0%, #143220 55%, #34e89e25 100%)",
};

const PLACEHOLDER_COUNT = 4;

/** Öffentliche Demo-URL pro Template (Pfad auf qrave.menu) */
const TEMPLATE_PREVIEW_SLUG: Record<string, string> = {
  "bar-soleil": "bar-soleil",
  "kiosk-no7": "kiosk-no-7",
  "compound-cafe": "compound-cafe",
  "nami-sushi": "nami-sushi",
  "da-mario": "da-mario",
  roots: "roots-plant-kitchen",
};

const PREVIEW_ORIGIN = "https://qrave.menu";

const rowBorder = { borderBottom: "1px solid rgba(255,255,255,0.05)" };
const valueStyle = { color: "rgba(255,255,255,0.4)", fontSize: 14 };
const labelStyle = { fontSize: 15, color: "#ffffff" };

function isRestaurantOpenNow(oh: DashboardRestaurant["opening_hours"]): boolean {
  const parsed = parseOpeningHours(oh ?? null);
  const now = new Date();
  const jsDay = now.getDay();
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  const day = parsed[idx];
  if (!day || day.closed) return false;
  const openParts = day.open.split(":").map((x) => parseInt(x, 10));
  const closeParts = day.close.split(":").map((x) => parseInt(x, 10));
  if (openParts.length < 2 || closeParts.length < 2) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const openM = openParts[0] * 60 + openParts[1];
  const closeM = closeParts[0] * 60 + closeParts[1];
  return cur >= openM && cur <= closeM;
}

function formatAddress(r: DashboardRestaurant): string {
  const parts = [r.adresse, r.stadt].filter((x) => x && String(x).trim());
  return parts.length ? parts.join(", ") : "—";
}

type Props = {
  open: boolean;
  onClose: () => void;
  restaurant: DashboardRestaurant;
  userEmail: string;
  savingTemplate: boolean;
  onTemplateChange: (id: string) => void | Promise<void>;
  onOpenOeffnung: () => void;
  onLogout: () => void;
  colorInput: string;
  onColorPickerChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onHexInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  setColorInput: (v: string) => void;
  logoPreview: string | null;
  onLogoFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  extracting: boolean;
  savingBranding: boolean;
  onSaveBranding: () => void;
  brandingMessage: string | null;
  currentLogoUrl: string | null;
  extractedColor: string | null;
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <div
        className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        {title}
      </div>
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  right,
  onClick,
  showChevron,
  noBorder,
  disabled,
}: {
  label: string;
  right?: ReactNode;
  onClick?: () => void;
  showChevron?: boolean;
  noBorder?: boolean;
  disabled?: boolean;
}) {
  const content = (
    <>
      <span style={labelStyle}>{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        {right != null ? <span className="truncate">{right}</span> : null}
        {showChevron ? (
          <span className="shrink-0 text-lg leading-none" style={{ color: "rgba(255,255,255,0.25)" }}>
            ›
          </span>
        ) : null}
      </div>
    </>
  );

  const baseClass =
    "flex h-[52px] w-full items-center justify-between px-4 text-left transition active:bg-white/[0.04]";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={baseClass}
        style={{
          ...(noBorder ? undefined : rowBorder),
          opacity: disabled ? 0.55 : undefined,
          cursor: disabled ? "not-allowed" : undefined,
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={baseClass} style={noBorder ? undefined : rowBorder}>
      {content}
    </div>
  );
}

export function SettingsOverlay({
  open,
  onClose,
  restaurant,
  userEmail,
  savingTemplate,
  onTemplateChange,
  onOpenOeffnung,
  onLogout,
  colorInput,
  onColorPickerChange,
  onHexInputChange,
  setColorInput,
  logoPreview,
  onLogoFileChange,
  extracting,
  savingBranding,
  onSaveBranding,
  brandingMessage,
  currentLogoUrl,
  extractedColor,
}: Props) {
  const router = useRouter();
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<{ id: string; label: string } | null>(null);
  const [accentExpanded, setAccentExpanded] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const openNow = isRestaurantOpenNow(restaurant.opening_hours);
  const displayLogo = logoPreview ?? currentLogoUrl;

  const handleLogoutClick = useCallback(() => {
    if (typeof window !== "undefined" && window.confirm("Wirklich abmelden?")) {
      void onLogout();
    }
  }, [onLogout]);

  const handleApplyPreviewedTemplate = useCallback(async () => {
    if (!previewTemplate) return;
    await onTemplateChange(previewTemplate.id);
    setPreviewTemplate(null);
    setShowTemplatePicker(false);
  }, [onTemplateChange, previewTemplate]);

  const onPasswort = useCallback(() => {
    router.push("/login");
  }, [router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] overflow-y-auto"
      style={{ backgroundColor: "#080810" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="dashboard-bg-blobs" aria-hidden>
        <div className="dashboard-blob dashboard-blob--1" />
        <div className="dashboard-blob dashboard-blob--2" />
        <div className="dashboard-blob dashboard-blob--3" />
      </div>

      <div className="relative z-[1] mx-auto w-full max-w-[480px] px-4 pb-16 pt-6">
        {showTemplatePicker && previewTemplate ? (
          <div
            className="fixed inset-0 z-[115] flex flex-col"
            style={{ backgroundColor: "#080810" }}
          >
            <header className="flex shrink-0 items-center gap-3 px-4 pb-4 pt-6">
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="min-w-[4.5rem] text-left text-[15px] font-medium"
                style={{ color: "#00c8a0" }}
              >
                ← Zurück
              </button>
              <h2 className="flex-1 truncate text-center text-[17px] font-semibold text-white">
                {previewTemplate.label}
              </h2>
              <span className="min-w-[4.5rem]" />
            </header>
            <div className="min-h-0 flex-1 px-4 pb-[76px]">
              <iframe
                title={previewTemplate.label}
                src={`${PREVIEW_ORIGIN}/${TEMPLATE_PREVIEW_SLUG[previewTemplate.id] ?? previewTemplate.id}`}
                className="w-full rounded-xl border-0 bg-black/20"
                style={{ height: "calc(100vh - 120px)" }}
              />
            </div>
            <div
              className="fixed bottom-0 left-0 right-0 z-[116] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2"
              style={{ background: "linear-gradient(to top, #080810 85%, transparent)" }}
            >
              <button
                type="button"
                onClick={() => void handleApplyPreviewedTemplate()}
                disabled={savingTemplate}
                className="w-full text-[15px] font-semibold text-black disabled:opacity-50"
                style={{
                  background: "#00c8a0",
                  height: 52,
                  borderRadius: 12,
                }}
              >
                {savingTemplate ? "Wird gespeichert …" : "Dieses Template verwenden"}
              </button>
            </div>
          </div>
        ) : null}

        {!showTemplatePicker ? (
          <>
            <header className="mb-6 flex items-center justify-between">
              <h1 id="settings-title" className="text-[20px] font-semibold text-white" style={{ fontWeight: 600 }}>
                Einstellungen
              </h1>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none text-white/70 transition hover:bg-white/10"
                aria-label="Schließen"
              >
                ×
              </button>
            </header>

            {brandingMessage ? (
              <div
                className="mb-4 rounded-2xl border px-3 py-2 text-[13px]"
                style={{
                  borderColor: brandingMessage.startsWith("✓")
                    ? "rgba(52,232,158,0.3)"
                    : "rgba(255,75,110,0.28)",
                  backgroundColor: brandingMessage.startsWith("✓")
                    ? "rgba(52,232,158,0.1)"
                    : "rgba(255,75,110,0.1)",
                  color: brandingMessage.startsWith("✓") ? dash.gr : dash.re,
                }}
              >
                {brandingMessage}
              </div>
            ) : null}

            <Group title="Speisekarte">
              <Row
                label="Template wählen"
                right={<span style={valueStyle}>{savingTemplate ? "…" : "Auswählen"}</span>}
                showChevron
                onClick={() => setShowTemplatePicker(true)}
              />
              <a
                href={`https://qrave.menu/${restaurant.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <Row label="Meine Speisekarte ansehen" right={<span style={valueStyle}>↗</span>} />
              </a>
              <div style={rowBorder}>
                <button
                  type="button"
                  className="flex h-[52px] w-full items-center justify-between px-4 text-left active:bg-white/[0.04]"
                  onClick={() => setAccentExpanded((v) => !v)}
                >
                  <span style={labelStyle}>Akzentfarbe</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-7 w-7 shrink-0 rounded-full border"
                      style={{
                        backgroundColor: colorInput,
                        borderColor: "rgba(255,255,255,0.1)",
                      }}
                    />
                    <span className="text-lg" style={{ color: "rgba(255,255,255,0.25)" }}>
                      ›
                    </span>
                  </div>
                </button>
                {accentExpanded ? (
                  <div className="border-t px-4 pb-4 pt-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {ACCENT_PRESETS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => {
                            setColorInput(hex);
                          }}
                          className="h-9 w-9 rounded-full border-2 transition"
                          style={{
                            backgroundColor: hex,
                            borderColor: colorInput === hex ? "#00c8a0" : "rgba(255,255,255,0.15)",
                          }}
                          aria-label={hex}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={colorInput.length === 7 ? colorInput : "#111111"}
                      onChange={onColorPickerChange}
                      className="mb-3 h-10 w-full max-w-[120px] cursor-pointer rounded-lg border p-1"
                      style={{ borderColor: "rgba(255,255,255,0.1)" }}
                    />
                    <input
                      value={colorInput}
                      onChange={onHexInputChange}
                      className="mb-3 w-full rounded-lg border px-3 py-2 font-mono text-sm text-white outline-none"
                      style={{
                        borderColor: "rgba(255,255,255,0.08)",
                        backgroundColor: "rgba(255,255,255,0.05)",
                      }}
                      placeholder="#00c8a0"
                    />
                    <button
                      type="button"
                      onClick={() => void onSaveBranding()}
                      disabled={savingBranding}
                      className="w-full rounded-xl py-3.5 text-[15px] font-semibold text-black disabled:opacity-50"
                      style={{ background: "#00c8a0" }}
                    >
                      {savingBranding ? "Speichert …" : "Akzentfarbe speichern"}
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="flex h-[52px] items-center justify-between px-4" style={rowBorder}>
                <span style={labelStyle}>Logo</span>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border"
                    style={{
                      borderColor: "rgba(255,255,255,0.08)",
                      backgroundColor: "rgba(255,255,255,0.04)",
                    }}
                  >
                    {displayLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={displayLogo} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-sm opacity-40">🏷</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-[14px] font-medium"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    Ändern
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={onLogoFileChange}
                  />
                </div>
              </div>
              {extracting ? (
                <div className="px-4 py-2 text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Logo wird hochgeladen …
                </div>
              ) : null}
              {extractedColor ? (
                <div className="px-4 py-2 text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Vorschlag aus Logo: <span className="font-mono text-white">{extractedColor}</span>
                </div>
              ) : null}
            </Group>

            <Group title="Restaurant">
              <Row label="Name" right={<span style={valueStyle}>{restaurant.name}</span>} />
              <button
                type="button"
                className="flex h-[52px] w-full items-center justify-between px-4 text-left active:bg-white/[0.04]"
                style={rowBorder}
                onClick={() => {
                  onClose();
                  onOpenOeffnung();
                }}
              >
                <span style={labelStyle}>Öffnungszeiten</span>
                <div className="flex items-center gap-3">
                  <span style={valueStyle}>{openNow ? "Geöffnet" : "Geschlossen"}</span>
                  <span
                    className="relative inline-flex h-[26px] w-[44px] shrink-0 rounded-full transition-colors"
                    style={{ backgroundColor: openNow ? "#00c8a0" : "rgba(255,255,255,0.2)" }}
                    aria-hidden
                  >
                    <span
                      className="absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white shadow-sm"
                      style={{ left: openNow ? 20 : 2 }}
                    />
                  </span>
                </div>
              </button>
              <Row label="Adresse" right={<span style={valueStyle}>{formatAddress(restaurant)}</span>} noBorder />
            </Group>

            <Group title="Account">
              <Row label="E-Mail" right={<span style={valueStyle}>{userEmail || "—"}</span>} />
              <Row label="Passwort ändern" showChevron onClick={onPasswort} />
              <div className="border-t border-white/[0.05] p-3 pt-3">
                <button
                  type="button"
                  onClick={handleLogoutClick}
                  className="w-full rounded-xl py-[14px] text-[14px] font-semibold"
                  style={{
                    background: "rgba(255,75,110,0.1)",
                    border: "1px solid rgba(255,75,110,0.2)",
                    color: "#ff4b6e",
                  }}
                >
                  Abmelden
                </button>
              </div>
            </Group>
          </>
        ) : !previewTemplate ? (
          <div>
            <header className="mb-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowTemplatePicker(false);
                  setPreviewTemplate(null);
                }}
                className="text-[15px] font-medium"
                style={{ color: "#00c8a0" }}
              >
                Zurück
              </button>
              <h2 className="flex-1 text-center text-[18px] font-semibold text-white">Template wählen</h2>
              <span className="w-12" />
            </header>

            <div className="grid grid-cols-2 gap-3">
              {TEMPLATE_CARDS.map((tpl) => {
                const active = restaurant.template === tpl.id;
                const g = TEMPLATE_GRADIENT[tpl.id] ?? "linear-gradient(145deg,#1a1a1a,#0a0a0a)";
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setPreviewTemplate({ id: tpl.id, label: tpl.label })}
                    className="relative overflow-hidden rounded-2xl border-2 p-2 text-left transition active:opacity-90"
                    style={{
                      borderColor: active ? "#00c8a0" : "rgba(255,255,255,0.07)",
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div
                      className="mb-2 aspect-[4/3] w-full rounded-xl"
                      style={{ background: g }}
                    />
                    <div className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {tpl.label}
                    </div>
                    {active ? (
                      <span
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-black"
                        style={{ background: "#00c8a0" }}
                      >
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
                <div
                  key={`soon-${i}`}
                  className="pointer-events-none rounded-2xl border p-2 opacity-45"
                  style={{
                    borderColor: "rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                  aria-hidden
                >
                  <div
                    className="mb-2 aspect-[4/3] w-full rounded-xl"
                    style={{ background: "linear-gradient(145deg,#12121a,#0a0a10)" }}
                  />
                  <div className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Kommt bald
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
