"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractAccentColorFromImage } from "@/lib/logo-color";

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

type ExtractedItem = {
  name: string;
  beschreibung: string | null;
  preis: number;
  kategorie: string;
  main_tab: string;
};

type WizardState = {
  step: 1 | 2 | 3 | 4;
  name: string;
  email: string;
  password: string;
  restaurantTyp: string;
  adresse: string;
  telefon: string;
  logoFile: File | null;
  logoPreview: string | null;
  pdfFile: File | null;
  extractedItems: ExtractedItem[];
  suggestedColor: string | null;
  accentColor: string;
  extracting: boolean;
  extractError: string | null;
  submitting: boolean;
  submitError: string | null;
  resultSlug: string | null;
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
  pdfFile: null,
  extractedItems: [],
  suggestedColor: null,
  accentColor: ACCENT,
  extracting: false,
  extractError: null,
  submitting: false,
  submitError: null,
  resultSlug: null,
};

export default function RegistrierenWizard() {
  const [s, setS] = useState<WizardState>(initialState);

  useEffect(() => {
    return () => {
      if (s.logoPreview?.startsWith("blob:")) URL.revokeObjectURL(s.logoPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.logoPreview]);

  const set = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setS((prev) => ({ ...prev, [key]: value }));
  }, []);

  function next() {
    setS((prev) => {
      const n = Math.min(4, prev.step + 1) as 1 | 2 | 3 | 4;
      return { ...prev, step: n };
    });
  }
  function back() {
    setS((prev) => {
      const n = Math.max(1, prev.step - 1) as 1 | 2 | 3 | 4;
      return { ...prev, step: n };
    });
  }

  const step1Valid = useMemo(() => {
    return (
      s.name.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim()) &&
      s.password.length >= 8
    );
  }, [s.name, s.email, s.password]);

  const step2Valid = useMemo(() => {
    return s.restaurantTyp !== "" && s.logoFile !== null;
  }, [s.restaurantTyp, s.logoFile]);

  const logoColorRequestRef = useRef<string | null>(null);
  useEffect(() => {
    if (!s.logoPreview) return;
    if (logoColorRequestRef.current === s.logoPreview) return;
    logoColorRequestRef.current = s.logoPreview;
    void (async () => {
      const hex = await extractAccentColorFromImage(s.logoPreview as string);
      if (hex && logoColorRequestRef.current === s.logoPreview) {
        setS((prev) => ({ ...prev, suggestedColor: hex, accentColor: hex }));
      }
    })();
  }, [s.logoPreview]);

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

  async function onPickPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_PDF_BYTES_CLIENT = 3_000_000;
    if (file.size > MAX_PDF_BYTES_CLIENT) {
      e.target.value = "";
      setS((prev) => ({
        ...prev,
        pdfFile: null,
        extracting: false,
        extractedItems: [],
        extractError:
          "PDF zu groß — bitte unter 3 MB. Du kannst Items auch später im Dashboard ergänzen.",
      }));
      return;
    }
    setS((prev) => ({ ...prev, pdfFile: file, extracting: true, extractError: null, extractedItems: [] }));
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/onboarding/extract-menu", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: ExtractedItem[]; error?: string };
      if (!res.ok || !j.ok) {
        setS((prev) => ({
          ...prev,
          extracting: false,
          extractError: j.error ?? "Speisekarte konnte nicht analysiert werden.",
        }));
        return;
      }
      setS((prev) => ({ ...prev, extracting: false, extractedItems: j.items ?? [] }));
    } catch (err) {
      setS((prev) => ({
        ...prev,
        extracting: false,
        extractError: err instanceof Error ? err.message : "Netzwerkfehler",
      }));
    }
  }

  async function submitRegistration() {
    if (!s.logoFile) {
      set("submitError", "Logo fehlt");
      return;
    }
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
      fd.set("accent_color", s.accentColor);
      fd.set("logo", s.logoFile);
      fd.set("items", JSON.stringify(s.extractedItems));
      const res = await fetch("/api/onboarding/register", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        restaurant?: { slug: string };
        error?: string;
      };
      if (!res.ok || !j.ok || !j.restaurant) {
        setS((prev) => ({
          ...prev,
          submitting: false,
          submitError: j.error ?? "Registrierung fehlgeschlagen.",
        }));
        return;
      }
      setS((prev) => ({
        ...prev,
        submitting: false,
        step: 4,
        resultSlug: j.restaurant?.slug ?? null,
      }));
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
        @keyframes qraveGlowPulse {
          0%, 100% { box-shadow: 0 0 24px rgba(147,51,234,0.25); }
          50%      { box-shadow: 0 0 48px rgba(147,51,234,0.55); }
        }
        .qrave-step-anim { animation: qraveFadeSlideIn 0.3s ease both; }
        .qrave-pulse     { animation: qraveGlowPulse 2.5s ease-in-out infinite; }

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
        .qrave-input[type="color"] {
          padding: 0;
          height: 44px;
          width: 56px;
          cursor: pointer;
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
      `}</style>

      <div className="relative z-10 mx-auto w-full max-w-md px-6 pt-10 pb-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <a href="/" className="qrave-back-link text-sm font-medium">
            ← Zurück
          </a>
          <span
            className="text-[11px] uppercase tracking-[0.18em]"
            style={{ color: ACCENT, fontFamily: FONT_ROBOTO, fontWeight: 900 }}
          >
            QRAVE
          </span>
        </div>

        {/* Progress */}
        {s.step < 4 ? (
          <div className="mb-10 flex items-center gap-2">
            {[1, 2, 3].map((n) => (
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
        ) : null}

        <div key={s.step} className="qrave-step-anim">
          {s.step === 1 ? (
            <Step1
              name={s.name}
              email={s.email}
              password={s.password}
              onChange={set}
              onNext={step1Valid ? next : null}
            />
          ) : null}
          {s.step === 2 ? (
            <Step2
              restaurantTyp={s.restaurantTyp}
              logoFile={s.logoFile}
              logoPreview={s.logoPreview}
              adresse={s.adresse}
              telefon={s.telefon}
              onChange={set}
              onPickLogo={onPickLogo}
              onBack={back}
              onNext={step2Valid ? next : null}
            />
          ) : null}
          {s.step === 3 ? (
            <Step3
              pdfFile={s.pdfFile}
              extractedItems={s.extractedItems}
              extracting={s.extracting}
              extractError={s.extractError}
              suggestedColor={s.suggestedColor}
              accentColor={s.accentColor}
              submitting={s.submitting}
              submitError={s.submitError}
              onPickPdf={onPickPdf}
              onChange={set}
              onBack={back}
              onSubmit={submitRegistration}
            />
          ) : null}
          {s.step === 4 ? <Step4 slug={s.resultSlug} restaurantName={s.name} /> : null}
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
  onChange,
  onPickLogo,
  onBack,
  onNext,
}: {
  restaurantTyp: string;
  logoFile: File | null;
  logoPreview: string | null;
  adresse: string;
  telefon: string;
  onChange: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
  onPickLogo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void;
  onNext: (() => void) | null;
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

      <Field label="Logo (PNG / JPG / SVG, max. 2 MB)" hint="Wird auf Splash + Karte angezeigt.">
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
        {logoFile ? (
          <p className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            {logoFile.name}
          </p>
        ) : null}
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

      <div className="mt-8 flex gap-2">
        <BackButton onClick={onBack} />
        <NextButton onClick={onNext} label="Weiter" />
      </div>
    </>
  );
}

function Step3({
  pdfFile,
  extractedItems,
  extracting,
  extractError,
  suggestedColor,
  accentColor,
  submitting,
  submitError,
  onPickPdf,
  onChange,
  onBack,
  onSubmit,
}: {
  pdfFile: File | null;
  extractedItems: ExtractedItem[];
  extracting: boolean;
  extractError: string | null;
  suggestedColor: string | null;
  accentColor: string;
  submitting: boolean;
  submitError: string | null;
  onPickPdf: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onChange: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <H>Speisekarte & Farbe</H>
      <Sub>PDF hochladen — wir extrahieren die Items per KI. Ohne PDF kannst du Items später im Dashboard anlegen.</Sub>

      <Field label="Speisekarte (PDF, optional)">
        <label
          data-active={Boolean(pdfFile)}
          className="qrave-dropzone flex h-24 cursor-pointer items-center justify-center"
        >
          {extracting ? (
            <span className="text-sm" style={{ color: ACCENT }}>
              KI analysiert die Karte…
            </span>
          ) : pdfFile ? (
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
              ✓ {pdfFile.name} · {extractedItems.length} Items erkannt
            </span>
          ) : (
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              + PDF hochladen
            </span>
          )}
          <input type="file" accept="application/pdf" className="hidden" onChange={onPickPdf} disabled={extracting} />
        </label>
        {extractError ? (
          <p className="mt-2 text-xs" style={{ color: "#ff8a8a" }}>
            {extractError}
          </p>
        ) : null}
      </Field>

      <Field label="Akzentfarbe">
        {suggestedColor ? (
          <p className="mb-2 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            Vorschlag aus deinem Logo: <code style={{ color: suggestedColor }}>{suggestedColor}</code>
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={accentColor}
            onChange={(e) => onChange("accentColor", e.target.value)}
            className="qrave-input"
          />
          <input
            type="text"
            value={accentColor}
            onChange={(e) => onChange("accentColor", e.target.value)}
            className="qrave-input"
            style={{ fontFamily: "ui-monospace, monospace" }}
            spellCheck={false}
          />
        </div>
      </Field>

      {submitError ? (
        <p className="mb-3 text-sm" style={{ color: "#ff8a8a" }}>
          {submitError}
        </p>
      ) : null}

      <div className="mt-8 flex gap-2">
        <BackButton onClick={onBack} />
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || extracting}
          className="qrave-cta flex-[2]"
        >
          {submitting ? "Wird angelegt…" : "Registrierung abschließen"}
        </button>
      </div>
    </>
  );
}

function Step4({ slug, restaurantName }: { slug: string | null; restaurantName: string }) {
  const url = slug ? `https://qrave.menu/${slug}` : null;
  return (
    <div className="pt-6 text-center">
      <div
        className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full"
        style={{
          background: "rgba(147,51,234,0.15)",
          border: "1px solid rgba(147,51,234,0.4)",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth={2.2} aria-hidden>
          <path d="M5 12l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1
        className="text-[2.4rem] leading-tight tracking-tight"
        style={{ fontFamily: FONT_ROBOTO, fontWeight: 900, color: "#fff" }}
      >
        Geschafft.
      </h1>
      <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
        {restaurantName} ist registriert. Wir prüfen kurz und schalten dich frei — du bekommst eine Mail sobald die Karte live ist.
      </p>

      {url ? (
        <div
          className="qrave-pulse mx-auto mt-8 max-w-[320px] rounded-2xl px-5 py-4"
          style={{
            border: `1px solid rgba(147,51,234,0.4)`,
            background: "rgba(147,51,234,0.06)",
          }}
        >
          <p
            className="text-[10px] uppercase tracking-[0.14em]"
            style={{ color: "rgba(255,255,255,0.5)", fontWeight: 600 }}
          >
            Deine zukünftige URL
          </p>
          <p className="mt-1 break-all text-sm font-semibold" style={{ color: ACCENT }}>
            {url}
          </p>
        </div>
      ) : null}

      <a href="/dashboard" className="qrave-cta mt-8 inline-block">
        Zum Dashboard
      </a>
    </div>
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
