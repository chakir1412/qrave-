"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardRestaurant } from "../types";
import { dash } from "../constants";
import {
  supabase,
  OEFFNUNGSZEITEN_WEEKDAY_KEYS,
  type OeffnungszeitenWeekday,
  type OeffnungszeitenWoche,
} from "@/lib/supabase";
import { WEEKDAY_LABELS_SHORT, defaultOeffnungszeiten } from "@/lib/oeffnungszeiten";
import { LOCALE_LABEL, SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/menu-i18n";
import { authFetch } from "@/lib/auth-fetch";

type SectionKey = "speisekarte" | "restaurant" | "kontakt" | "oeffnungszeiten" | "sprachen" | "account";

const SECTIONS: { key: SectionKey; label: string; icon: string }[] = [
  { key: "speisekarte", label: "Speisekarte", icon: "fa-solid fa-utensils" },
  { key: "restaurant", label: "Restaurant", icon: "fa-solid fa-building" },
  { key: "kontakt", label: "Kontakt", icon: "fa-solid fa-phone" },
  { key: "oeffnungszeiten", label: "Öffnungszeiten", icon: "fa-solid fa-clock" },
  { key: "sprachen", label: "Sprachen", icon: "fa-solid fa-language" },
  { key: "account", label: "Account", icon: "fa-solid fa-user" },
];

const rowBorder = { borderBottom: "1px solid rgba(255,255,255,0.05)" };
const labelStyle = { fontSize: 14, color: "#f2f2f2" };
const valueStyle = { color: "rgba(242,242,242,0.5)", fontSize: 13 };

type Props = {
  restaurant: DashboardRestaurant;
  userEmail: string;
  onLogout: () => void;
  logoPreview: string | null;
  onLogoFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  extracting: boolean;
  brandingMessage: string | null;
  currentLogoUrl: string | null;
  onPatchRestaurant: (patch: {
    adresse?: string | null;
    telefon?: string | null;
    whatsapp?: string | null;
    instagram?: string | null;
    maps_url?: string | null;
    oeffnungszeiten?: OeffnungszeitenWoche | null;
    active_languages?: string[];
    wifi_name?: string | null;
    wifi_password?: string | null;
    kitchen_closes_at?: string | null;
  }) => Promise<void>;
  onToast: (msg: string) => void;
  splashMediaUrl: string | null;
  splashMediaType: "image" | "video" | null;
  splashUploading: boolean;
  onSplashMediaFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSplashMediaRemove: () => void;
};

export function SettingsContent(props: Props) {
  const [section, setSection] = useState<SectionKey>("speisekarte");

  return (
    <div className="space-y-4">
      {/* Mobile: horizontale Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 md:hidden">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSection(s.key)}
            className="whitespace-nowrap rounded-[8px] border px-3 py-1.5 text-[12px] font-semibold transition"
            style={
              section === s.key
                ? {
                    borderColor: "color-mix(in srgb, var(--qrave-accent) 40%, transparent)",
                    background: "color-mix(in srgb, var(--qrave-accent) 20%, transparent)",
                    color: "var(--qrave-accent-soft)",
                  }
                : {
                    borderColor: "rgba(255,255,255,0.08)",
                    background: "transparent",
                    color: "rgba(242,242,242,0.6)",
                  }
            }
          >
            <i className={`${s.icon} mr-1.5 text-[11px]`} />
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
        {/* Desktop: linke Spalte mit Bereich-Liste */}
        <aside className="hidden md:block">
          <div
            className="overflow-hidden rounded-[14px] border p-2"
            style={{ background: "var(--qrave-dash-surface)", borderColor: "var(--qrave-dash-border)" }}
          >
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                className={`qrave-nav-item${section === s.key ? " active" : ""}`}
              >
                <span className="qrave-nav-icon">
                  <i className={s.icon} />
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Inhalt */}
        <div>
          {props.brandingMessage ? (
            <div
              className="mb-4 rounded-[12px] border px-3 py-2 text-[13px]"
              style={{
                borderColor: props.brandingMessage.startsWith("✓")
                  ? "rgba(74,222,128,0.3)"
                  : "rgba(248,113,113,0.3)",
                background: props.brandingMessage.startsWith("✓")
                  ? "rgba(74,222,128,0.1)"
                  : "rgba(248,113,113,0.1)",
                color: props.brandingMessage.startsWith("✓") ? dash.gr : dash.re,
              }}
            >
              {props.brandingMessage}
            </div>
          ) : null}

          {section === "speisekarte" && <SpeisekarteSection {...props} />}
          {section === "restaurant" && <RestaurantSection {...props} />}
          {section === "kontakt" && <KontaktSection {...props} />}
          {section === "oeffnungszeiten" && <OeffnungszeitenSection {...props} />}
          {section === "sprachen" && <SprachenSection {...props} />}
          {section === "account" && <AccountSection {...props} />}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-[14px] border"
      style={{ background: "var(--qrave-dash-surface)", borderColor: "var(--qrave-dash-border)" }}
    >
      <div
        className="qrave-font-display border-b px-5 py-4 text-[15px] font-bold"
        style={{ borderColor: "var(--qrave-dash-border)" }}
      >
        {title}
      </div>
      <div>{children}</div>
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
        className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-right text-[13px] outline-none focus:bg-white/[0.04]"
        style={{ color: "#f2f2f2" }}
      />
    </div>
  );
}

