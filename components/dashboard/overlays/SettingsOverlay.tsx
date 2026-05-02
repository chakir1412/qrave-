"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseOpeningHours,
  type OpeningHours,
  type OpeningHoursDay,
} from "@/lib/supabase";
import type { DashboardRestaurant } from "../types";
import { dash } from "../constants";

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
  /** Restaurant-Felder bearbeiten (Adresse, Telefon, Öffnungszeiten). */
  onPatchRestaurant: (patch: {
    adresse?: string | null;
    telefon?: string | null;
    opening_hours?: OpeningHours;
  }) => Promise<void>;
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

function OpeningHoursInline({
  hours,
  onChange,
}: {
  hours: OpeningHours;
  onChange: (next: OpeningHours) => void;
}) {
  function patchRow(i: number, patch: Partial<OpeningHoursDay>) {
    const next = hours.map((row, idx) => (idx === i ? { ...row, ...patch } : row));
    onChange(next);
  }

  return (
    <div className="px-4 py-3" style={rowBorder}>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider" style={{ color: dash.mu }}>
        Öffnungszeiten
      </div>
      <div className="flex flex-col gap-1.5">
        {hours.map((row, i) => (
          <div
            key={row.day}
            className="flex items-center gap-2 rounded-lg border px-2.5 py-2"
            style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}
          >
            <span className="w-7 shrink-0 text-[12px] font-semibold" style={{ color: "#fff" }}>
              {row.day}
            </span>
            <div className="flex flex-1 items-center gap-1.5">
              <input
                type="time"
                value={row.open}
                disabled={row.closed}
                onChange={(e) => patchRow(i, { open: e.target.value })}
                className="w-[78px] rounded-md border px-1 py-1 text-center text-[12px] outline-none disabled:opacity-40"
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderColor: "rgba(255,255,255,0.08)",
                  color: "#fff",
                }}
                aria-label={`Öffnung ${row.day}`}
              />
              <span className="text-[11px]" style={{ color: dash.mu }}>
                –
              </span>
              <input
                type="time"
                value={row.close}
                disabled={row.closed}
                onChange={(e) => patchRow(i, { close: e.target.value })}
                className="w-[78px] rounded-md border px-1 py-1 text-center text-[12px] outline-none disabled:opacity-40"
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderColor: "rgba(255,255,255,0.08)",
                  color: "#fff",
                }}
                aria-label={`Schließung ${row.day}`}
              />
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px]" style={{ color: dash.mu }}>
              <input
                type="checkbox"
                checked={row.closed}
                onChange={(e) => patchRow(i, { closed: e.target.checked })}
                className="h-3.5 w-3.5 cursor-pointer accent-current"
              />
              Heute geschlossen
            </label>
          </div>
        ))}
      </div>
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
}: Props) {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [hours, setHours] = useState<OpeningHours>(() => parseOpeningHours(restaurant.opening_hours));
  const lastSavedHoursRef = useRef<string>(JSON.stringify(parseOpeningHours(restaurant.opening_hours)));

  useEffect(() => {
    if (!open) return;
    const parsed = parseOpeningHours(restaurant.opening_hours);
    setHours(parsed);
    lastSavedHoursRef.current = JSON.stringify(parsed);
  }, [open, restaurant.opening_hours]);

  useEffect(() => {
    if (!open) return;
    const key = JSON.stringify(hours);
    if (key === lastSavedHoursRef.current) return;
    const t = window.setTimeout(() => {
      lastSavedHoursRef.current = key;
      void onPatchRestaurant({ opening_hours: hours });
    }, 500);
    return () => window.clearTimeout(t);
  }, [hours, open, onPatchRestaurant]);

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
        </Group>

        <Group title="Restaurant">
          <Row label="Name" right={<span style={valueStyle}>{restaurant.name}</span>} />
          <OpeningHoursInline hours={hours} onChange={setHours} />
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
