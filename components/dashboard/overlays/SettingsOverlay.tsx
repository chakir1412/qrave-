"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardRestaurant } from "../types";
import { dash } from "../constants";
import {
  OEFFNUNGSZEITEN_WEEKDAY_KEYS,
  type OeffnungszeitenWeekday,
  type OeffnungszeitenWoche,
} from "@/lib/supabase";
import { WEEKDAY_LABELS_SHORT, defaultOeffnungszeiten } from "@/lib/oeffnungszeiten";
import { LOCALE_LABEL, SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/menu-i18n";

const rowBorder = { borderBottom: "1px solid rgba(255,255,255,0.05)" };
const valueStyle = { color: "rgba(255,255,255,0.4)", fontSize: 14 };
const labelStyle = { fontSize: 15, color: "#ffffff" };

type Props = {
  open: boolean;
  onClose: () => void;
  restaurant: DashboardRestaurant;
  userEmail: string;
  onLogout: () => void;
  logoPreview: string | null;
  onLogoFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  extracting: boolean;
  brandingMessage: string | null;
  currentLogoUrl: string | null;
  /** Restaurant-Felder bearbeiten. */
  onPatchRestaurant: (patch: {
    adresse?: string | null;
    telefon?: string | null;
    whatsapp?: string | null;
    instagram?: string | null;
    maps_url?: string | null;
    oeffnungszeiten?: OeffnungszeitenWoche | null;
    active_languages?: string[];
  }) => Promise<void>;
  /** Toast-Helper (für Translate-Button-Feedback). */
  onToast: (msg: string) => void;
  /** Splash-Hintergrund (Foto oder Video). */
  splashMediaUrl: string | null;
  splashMediaType: "image" | "video" | null;
  splashUploading: boolean;
  onSplashMediaFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSplashMediaRemove: () => void;
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

function EditableTextRow({
  label,
  value,
  placeholder,
  onCommit,
  noBorder,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (next: string) => void;
  noBorder?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div
      className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4"
      style={noBorder ? undefined : rowBorder}
    >
      <span style={labelStyle} className="shrink-0">
        {label}
      </span>
      <input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-right text-[14px] outline-none focus:bg-white/[0.04]"
        style={{ color: "#ffffff" }}
      />
    </div>
  );
}

export function SettingsOverlay({
  open,
  onClose,
  restaurant,
  userEmail,
  onLogout,
  logoPreview,
  onLogoFileChange,
  extracting,
  brandingMessage,
  currentLogoUrl,
  onPatchRestaurant,
  onToast,
  splashMediaUrl,
  splashMediaType,
  splashUploading,
  onSplashMediaFileChange,
  onSplashMediaRemove,
}: Props) {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const splashInputRef = useRef<HTMLInputElement>(null);

  const displayLogo = logoPreview ?? currentLogoUrl;

  const handleLogoutClick = useCallback(() => {
    if (typeof window !== "undefined" && window.confirm("Wirklich abmelden?")) {
      void onLogout();
    }
  }, [onLogout]);

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
          <a
            href={`https://qrave.menu/${restaurant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Row label="Meine Speisekarte ansehen" right={<span style={valueStyle}>↗</span>} />
          </a>
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
          <div className="flex h-[52px] items-center justify-between px-4" style={rowBorder}>
            <div className="flex flex-col">
              <span style={labelStyle}>Splash Hintergrund</span>
              <span className="mt-0.5 text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                Foto (JPG/PNG, max 5 MB) oder Video (MP4, max 30 MB)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border"
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                  backgroundColor: "rgba(255,255,255,0.04)",
                }}
              >
                {splashMediaUrl && splashMediaType === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={splashMediaUrl} alt="" className="h-full w-full object-cover" />
                ) : splashMediaUrl && splashMediaType === "video" ? (
                  <span className="text-base">🎬</span>
                ) : (
                  <span className="text-sm opacity-40">🖼</span>
                )}
              </div>
              <button
                type="button"
                className="text-[14px] font-medium"
                style={{ color: "rgba(255,255,255,0.4)" }}
                onClick={() => splashInputRef.current?.click()}
                disabled={splashUploading}
              >
                {splashMediaUrl ? "Ändern" : "Hochladen"}
              </button>
              {splashMediaUrl ? (
                <button
                  type="button"
                  className="text-[14px] font-medium"
                  style={{ color: dash.re }}
                  onClick={onSplashMediaRemove}
                  disabled={splashUploading}
                >
                  Entfernen
                </button>
              ) : null}
              <input
                ref={splashInputRef}
                type="file"
                accept="image/png,image/jpeg,video/mp4"
                className="hidden"
                onChange={onSplashMediaFileChange}
              />
            </div>
          </div>
          {splashUploading ? (
            <div className="px-4 py-2 text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>
              Splash-Hintergrund wird hochgeladen …
            </div>
          ) : null}
        </Group>

        <Group title="Restaurant">
          <Row label="Name" right={<span style={valueStyle}>{restaurant.name}</span>} />
          <EditableTextRow
            label="Adresse"
            value={restaurant.adresse ?? ""}
            placeholder="Straße & Hausnr."
            onCommit={(next) => void onPatchRestaurant({ adresse: next.trim() || null })}
          />
          <EditableTextRow
            label="Telefon"
            value={restaurant.telefon ?? ""}
            placeholder="+49 …"
            onCommit={(next) => void onPatchRestaurant({ telefon: next.trim() || null })}
            noBorder
          />
        </Group>

        <Group title="Kontakt (für Gäste-Splash)">
          <EditableTextRow
            label="WhatsApp"
            value={restaurant.whatsapp ?? ""}
            placeholder="+49 173 8996449"
            onCommit={(next) => void onPatchRestaurant({ whatsapp: next.trim() || null })}
          />
          <EditableTextRow
            label="Instagram"
            value={restaurant.instagram ?? ""}
            placeholder="@username oder URL"
            onCommit={(next) => void onPatchRestaurant({ instagram: next.trim() || null })}
          />
          <EditableTextRow
            label="Google Maps"
            value={restaurant.maps_url ?? ""}
            placeholder="https://maps.google.com/…"
            onCommit={(next) => void onPatchRestaurant({ maps_url: next.trim() || null })}
            noBorder
          />
        </Group>

        <Group title="Öffnungszeiten">
          <OeffnungszeitenInline
            value={restaurant.oeffnungszeiten ?? null}
            onChange={(next) => void onPatchRestaurant({ oeffnungszeiten: next })}
          />
        </Group>

        <Group title="Sprachen">
          <SprachenInline
            restaurantId={restaurant.id}
            value={restaurant.active_languages ?? ["de"]}
            onChange={(next) => void onPatchRestaurant({ active_languages: next })}
            onToast={onToast}
          />
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
      </div>
    </div>
  );
}

function SprachenInline({
  restaurantId,
  value,
  onChange,
  onToast,
}: {
  restaurantId: string;
  value: string[];
  onChange: (next: string[]) => void;
  onToast: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  function toggle(locale: SupportedLocale) {
    if (locale === "de") return; // Deutsch ist immer aktiv.
    const has = value.includes(locale);
    const next = has ? value.filter((l) => l !== locale) : [...value, locale];
    // Reihenfolge stabilisieren: in der SUPPORTED_LOCALES-Reihenfolge.
    const ordered = SUPPORTED_LOCALES.filter((l) => next.includes(l));
    onChange(ordered);
  }

  async function handleTranslate() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/dashboard/translate-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; translatedFields?: number; error?: string }
        | null;
      if (!res.ok || !json?.success) {
        onToast(json?.error ?? "Übersetzung fehlgeschlagen");
        return;
      }
      const n = json.translatedFields ?? 0;
      onToast(n > 0 ? `✓ ${n} Texte übersetzt` : "✓ Alles aktuell");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Übersetzung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  const otherLocales = SUPPORTED_LOCALES.filter((l) => l !== "de");
  const hasOther = otherLocales.some((l) => value.includes(l));

  return (
    <div className="flex flex-col">
      <div className="flex h-[52px] items-center justify-between px-4" style={rowBorder}>
        <span style={labelStyle}>{LOCALE_LABEL.de}</span>
        <span style={{ ...valueStyle, color: "rgba(255,255,255,0.55)" }}>Standard</span>
      </div>
      {otherLocales.map((locale, i) => {
        const active = value.includes(locale);
        const noBorder = i === otherLocales.length - 1;
        return (
          <div
            key={locale}
            className="flex h-[52px] items-center justify-between px-4"
            style={noBorder ? undefined : rowBorder}
          >
            <span style={labelStyle}>{LOCALE_LABEL[locale]}</span>
            <button
              type="button"
              onClick={() => toggle(locale)}
              className="relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors"
              style={{ backgroundColor: active ? dash.or : "rgba(255,255,255,0.12)" }}
              aria-label={active ? `${LOCALE_LABEL[locale]} deaktivieren` : `${LOCALE_LABEL[locale]} aktivieren`}
            >
              <span
                className="absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all"
                style={{ left: active ? "calc(100% - 19px)" : "3px" }}
              />
            </button>
          </div>
        );
      })}
      <div className="border-t border-white/[0.05] p-3 pt-3">
        <button
          type="button"
          onClick={() => void handleTranslate()}
          disabled={busy || !hasOther}
          className="w-full rounded-xl py-[14px] text-[14px] font-semibold transition"
          style={{
            background: hasOther && !busy ? dash.or : "rgba(255,255,255,0.08)",
            color: hasOther && !busy ? "#080810" : "rgba(255,255,255,0.45)",
            cursor: busy || !hasOther ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Übersetzt …" : "Speisekarte übersetzen"}
        </button>
        {!hasOther ? (
          <p
            className="mt-2 text-center text-[12px]"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            Bitte mindestens eine weitere Sprache aktivieren.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function OeffnungszeitenInline({
  value,
  onChange,
}: {
  value: OeffnungszeitenWoche | null;
  onChange: (next: OeffnungszeitenWoche) => void;
}) {
  // Lokaler Draft: erst auf Blur/Toggle wird onChange gefeuert, sonst
  // würde jeder Tastendruck eine DB-Write triggern.
  const [draft, setDraft] = useState<OeffnungszeitenWoche>(() => value ?? defaultOeffnungszeiten());
  const [openId, setOpenId] = useState<OeffnungszeitenWeekday | null>(null);

  useEffect(() => {
    setDraft(value ?? defaultOeffnungszeiten());
  }, [value]);

  function commit(next: OeffnungszeitenWoche) {
    setDraft(next);
    onChange(next);
  }

  function toggleClosed(day: OeffnungszeitenWeekday) {
    const cur = draft[day];
    const next: OeffnungszeitenWoche = {
      ...draft,
      [day]: cur ? null : { open: "11:00", close: "22:00" },
    };
    commit(next);
  }

  function setTime(day: OeffnungszeitenWeekday, field: "open" | "close", val: string) {
    const cur = draft[day] ?? { open: "11:00", close: "22:00" };
    const next: OeffnungszeitenWoche = {
      ...draft,
      [day]: { ...cur, [field]: val },
    };
    setDraft(next);
  }

  function commitTime(day: OeffnungszeitenWeekday) {
    onChange(draft);
    setOpenId(null);
  }

  return (
    <div className="flex flex-col">
      {OEFFNUNGSZEITEN_WEEKDAY_KEYS.map((day, i) => {
        const entry = draft[day];
        const isOpen = Boolean(entry);
        const isExpanded = openId === day;
        const noBorder = i === OEFFNUNGSZEITEN_WEEKDAY_KEYS.length - 1;
        return (
          <div
            key={day}
            className="px-4"
            style={{
              ...(noBorder ? {} : rowBorder),
            }}
          >
            <div className="flex h-[52px] items-center justify-between gap-3">
              <span className="w-10 text-[14px] font-semibold uppercase tracking-wider" style={{ color: "#fff" }}>
                {WEEKDAY_LABELS_SHORT[day]}
              </span>
              {isOpen && entry ? (
                <button
                  type="button"
                  onClick={() => setOpenId(isExpanded ? null : day)}
                  className="flex-1 text-left text-sm"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {entry.open}–{entry.close}
                </button>
              ) : (
                <span className="flex-1 text-sm italic" style={{ color: "rgba(255,255,255,0.35)" }}>
                  geschlossen
                </span>
              )}
              <button
                type="button"
                onClick={() => toggleClosed(day)}
                className="relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors"
                style={{ backgroundColor: isOpen ? dash.or : "rgba(255,255,255,0.12)" }}
                aria-label={isOpen ? `${day} schließen` : `${day} öffnen`}
              >
                <span
                  className="absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all"
                  style={{ left: isOpen ? "calc(100% - 19px)" : "3px" }}
                />
              </button>
            </div>
            {isOpen && isExpanded && entry ? (
              <div className="flex items-center gap-2 pb-3">
                <input
                  type="time"
                  value={entry.open}
                  onChange={(e) => setTime(day, "open", e.target.value)}
                  onBlur={() => commitTime(day)}
                  className="rounded-lg border px-2 py-1 text-sm"
                  style={{
                    borderColor: "rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.3)",
                    color: "#fff",
                  }}
                />
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                  –
                </span>
                <input
                  type="time"
                  value={entry.close}
                  onChange={(e) => setTime(day, "close", e.target.value)}
                  onBlur={() => commitTime(day)}
                  className="rounded-lg border px-2 py-1 text-sm"
                  style={{
                    borderColor: "rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.3)",
                    color: "#fff",
                  }}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
