"use client";

import { DM_Sans, Instrument_Serif } from "next/font/google";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractAccentColorFromImage } from "@/lib/logo-color";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: ["400"], display: "swap" });

const ACCENT = "#c9a84c";
const BG = "#0e0c0a";
const CARD = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.12)";

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

  // Logo-Preview-URL aufräumen, damit kein Blob im Memory hängen bleibt.
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

  // Step-1-Validation
  const step1Valid = useMemo(() => {
    return (
      s.name.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim()) &&
      s.password.length >= 8
    );
  }, [s.name, s.email, s.password]);

  // Step-2-Validation
  const step2Valid = useMemo(() => {
    return s.restaurantTyp !== "" && s.logoFile !== null;
  }, [s.restaurantTyp, s.logoFile]);

  // Wenn Logo gesetzt → versuche dominante Farbe zu extrahieren
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
    <div className={`${dmSans.className} min-h-dvh`} style={{ background: BG, color: "#fff" }}>
      <div className="mx-auto w-full max-w-md px-6 pt-10 pb-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <a href="/" className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>
            ← Zurück
          </a>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
            Qrave
          </span>
        </div>

        {/* Progress */}
        {s.step < 4 ? (
          <div className="mb-8 flex items-center gap-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-1 flex-1 rounded-full transition-colors"
                style={{ background: n <= s.step ? ACCENT : "rgba(255,255,255,0.1)" }}
              />
            ))}
          </div>
        ) : null}

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
          className={inputClass()}
          style={inputStyle()}
          autoComplete="organization"
        />
      </Field>
      <Field label="E-Mail">
        <input
          type="email"
          value={email}
          onChange={(e) => onChange("email", e.target.value)}
          placeholder="hallo@dein-restaurant.de"
          className={inputClass()}
          style={inputStyle()}
          autoComplete="email"
        />
      </Field>
      <Field label="Passwort" hint="Mindestens 8 Zeichen.">
        <input
          type="password"
          value={password}
          onChange={(e) => onChange("password", e.target.value)}
          placeholder="••••••••"
          className={inputClass()}
          style={inputStyle()}
          autoComplete="new-password"
        />
      </Field>

      <NextButton onClick={onNext} label="Weiter" />
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
                className="rounded-xl border px-3 py-3 text-sm font-semibold transition-colors"
                style={{
                  borderColor: selected ? ACCENT : BORDER,
                  background: selected ? "rgba(201,168,76,0.12)" : CARD,
                  color: selected ? ACCENT : "rgba(255,255,255,0.85)",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Logo (PNG / JPG / SVG, max. 2 MB)" hint="Wird auf Splash + Karte angezeigt.">
        <label
          className="flex h-32 cursor-pointer items-center justify-center rounded-xl border border-dashed"
          style={{ borderColor: logoPreview ? ACCENT : BORDER, background: CARD }}
        >
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="" className="max-h-full max-w-full object-contain p-3" />
          ) : (
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
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
          className={inputClass()}
          style={inputStyle()}
        />
      </Field>
      <Field label="Telefon (optional)">
        <input
          type="tel"
          value={telefon}
          onChange={(e) => onChange("telefon", e.target.value)}
          placeholder="+49 …"
          className={inputClass()}
          style={inputStyle()}
        />
      </Field>

      <div className="mt-6 flex gap-2">
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
          className="flex h-24 cursor-pointer items-center justify-center rounded-xl border border-dashed"
          style={{ borderColor: pdfFile ? ACCENT : BORDER, background: CARD }}
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
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
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
            className="h-10 w-14 cursor-pointer rounded-lg border"
            style={{ borderColor: BORDER, background: CARD }}
          />
          <input
            type="text"
            value={accentColor}
            onChange={(e) => onChange("accentColor", e.target.value)}
            className={inputClass()}
            style={{ ...inputStyle(), fontFamily: "ui-monospace, monospace" }}
            spellCheck={false}
          />
        </div>
      </Field>

      {submitError ? (
        <p className="mb-3 text-sm" style={{ color: "#ff8a8a" }}>
          {submitError}
        </p>
      ) : null}

      <div className="mt-6 flex gap-2">
        <BackButton onClick={onBack} />
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || extracting}
          className="flex-[2] rounded-xl px-6 py-3 text-base font-bold transition-transform active:scale-[0.98] disabled:opacity-60"
          style={{ background: ACCENT, color: "#1a1208" }}
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
        style={{ background: "rgba(201,168,76,0.15)", border: `1px solid ${ACCENT}55` }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth={2.2} aria-hidden>
          <path d="M5 12l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1
        className={`${serif.className} text-[2.4rem] font-light leading-tight tracking-tight`}
        style={{ color: "#fff" }}
      >
        Geschafft.
      </h1>
      <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
        {restaurantName} ist registriert. Wir prüfen kurz und schalten dich frei — du bekommst eine Mail sobald die Karte live ist.
      </p>

      {url ? (
        <div className="mx-auto mt-8 max-w-[320px] rounded-2xl border px-5 py-4" style={{ borderColor: BORDER, background: CARD }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.45)" }}>
            Deine zukünftige URL
          </p>
          <p className="mt-1 break-all text-sm font-semibold" style={{ color: ACCENT }}>
            {url}
          </p>
        </div>
      ) : null}

      <a
        href="/dashboard"
        className="mt-8 inline-block rounded-xl px-6 py-3 text-sm font-bold"
        style={{ background: ACCENT, color: "#1a1208" }}
      >
        Zum Dashboard
      </a>
    </div>
  );
}

/* ---------- UI-Bausteine ---------- */

function H({ children }: { children: React.ReactNode }) {
  return (
    <h1
      className={`${serif.className} text-[2.2rem] font-light leading-tight tracking-tight`}
      style={{ color: "#fff" }}
    >
      {children}
    </h1>
  );
}
function Sub({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 mb-6 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
      {children}
    </p>
  );
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>
        {label}
      </label>
      {children}
      {hint ? (
        <p className="mt-1.5 text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
function inputClass(): string {
  return "w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors focus:border-[color:var(--accent)]";
}
function inputStyle(): React.CSSProperties {
  return {
    borderColor: BORDER,
    background: CARD,
    color: "#fff",
    ["--accent" as never]: ACCENT,
  };
}
function NextButton({ onClick, label }: { onClick: (() => void) | null; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick ?? undefined}
      disabled={!onClick}
      className="mt-6 w-full rounded-xl px-6 py-3 text-base font-bold transition-transform active:scale-[0.98] disabled:opacity-40"
      style={{ background: ACCENT, color: "#1a1208" }}
    >
      {label}
    </button>
  );
}
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-xl border px-6 py-3 text-base font-semibold"
      style={{ borderColor: BORDER, background: "transparent", color: "rgba(255,255,255,0.65)" }}
    >
      Zurück
    </button>
  );
}