function SpeisekarteSection({
  restaurant,
  logoPreview,
  currentLogoUrl,
  extracting,
  onLogoFileChange,
  splashMediaUrl,
  splashMediaType,
  splashUploading,
  onSplashMediaFileChange,
  onSplashMediaRemove,
}: Props) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const splashInputRef = useRef<HTMLInputElement>(null);
  const displayLogo = logoPreview ?? currentLogoUrl;

  return (
    <SectionCard title="Speisekarte">
      <a
        href={`https://qrave.menu/${restaurant.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-[52px] items-center justify-between px-4"
        style={{ ...rowBorder, textDecoration: "none", color: "inherit" }}
      >
        <span style={labelStyle}>Meine Speisekarte ansehen</span>
        <span style={valueStyle}>
          <i className="fa-solid fa-arrow-up-right-from-square" />
        </span>
      </a>

      <div className="flex h-[60px] items-center justify-between px-4" style={rowBorder}>
        <span style={labelStyle}>Logo</span>
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
          >
            {displayLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayLogo} alt="" className="h-full w-full object-contain" />
            ) : (
              <i className="fa-solid fa-image text-[14px] text-white/40" />
            )}
          </div>
          <button
            type="button"
            className="text-[13px] font-semibold"
            style={{ color: "var(--qrave-accent-soft)" }}
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
        <div className="px-4 py-2 text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
          Logo wird hochgeladen …
        </div>
      ) : null}

      <div className="flex min-h-[60px] items-center justify-between px-4 py-3" style={rowBorder}>
        <div>
          <div style={labelStyle}>Splash Hintergrund</div>
          <div className="mt-0.5 text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
            Foto (JPG/PNG, max 5 MB) oder Video (MP4, max 30 MB)
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
          >
            {splashMediaUrl && splashMediaType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={splashMediaUrl} alt="" className="h-full w-full object-cover" />
            ) : splashMediaUrl && splashMediaType === "video" ? (
              <i className="fa-solid fa-film text-[14px] text-white/60" />
            ) : (
              <i className="fa-solid fa-image text-[14px] text-white/40" />
            )}
          </div>
          <button
            type="button"
            className="text-[13px] font-semibold"
            style={{ color: "var(--qrave-accent-soft)" }}
            onClick={() => splashInputRef.current?.click()}
            disabled={splashUploading}
          >
            {splashMediaUrl ? "Ändern" : "Hochladen"}
          </button>
          {splashMediaUrl ? (
            <button
              type="button"
              className="text-[13px] font-semibold"
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
        <div className="px-4 py-2 text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
          Splash-Hintergrund wird hochgeladen …
        </div>
      ) : null}
    </SectionCard>
  );
}

function RestaurantSection({ restaurant, onPatchRestaurant }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <SectionCard title="Restaurant">
        <div className="flex h-[52px] items-center justify-between px-4" style={rowBorder}>
          <span style={labelStyle}>Name</span>
          <span style={valueStyle}>{restaurant.name}</span>
        </div>
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
      </SectionCard>

      <SectionCard title="WLAN (optional)">
        <EditableTextRow
          label="WLAN-Name"
          value={restaurant.wifi_name ?? ""}
          placeholder="z. B. Wirtshaus-Gast"
          onCommit={(next) => void onPatchRestaurant({ wifi_name: next.trim() || null })}
        />
        <PasswordRow
          label="Passwort"
          value={restaurant.wifi_password ?? ""}
          placeholder="Optional"
          onCommit={(next) => void onPatchRestaurant({ wifi_password: next.trim() || null })}
          noBorder
        />
      </SectionCard>
    </div>
  );
}

function PasswordRow({
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
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div
      className="flex min-h-[52px] w-full items-center justify-between gap-2 px-4"
      style={noBorder ? undefined : rowBorder}
    >
      <span style={labelStyle} className="shrink-0">
        {label}
      </span>
      <input
        type={visible ? "text" : "password"}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-right text-[13px] outline-none focus:bg-white/[0.04]"
        style={{ color: "#f2f2f2" }}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="shrink-0 rounded-md px-2 py-1 text-[12px] transition-colors hover:bg-white/[0.04]"
        style={{ color: "rgba(242,242,242,0.6)" }}
        aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
      >
        {visible ? "Verbergen" : "Anzeigen"}
      </button>
    </div>
  );
}

function KontaktSection({ restaurant, onPatchRestaurant }: Props) {
  return (
    <SectionCard title="Kontakt (für Gäste-Splash)">
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
    </SectionCard>
  );
}

function OeffnungszeitenSection({ restaurant, onPatchRestaurant }: Props) {
  return (
    <div className="space-y-4">
      <HeuteOverrideCard
        value={restaurant.oeffnungszeiten ?? null}
        onChange={(next) => void onPatchRestaurant({ oeffnungszeiten: next })}
      />
      <SectionCard title="Wochenplan">
        <OeffnungszeitenInline
          value={restaurant.oeffnungszeiten ?? null}
          onChange={(next) => void onPatchRestaurant({ oeffnungszeiten: next })}
        />
      </SectionCard>
      <SectionCard title="Küche schließt um (optional)">
        <KitchenCloseRow
          value={restaurant.kitchen_closes_at ?? null}
          onCommit={(next) =>
            void onPatchRestaurant({ kitchen_closes_at: next })
          }
        />
      </SectionCard>
    </div>
  );
}

function KitchenCloseRow({
  value,
  onCommit,
}: {
  value: string | null;
  onCommit: (next: string | null) => void;
}) {
  // DB liefert time als "HH:MM:SS" — Time-Input erwartet "HH:MM".
  const displayValue = value ? value.slice(0, 5) : "";
  const [draft, setDraft] = useState(displayValue);
  useEffect(() => {
    setDraft(displayValue);
  }, [displayValue]);

  return (
    <div className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4">
      <span style={labelStyle} className="shrink-0">
        Küche bis
      </span>
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft === displayValue) return;
            // Leer = unsetzen; sonst "HH:MM:00"
            const next = draft.trim().length === 0 ? null : `${draft}:00`;
            onCommit(next);
          }}
          className="rounded-md bg-transparent px-2 py-1 text-right text-[13px] outline-none focus:bg-white/[0.04]"
          style={{ color: "#f2f2f2", colorScheme: "dark" }}
        />
        {draft.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              onCommit(null);
            }}
            className="rounded-md px-2 py-1 text-[12px] transition-colors hover:bg-white/[0.04]"
            style={{ color: "rgba(242,242,242,0.5)" }}
            aria-label="Küchenzeit löschen"
          >
            Löschen
          </button>
        ) : null}
      </div>
    </div>
  );
}

function berlinTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function HeuteOverrideCard({
  value,
  onChange,
}: {
  value: OeffnungszeitenWoche | null;
  onChange: (next: OeffnungszeitenWoche) => void;
}) {
  const today = berlinTodayIso();
  const override = value?.heute_override && value.heute_override.date === today ? value.heute_override : null;
  const isClosed = override && "closed" in override && override.closed === true;
  const overrideOpen = override && "open" in override ? override.open : "11:00";
  const overrideClose = override && "close" in override ? override.close : "22:00";
  const overrideGrund = override?.grund ?? "";
  const [grundDraft, setGrundDraft] = useState<string>(overrideGrund);
  useEffect(() => {
    setGrundDraft(overrideGrund);
  }, [overrideGrund]);

  function commit(next: OeffnungszeitenWoche["heute_override"] | null) {
    const base = value ?? {};
    onChange({ ...base, heute_override: next ?? null });
  }

  function updateGrund(nextGrund: string) {
    if (!override) return; // ohne aktives Override macht ein Grund keinen Sinn
    const trimmed = nextGrund.trim();
    if ("closed" in override && override.closed === true) {
      commit({ date: today, closed: true, ...(trimmed ? { grund: trimmed } : {}) });
    } else if ("open" in override && "close" in override) {
      commit({
        date: today,
        open: override.open,
        close: override.close,
        ...(trimmed ? { grund: trimmed } : {}),
      });
    }
  }

  return (
    <SectionCard title="Heute (einmalig)">
      <div className="px-5 py-4">
        <p className="mb-3 text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
          Setze für heute abweichende Zeiten oder markiere das Restaurant als geschlossen. Wird um Mitternacht automatisch zurückgesetzt.
        </p>
        <div className="mb-3 flex items-center justify-between rounded-[11px] border px-3.5 py-2.5" style={{ borderColor: "var(--qrave-dash-border)", background: "rgba(255,255,255,0.03)" }}>
          <span style={labelStyle}>Heute geschlossen</span>
          <button
            type="button"
            onClick={() => commit(isClosed ? null : { date: today, closed: true })}
            className="relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors"
            style={{ background: isClosed ? "var(--qrave-accent)" : "rgba(255,255,255,0.12)" }}
            aria-label={isClosed ? "Heute geschlossen deaktivieren" : "Heute schließen"}
          >
            <span className="absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all" style={{ left: isClosed ? "calc(100% - 19px)" : "3px" }} />
          </button>
        </div>
        {!isClosed ? (
          <div className="rounded-[11px] border px-3.5 py-3" style={{ borderColor: "var(--qrave-dash-border)", background: "rgba(255,255,255,0.03)" }}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(242,242,242,0.5)" }}>
              Abweichende Zeiten heute
            </div>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={overrideOpen}
                onChange={(e) =>
                  commit({
                    date: today,
                    open: e.target.value,
                    close: overrideClose,
                    ...(overrideGrund ? { grund: overrideGrund } : {}),
                  })
                }
                className="rounded-lg border px-2 py-1.5 text-[13px]"
                style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.3)", color: "#fff" }}
              />
              <span style={{ color: "rgba(242,242,242,0.5)" }}>–</span>
              <input
                type="time"
                value={overrideClose}
                onChange={(e) =>
                  commit({
                    date: today,
                    open: overrideOpen,
                    close: e.target.value,
                    ...(overrideGrund ? { grund: overrideGrund } : {}),
                  })
                }
                className="rounded-lg border px-2 py-1.5 text-[13px]"
                style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.3)", color: "#fff" }}
              />
              {override && "open" in override ? (
                <button
                  type="button"
                  onClick={() => commit(null)}
                  className="ml-auto text-[12px] font-semibold"
                  style={{ color: "rgba(242,242,242,0.6)" }}
                >
                  Zurücksetzen
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {override ? (
          <div className="mt-3">
            <label
              className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "rgba(242,242,242,0.5)" }}
            >
              Grund (optional)
            </label>
            <input
              type="text"
              value={grundDraft}
              onChange={(e) => setGrundDraft(e.target.value)}
              onBlur={() => {
                if (grundDraft.trim() !== overrideGrund.trim()) updateGrund(grundDraft);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              placeholder="z. B. Betriebsferien, Feiertag, Veranstaltung"
              maxLength={80}
              className="w-full rounded-[10px] border bg-transparent px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: "var(--qrave-dash-border)", color: "#f2f2f2" }}
            />
            <p className="mt-1.5 text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
              Wird Gästen auf der Splash-Seite unter dem Öffnungsstatus angezeigt.
            </p>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function SprachenSection({ restaurant, onPatchRestaurant, onToast }: Props) {
  return (
    <SectionCard title="Sprachen">
      <SprachenInline
        restaurantId={restaurant.id}
        value={restaurant.active_languages ?? ["de"]}
        onChange={(next) => void onPatchRestaurant({ active_languages: next })}
        onToast={onToast}
      />
    </SectionCard>
  );
}

function AccountSection({ userEmail, onLogout, onToast }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      "Account wirklich löschen?\n\nAlle deine Daten (Restaurant, Speisekarte, Statistiken, hochgeladene Bilder) werden unwiderruflich gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.",
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await authFetch("/api/dashboard/delete-account", {
        method: "POST",
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;
      if (!res.ok || !json?.success) {
        onToast(json?.error ?? "Löschen fehlgeschlagen");
        setDeleting(false);
        return;
      }
      // Session lokal entfernen + zur Startseite. Auth-User existiert
      // serverseitig nicht mehr — Login-Versuch würde scheitern.
      await supabase.auth.signOut().catch(() => undefined);
      window.location.assign("https://qrave.menu");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Löschen fehlgeschlagen");
      setDeleting(false);
    }
  }

  return (
    <SectionCard title="Account">
      <div className="flex h-[52px] items-center justify-between px-4" style={rowBorder}>
        <span style={labelStyle}>E-Mail</span>
        <span style={valueStyle}>{userEmail || "—"}</span>
      </div>
      <button
        type="button"
        onClick={() => router.push("/login")}
        className="flex h-[52px] w-full items-center justify-between px-4 text-left"
        style={rowBorder}
      >
        <span style={labelStyle}>Passwort ändern</span>
        <i className="fa-solid fa-chevron-right text-[11px]" style={{ color: "rgba(242,242,242,0.32)" }} />
      </button>
      <div className="space-y-2 p-3">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.confirm("Wirklich abmelden?")) onLogout();
          }}
          className="w-full rounded-[10px] py-[12px] text-[13px] font-semibold"
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.25)",
            color: "#f87171",
          }}
        >
          Abmelden
        </button>
        <button
          type="button"
          onClick={() => void handleDeleteAccount()}
          disabled={deleting}
          className="w-full rounded-[10px] py-[12px] text-[13px] font-semibold disabled:opacity-60"
          style={{
            background: "transparent",
            border: "1px solid rgba(248,113,113,0.4)",
            color: "#f87171",
          }}
        >
          {deleting ? "Wird gelöscht …" : "Account löschen"}
        </button>
        <p
          className="px-1 pt-1 text-[11px] leading-snug"
          style={{ color: "rgba(242,242,242,0.45)" }}
        >
          DSGVO Art. 17: Alle deine Daten werden unwiderruflich entfernt.
        </p>
      </div>
    </SectionCard>
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
    if (locale === "de") return;
    const has = value.includes(locale);
    const next = has ? value.filter((l) => l !== locale) : [...value, locale];
    const ordered = SUPPORTED_LOCALES.filter((l) => next.includes(l));
    onChange(ordered);
  }

  async function handleTranslate() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await authFetch("/api/dashboard/translate-menu", {
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

  const others = SUPPORTED_LOCALES.filter((l) => l !== "de");
  const hasOther = others.some((l) => value.includes(l));

  return (
    <div>
      <div className="flex h-[52px] items-center justify-between px-4" style={rowBorder}>
        <span style={labelStyle}>{LOCALE_LABEL.de}</span>
        <span style={{ color: "rgba(242,242,242,0.5)", fontSize: 12 }}>Standard</span>
      </div>
      {others.map((locale, i) => {
        const active = value.includes(locale);
        const noBorder = i === others.length - 1;
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
              className="relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors"
              style={{ background: active ? "var(--qrave-accent)" : "rgba(255,255,255,0.12)" }}
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
      <div className="border-t p-3 pt-3" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <button
          type="button"
          onClick={() => void handleTranslate()}
          disabled={busy || !hasOther}
          className="w-full rounded-[10px] py-[12px] text-[13px] font-bold transition disabled:opacity-50"
          style={{
            background: hasOther && !busy ? "var(--qrave-accent-gradient)" : "rgba(255,255,255,0.08)",
            color: hasOther && !busy ? "#fff" : "rgba(242,242,242,0.5)",
            boxShadow: hasOther && !busy ? "0 6px 20px rgba(147,51,234,0.4)" : "none",
          }}
        >
          {busy ? "Übersetzt …" : "Speisekarte übersetzen"}
        </button>
        {!hasOther ? (
          <p className="mt-2 text-center text-[12px]" style={{ color: "rgba(242,242,242,0.5)" }}>
            Mindestens eine weitere Sprache aktivieren.
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
    const next: OeffnungszeitenWoche = { ...draft, [day]: { ...cur, [field]: val } };
    setDraft(next);
  }

  function commitTime() {
    onChange(draft);
    setOpenId(null);
  }

  return (
    <div>
      {OEFFNUNGSZEITEN_WEEKDAY_KEYS.map((day, i) => {
        const entry = draft[day];
        const isOpen = Boolean(entry);
        const isExpanded = openId === day;
        const noBorder = i === OEFFNUNGSZEITEN_WEEKDAY_KEYS.length - 1;
        return (
          <div key={day} className="px-4" style={noBorder ? undefined : rowBorder}>
            <div className="flex h-[52px] items-center justify-between gap-3">
              <span
                className="qrave-font-display w-10 text-[13px] font-bold uppercase tracking-wider"
                style={{ color: "#f2f2f2" }}
              >
                {WEEKDAY_LABELS_SHORT[day]}
              </span>
              {isOpen && entry ? (
                <button
                  type="button"
                  onClick={() => setOpenId(isExpanded ? null : day)}
                  className="flex-1 text-left text-[13px]"
                  style={{ color: "rgba(242,242,242,0.85)" }}
                >
                  {entry.open}–{entry.close}
                </button>
              ) : (
                <span className="flex-1 text-[13px] italic" style={{ color: "rgba(242,242,242,0.5)" }}>
                  geschlossen
                </span>
              )}
              <button
                type="button"
                onClick={() => toggleClosed(day)}
                className="relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors"
                style={{ background: isOpen ? "var(--qrave-accent)" : "rgba(255,255,255,0.12)" }}
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
                  onBlur={() => commitTime()}
                  className="rounded-lg border px-2 py-1 text-[13px]"
                  style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.3)", color: "#fff" }}
                />
                <span className="text-[13px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                  –
                </span>
                <input
                  type="time"
                  value={entry.close}
                  onChange={(e) => setTime(day, "close", e.target.value)}
                  onBlur={() => commitTime()}
                  className="rounded-lg border px-2 py-1 text-[13px]"
                  style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.3)", color: "#fff" }}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
