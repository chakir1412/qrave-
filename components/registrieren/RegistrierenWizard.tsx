"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const ACCENT = "#9333ea";
const ACCENT_LIGHT = "#7c3aed";
const BG = "#06040e";
const CARD = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";

const FONT_ROBOTO = "var(--font-roboto), system-ui, sans-serif";
const FONT_DM = "var(--font-dm-sans), system-ui, sans-serif";

const TYPES: Array<{ value: string; label: string }> = [
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Café" },
  { value: "bar", label: "Bar" },
  { value: "bistro", label: "Bistro" },
  { value: "imbiss", label: "Pizzeria / Imbiss" },
];

type WizardState = {
  step: 1 | 2;
  name: string;
  email: string;
  password: string;
  restaurantTyp: string;
  adresse: string;
  telefon: string;
  logoFile: File | null;
  logoPreview: string | null;
  privacyAccepted: boolean;
  submitting: boolean;
  submitError: string | null;
};

const initialState: WizardState = {
  step: 1,
  name: "",
  email: "",
  password: "",
  restaurantTyp: "",
  adresse: "",
  telefon: "",
  logoFile: null,
  logoPreview: null,
  privacyAccepted: false,
  submitting: false,
  submitError: null,
};

export default function RegistrierenWizard() {
  const [s, setS] = useState<WizardState>(initialState);

  useEffect(() => {
    return () => {
      if (s.logoPreview?.startsWith("blob:")) URL.revokeObjectURL(s.logoPreview);
    };
  }, [s.logoPreview]);

  const set = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setS((prev) => ({ ...prev, [key]: value }));
  }, []);

  function next() {
    setS((prev) => ({ ...prev, step: 2 }));
  }
  function back() {
    setS((prev) => ({ ...prev, step: 1 }));
  }

  const step1Valid = useMemo(() => {
    return (
      s.name.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim()) &&
      s.password.length >= 8
    );
  }, [s.name, s.email, s.password]);

  // Logo ist optional — Wirt kann ohne Logo weitergehen.
  // Datenschutz-Checkbox ist Pflicht.
  const step2Valid = useMemo(() => {
    return s.restaurantTyp !== "" && s.privacyAccepted;
  }, [s.restaurantTyp, s.privacyAccepted]);

  function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = ["image/png", "image/jpeg", "image/svg+xml"].includes(file.type);
    if (!ok) {
      set("submitError", "Bitte PNG, JPG oder SVG verwenden.");
      return;
    }
    const blobUrl = URL.createObjectURL(file);
    setS((prev) => ({ ...prev, logoFile: file, logoPreview: blobUrl, submitError: null }));
  }

  function skipLogo() {
    setS((prev) => {
      if (prev.logoPreview?.startsWith("blob:")) URL.revokeObjectURL(prev.logoPreview);
      return { ...prev, logoFile: null, logoPreview: null };
    });
  }

  async function submitRegistration() {
    set("submitting", true);
    set("submitError", null);
    try {
      const fd = new FormData();
      fd.set("name", s.name.trim());
      fd.set("email", s.email.trim().toLowerCase());
      fd.set("password", s.password);
      fd.set("restaurant_typ", s.restaurantTyp);
      if (s.adresse.trim()) fd.set("adresse", s.adresse.trim());
      if (s.telefon.trim()) fd.set("telefon", s.telefon.trim());
      if (s.logoFile) fd.set("logo", s.logoFile);
      fd.set("items", "[]");
      const res = await fetch("/api/onboarding/register", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        restaurant?: { slug: string };
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setS((prev) => ({
          ...prev,
          submitting: false,
          submitError: j.error ?? "Registrierung fehlgeschlagen.",
        }));
        return;
      }
      // Auto-Login direkt im Browser-Client, damit /dashboard die Session
      // im localStorage findet und nicht zum Login redirected.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: s.email.trim().toLowerCase(),
        password: s.password,
      });
      if (signInErr) {
        // Registrierung war erfolgreich, aber Auto-Login fehlgeschlagen.
        // User-freundliche Meldung + auf Login-Seite weiter, statt blindem
        // Dashboard-Redirect der dann auf /login zurückspringen würde.
        window.location.assign("/login?registered=1");
        return;
      }
      window.location.assign("/dashboard");
    } catch (err) {
      setS((prev) => ({
        ...prev,
        submitting: false,
        submitError: err instanceof Error ? err.message : "Netzwerkfehler",
      }));
    }
  }

  return (
    <div
      className="relative isolate min-h-dvh overflow-hidden"
      style={{ background: BG, color: "#fff", fontFamily: FONT_DM }}
    >
      <PurpleBeams />

      <style>{`
        @keyframes qraveFadeSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .qrave-step-anim { animation: qraveFadeSlideIn 0.3s ease both; }

        .qrave-input {
          width: 100%;
          background: ${CARD};
          border: 1px solid ${BORDER};
          border-radius: 12px;
          padding: 12px 16px;
          color: #fff;
          font-size: 14px;
          font-family: ${FONT_DM};
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .qrave-input::placeholder { color: rgba(255,255,255,0.35); }
        .qrave-input:focus {
          border-color: ${ACCENT};
          box-shadow: 0 0 0 3px rgba(147,51,234,0.15);
        }

        .qrave-cta {
          background: linear-gradient(135deg, ${ACCENT}, ${ACCENT_LIGHT});
          color: #fff;
          border-radius: 12px;
          padding: 14px 24px;
          font-family: ${FONT_DM};
          font-weight: 500;
          font-size: 15px;
          box-shadow: 0 0 24px rgba(147,51,234,0.4);
          transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
          cursor: pointer;
        }
        .qrave-cta:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 0 40px rgba(147,51,234,0.6);
        }
        .qrave-cta:active:not(:disabled) { transform: translateY(0); }
        .qrave-cta:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }

        .qrave-back {
          background: transparent;
          border: 1px solid ${BORDER};
          color: rgba(255,255,255,0.65);
          border-radius: 12px;
          padding: 14px 24px;
          font-family: ${FONT_DM};
          font-weight: 500;
          font-size: 15px;
          transition: color 0.2s, border-color 0.2s, background 0.2s;
          cursor: pointer;
        }
        .qrave-back:hover {
          color: #fff;
          border-color: rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.03);
        }

        .qrave-type-card {
          border: 1px solid ${BORDER};
          background: ${CARD};
          border-radius: 12px;
          padding: 14px 12px;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.85);
          transition: border-color 0.2s, background 0.2s, color 0.2s;
          cursor: pointer;
        }
        .qrave-type-card:hover {
          border-color: rgba(147,51,234,0.5);
          background: rgba(147,51,234,0.08);
        }
        .qrave-type-card[data-selected="true"] {
          border-color: ${ACCENT};
          background: rgba(147,51,234,0.12);
          color: #fff;
        }

        .qrave-dropzone {
          background: ${CARD};
          border: 1px dashed ${BORDER};
          border-radius: 12px;
          transition: border-color 0.2s, background 0.2s;
        }
        .qrave-dropzone:hover { border-color: rgba(147,51,234,0.5); }
        .qrave-dropzone[data-active="true"] {
          border-color: ${ACCENT};
          background: rgba(147,51,234,0.05);
        }

        .qrave-back-link {
          color: rgba(255,255,255,0.4);
          transition: color 0.2s;
        }
        .qrave-back-link:hover { color: rgba(255,255,255,0.8); }

        .qrave-skip-link {
          background: transparent;
          border: 0;
          padding: 0;
          font-family: ${FONT_DM};
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          transition: color 0.2s;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .qrave-skip-link:hover { color: ${ACCENT}; }

        .qrave-checkbox {
          width: 16px;
          height: 16px;
          accent-color: ${ACCENT};
          flex-shrink: 0;
          margin-top: 2px;
          cursor: pointer;
        }
        .qrave-privacy-label {
          font-family: ${FONT_DM};
          font-size: 12px;
          line-height: 1.5;
          color: rgba(255,255,255,0.6);
        }
        .qrave-privacy-link {
          color: rgba(255,255,255,0.85);
          text-decoration: underline;
          text-underline-offset: 3px;
          transition: color 0.2s;
        }
        .qrave-privacy-link:hover { color: ${ACCENT}; }
      `}</style>

      <div className="relative z-10 mx-auto w-full max-w-md px-6 pt-10 pb-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <a href="/" className="qrave-back-link text-sm font-medium">
            ← Zurück
          </a>
          <a href="/" aria-label="Qrave Startseite">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/QR_Logo_weiß.png"
              alt="Qrave"
              className="logo-glow"
              style={{ height: 32, width: "auto", display: "block" }}
            />
          </a>
        </div>

        {/* Progress */}
        <div className="mb-10 flex items-center gap-2">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="h-1.5 flex-1 rounded-full transition-all duration-300"
              style={{
                background:
                  n <= s.step
                    ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT_LIGHT})`
                    : "rgba(255,255,255,0.06)",
              }}
            />
          ))}
        </div>

        <div key={s.step} className="qrave-step-anim">
          {s.step === 1 ? (
            <Step1
              name={s.name}
              email={s.email}
              password={s.password}
              onChange={set}
              onNext={step1Valid ? next : null}
            />
          ) : (
            <Step2
              restaurantTyp={s.restaurantTyp}
              logoFile={s.logoFile}
              logoPreview={s.logoPreview}
              adresse={s.adresse}
              telefon={s.telefon}
              privacyAccepted={s.privacyAccepted}
              submitting={s.submitting}
              submitError={s.submitError}
              onChange={set}
              onPickLogo={onPickLogo}
              onSkipLogo={skipLogo}
              onBack={back}
              onSubmit={step2Valid ? submitRegistration : null}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Beams (oben links, lila radialGradient) ---------- */

function PurpleBeams() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      viewBox="0 0 1200 800"
    >
      <defs>
        <radialGradient id="qrave-beam-a" cx="0" cy="0" r="0.7">
          <stop offset="0%" stopColor="rgba(147,51,234,0.45)" />
          <stop offset="40%" stopColor="rgba(124,58,237,0.18)" />
          <stop offset="100%" stopColor="rgba(6,4,14,0)" />
        </radialGradient>
        <radialGradient id="qrave-beam-b" cx="0.2" cy="0.1" r="0.5">
          <stop offset="0%" stopColor="rgba(168,85,247,0.3)" />
          <stop offset="100%" stopColor="rgba(6,4,14,0)" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="1200" height="800" fill="url(#qrave-beam-a)" />
      <rect x="0" y="0" width="1200" height="800" fill="url(#qrave-beam-b)" />
    </svg>
  );
}

/* ---------- Schritte ---------- */

function Step1({
  name,
  email,
  password,
  onChange,
  onNext,
}: {
  name: string;
  email: string;
  password: string;
  onChange: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
  onNext: (() => void) | null;
}) {
  return (
    <>
      <H>Willkommen bei Qrave</H>
      <Sub>Lass uns zuerst deinen Account anlegen.</Sub>

      <Field label="Restaurantname">
        <input
          type="text"
          value={name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="z. B. Brömser's Bistro"
          className="qrave-input"
          autoComplete="organization"
        />
      </Field>
      <Field label="E-Mail">
        <input
          type="email"
          value={email}
          onChange={(e) => onChange("email", e.target.value)}
          placeholder="hallo@dein-restaurant.de"
          className="qrave-input"
          autoComplete="email"
        />
      </Field>
      <Field label="Passwort" hint="Mindestens 8 Zeichen.">
        <input
          type="password"
          value={password}
          onChange={(e) => onChange("password", e.target.value)}
          placeholder="••••••••"
          className="qrave-input"
          autoComplete="new-password"
        />
      </Field>

      <NextButton onClick={onNext} label="Weiter" full />
    </>
  );
}

function Step2({
  restaurantTyp,
  logoFile,
  logoPreview,
  adresse,
  telefon,
  privacyAccepted,
  submitting,
  submitError,
  onChange,
  onPickLogo,
  onSkipLogo,
  onBack,
  onSubmit,
}: {
  restaurantTyp: string;
  logoFile: File | null;
  logoPreview: string | null;
  adresse: string;
  telefon: string;
  privacyAccepted: boolean;
  submitting: boolean;
  submitError: string | null;
  onChange: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
  onPickLogo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSkipLogo: () => void;
  onBack: () => void;
  onSubmit: (() => void) | null;
}) {
  return (
    <>
      <H>Dein Betrieb</H>
      <Sub>Damit deine Speisekarte zum Stil passt.</Sub>

      <Field label="Betriebstyp">
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((t) => {
            const selected = restaurantTyp === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => onChange("restaurantTyp", t.value)}
                data-selected={selected}
                className="qrave-type-card"
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Logo (PNG / JPG / SVG, max. 2 MB, optional)" hint="Wird auf Splash + Karte angezeigt.">
        <label
          data-active={Boolean(logoPreview)}
          className="qrave-dropzone flex h-32 cursor-pointer items-center justify-center"
        >
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="" className="max-h-full max-w-full object-contain p-3" />
          ) : (
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              + Logo hochladen
            </span>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={onPickLogo}
          />
        </label>
        <div className="mt-2 flex items-center justify-between">
          {logoFile ? (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              {logoFile.name}
            </p>
          ) : (
            <span />
          )}
          <button type="button" onClick={onSkipLogo} className="qrave-skip-link">
            Später hinzufügen
          </button>
        </div>
      </Field>

      <Field label="Adresse (optional)">
        <input
          type="text"
          value={adresse}
          onChange={(e) => onChange("adresse", e.target.value)}
          placeholder="Straße & Hausnummer, PLZ Ort"
          className="qrave-input"
        />
      </Field>
      <Field label="Telefon (optional)">
        <input
          type="tel"
          value={telefon}
          onChange={(e) => onChange("telefon", e.target.value)}
          placeholder="+49 …"
          className="qrave-input"
        />
      </Field>

      {submitError ? (
        <p className="mb-3 text-sm" style={{ color: "#ff8a8a" }}>
          {submitError}
        </p>
      ) : null}

      <label className="qrave-privacy mt-6 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={privacyAccepted}
          onChange={(e) => onChange("privacyAccepted", e.target.checked)}
          className="qrave-checkbox"
        />
        <span className="qrave-privacy-label">
          Ich habe die{" "}
          <a
            href="/datenschutz"
            target="_blank"
            rel="noopener noreferrer"
            className="qrave-privacy-link"
          >
            Datenschutzbestimmungen
          </a>{" "}
          gelesen und stimme der Verarbeitung meiner Daten zu.
        </span>
      </label>

      <div className="mt-4 flex gap-2">
        <BackButton onClick={onBack} />
        <button
          type="button"
          onClick={onSubmit ?? undefined}
          disabled={!onSubmit || submitting}
          className="qrave-cta flex-[2]"
        >
          {submitting ? "Wird angelegt…" : "Registrierung abschließen"}
        </button>
      </div>

      <p
        className="mt-4 text-center"
        style={{
          color: "rgba(255,255,255,0.4)",
          fontFamily: FONT_DM,
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        Mit der Registrierung stimmst du unseren{" "}
        <a
          href="/datenschutz"
          style={{ color: "rgba(255,255,255,0.65)", textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          Datenschutzbestimmungen
        </a>{" "}
        zu. ·{" "}
        <a
          href="/impressum"
          style={{ color: "rgba(255,255,255,0.65)", textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          Impressum
        </a>
      </p>
    </>
  );
}

/* ---------- UI-Bausteine ---------- */

function H({ children }: { children: React.ReactNode }) {
  return (
    <h1
      className="text-[2.2rem] leading-tight tracking-tight"
      style={{ fontFamily: FONT_ROBOTO, fontWeight: 900, color: "#fff" }}
    >
      {children}
    </h1>
  );
}
function Sub({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 mb-8 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
      {children}
    </p>
  );
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label
        className="mb-2 block text-[11px] uppercase"
        style={{
          color: "rgba(255,255,255,0.5)",
          letterSpacing: "0.14em",
          fontWeight: 500,
        }}
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p className="mt-1.5 text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
function NextButton({ onClick, label, full = false }: { onClick: (() => void) | null; label: string; full?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick ?? undefined}
      disabled={!onClick}
      className={`qrave-cta ${full ? "mt-8 w-full" : "flex-[2]"}`}
    >
      {label}
    </button>
  );
}
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="qrave-back flex-1">
      Zurück
    </button>
  );
}
