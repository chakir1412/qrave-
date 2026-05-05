"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  /** Restaurant-Felder bearbeiten (Adresse, Telefon). */
  onPatchRestaurant: (patch: {
    adresse?: string | null;
    telefon?: string | null;
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
