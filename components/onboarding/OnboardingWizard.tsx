"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CUISINE_TYPES } from "@/lib/onboarding-cuisines";

const ACCENT = "#9333ea";
const ACCENT_LIGHT = "#7c3aed";
const BG = "#06040e";
const CARD = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";

const FONT_ROBOTO = "var(--font-roboto), system-ui, sans-serif";
const FONT_DM = "var(--font-dm-sans), system-ui, sans-serif";

const WHATSAPP_URL = "https://wa.me/491738996449";
const MAX_FILE_BYTES = 10_000_000;
const ACCEPTED_MIME = "application/pdf,image/png,image/jpeg,image/webp";

type Props = {
  initialName: string;
  initialCuisine: string;
  initialStadt: string;
  initialTelefon: string;
};

type Step = 1 | 2 | 3;

export default function OnboardingWizard({
  initialName,
  initialCuisine,
  initialStadt,
  initialTelefon,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState(initialName);
  const [cuisine, setCuisine] = useState(initialCuisine);
  const [stadt, setStadt] = useState(initialStadt);
  const [telefon, setTelefon] = useState(initialTelefon);
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const step1Valid = useMemo(
    () =>
      name.trim().length >= 2 &&
      cuisine.trim().length > 0 &&
      stadt.trim().length >= 2 &&
      telefon.trim().length >= 4,
    [name, cuisine, stadt, telefon],
  );
  const step2Valid = useMemo(() => Boolean(file) || link.trim().length > 0, [file, link]);

  const onPickFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setError("Datei zu groß (max. 10 MB)");
      return;
    }
    setFile(f);
    setError(null);
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("name", name.trim());
      fd.set("cuisine_type", cuisine.trim());
      fd.set("stadt", stadt.trim());
      fd.set("telefon", telefon.trim());
      if (file) fd.set("file", file);
      if (link.trim()) fd.set("link", link.trim());
      const res = await fetch("/api/onboarding/submit", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setSubmitting(false);
        setError(j.error ?? "Absenden fehlgeschlagen.");
        return;
      }
      setStep(3);
      setSubmitting(false);
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Netzwerkfehler");
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

        .qrave-input, .qrave-select {
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
        .qrave-input:focus, .qrave-select:focus {
          border-color: ${ACCENT};
          box-shadow: 0 0 0 3px rgba(147,51,234,0.15);
        }
        .qrave-select {
          appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 40px;
        }
        .qrave-select option { color: #000; background: #fff; }

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

        .qrave-dropzone {
          background: ${CARD};
          border: 1px dashed ${BORDER};
          border-radius: 12px;
          transition: border-color 0.2s, background 0.2s;
          cursor: pointer;
        }
        .qrave-dropzone:hover { border-color: rgba(147,51,234,0.5); }
        .qrave-dropzone[data-active="true"] {
          border-color: ${ACCENT};
          background: rgba(147,51,234,0.05);
        }

        .qrave-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          color: rgba(255,255,255,0.35);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          margin: 18px 0;
        }
        .qrave-divider::before, .qrave-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: ${BORDER};
        }

        .qrave-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(147,51,234,0.1);
          border: 1px solid rgba(147,51,234,0.3);
          color: rgba(255,255,255,0.85);
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 13px;
        }
        .qrave-chip button {
          color: rgba(255,255,255,0.6);
          background: transparent;
          border: 0;
          cursor: pointer;
          font-size: 15px;
          line-height: 1;
        }
        .qrave-chip button:hover { color: #fff; }

        .qrave-whatsapp {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: #25d366;
          color: #fff;
          border-radius: 12px;
          padding: 14px 24px;
          font-family: ${FONT_DM};
          font-weight: 600;
          font-size: 15px;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .qrave-whatsapp:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(37,211,102,0.35);
        }
      `}</style>

      <div className="relative z-10 mx-auto w-full max-w-md px-6 pt-10 pb-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/QR_Logo_weiß.png"
            alt="Qrave"
            className="logo-glow"
            style={{ height: 32, width: "auto", display: "block" }}
          />
        </div>

        {/* Progress: 3 Dots */}
        <div className="mb-10 flex items-center justify-center gap-3">
          {[1, 2, 3].map((n) => {
            const active = n === step;
            const done = n < step;
            return (
              <span
                key={n}
                aria-hidden
                style={{
                  width: active ? 10 : 8,
                  height: active ? 10 : 8,
                  borderRadius: "999px",
                  background: done || active
                    ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT_LIGHT})`
                    : "rgba(255,255,255,0.12)",
                  boxShadow: active ? `0 0 12px rgba(147,51,234,0.6)` : "none",
                  transition: "all 0.2s",
                }}
              />
            );
          })}
        </div>

        <div key={step} className="qrave-step-anim">
          {step === 1 ? (
            <Step1
              name={name}
              cuisine={cuisine}
              stadt={stadt}
              telefon={telefon}
              onName={setName}
              onCuisine={setCuisine}
              onStadt={setStadt}
              onTelefon={setTelefon}
              onNext={step1Valid ? () => setStep(2) : null}
            />
          ) : step === 2 ? (
            <Step2
              file={file}
              link={link}
              error={error}
              submitting={submitting}
              fileInputRef={fileInputRef}
              onPickFile={onPickFile}
              onClearFile={clearFile}
              onLink={setLink}
              onBack={() => setStep(1)}
              onSubmit={step2Valid && !submitting ? submit : null}
            />
          ) : (
            <Step3 />
          )}
        </div>
      </div>
    </div>
  );
}

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
        <radialGradient id="qrave-onb-a" cx="0" cy="0" r="0.7">
          <stop offset="0%" stopColor="rgba(147,51,234,0.45)" />
          <stop offset="40%" stopColor="rgba(124,58,237,0.18)" />
          <stop offset="100%" stopColor="rgba(6,4,14,0)" />
        </radialGradient>
        <radialGradient id="qrave-onb-b" cx="0.2" cy="0.1" r="0.5">
          <stop offset="0%" stopColor="rgba(168,85,247,0.3)" />
          <stop offset="100%" stopColor="rgba(6,4,14,0)" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="1200" height="800" fill="url(#qrave-onb-a)" />
      <rect x="0" y="0" width="1200" height="800" fill="url(#qrave-onb-b)" />
    </svg>
  );
}

function Step1({
  name,
  cuisine,
  stadt,
  telefon,
  onName,
  onCuisine,
  onStadt,
  onTelefon,
  onNext,
}: {
  name: string;
  cuisine: string;
  stadt: string;
  telefon: string;
  onName: (v: string) => void;
  onCuisine: (v: string) => void;
  onStadt: (v: string) => void;
  onTelefon: (v: string) => void;
  onNext: (() => void) | null;
}) {
  return (
    <>
      <H>Erzähl uns von deinem Restaurant</H>
      <Sub>Damit wir alles vorbereiten können.</Sub>

      <Field label="Restaurantname">
        <input
          type="text"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="z. B. Frankfurter Wirtshaus"
          className="qrave-input"
          autoComplete="organization"
        />
      </Field>

      <Field label="Art des Restaurants">
        <select
          value={cuisine}
          onChange={(e) => onCuisine(e.target.value)}
          className="qrave-select"
        >
          <option value="" disabled>
            Bitte wählen …
          </option>
          {CUISINE_TYPES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Stadt">
        <input
          type="text"
          value={stadt}
          onChange={(e) => onStadt(e.target.value)}
          placeholder="z. B. Frankfurt"
          className="qrave-input"
          autoComplete="address-level2"
        />
      </Field>

      <Field label="Telefonnummer">
        <input
          type="tel"
          value={telefon}
          onChange={(e) => onTelefon(e.target.value)}
          placeholder="+49 …"
          className="qrave-input"
          autoComplete="tel"
        />
      </Field>

      <button
        type="button"
        onClick={onNext ?? undefined}
        disabled={!onNext}
        className="qrave-cta mt-8 w-full"
      >
        Weiter
      </button>
    </>
  );
}

function Step2({
  file,
  link,
  error,
  submitting,
  fileInputRef,
  onPickFile,
  onClearFile,
  onLink,
  onBack,
  onSubmit,
}: {
  file: File | null;
  link: string;
  error: string | null;
  submitting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPickFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
  onLink: (v: string) => void;
  onBack: () => void;
  onSubmit: (() => void) | null;
}) {
  return (
    <>
      <H>Deine Speisekarte</H>
      <Sub>Lade ein Foto oder PDF hoch — oder schick uns einen Link.</Sub>

      <Field label="Speisekarte hochladen (PDF / Foto, max. 10 MB)">
        <label data-active={Boolean(file)} className="qrave-dropzone flex h-32 items-center justify-center">
          {file ? (
            <span className="qrave-chip">
              {file.name}
              <button
                type="button"
                aria-label="Datei entfernen"
                onClick={(e) => {
                  e.preventDefault();
                  onClearFile();
                }}
              >
                ×
              </button>
            </span>
          ) : (
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              + Datei auswählen
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_MIME}
            className="hidden"
            onChange={onPickFile}
          />
        </label>
      </Field>

      <div className="qrave-divider">oder</div>

      <Field label="Link zur Speisekarte">
        <input
          type="url"
          value={link}
          onChange={(e) => onLink(e.target.value)}
          placeholder="https://…"
          className="qrave-input"
          inputMode="url"
        />
      </Field>

      {error ? (
        <p className="mb-3 text-sm" style={{ color: "#ff8a8a" }}>
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onBack} className="qrave-back flex-1">
          Zurück
        </button>
        <button
          type="button"
          onClick={onSubmit ?? undefined}
          disabled={!onSubmit}
          className="qrave-cta flex-[2]"
        >
          {submitting ? "Wird gesendet…" : "Abschicken"}
        </button>
      </div>
    </>
  );
}

function Step3() {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.assign("/dashboard");
    }, 2500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="text-center">
      <div
        aria-hidden
        style={{
          width: 68,
          height: 68,
          margin: "0 auto 24px",
          borderRadius: "999px",
          background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_LIGHT})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 40px rgba(147,51,234,0.5)",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1
        className="text-[2.2rem] leading-tight tracking-tight"
        style={{ fontFamily: FONT_ROBOTO, fontWeight: 900, color: "#fff" }}
      >
        Wir sind dabei.
      </h1>
      <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
        Wir melden uns in den nächsten Stunden bei dir. Schneller geht&apos;s per WhatsApp:
      </p>

      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="qrave-whatsapp mt-8 inline-flex"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.15-.174.199-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.077 4.487.71.306 1.263.489 1.695.626.712.226 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M20.52 3.449C12.831-3.984-.041 1.484.021 12.008c.02 3.245 1.087 6.351 3.023 8.982L1.05 24l4.9-1.99c8.988 4.61 20.05-.815 20.05-9.99a12.02 12.02 0 0 0-5.48-8.571zm2.14 8.541c-.01 8.062-8.868 13.093-15.82 8.99l-.72-.42-2.917 1.184.977-2.85-.454-.74a9.98 9.98 0 0 1-1.541-5.35C2.185 4.03 12.06-.966 18.44 5.42c1.925 1.925 3.24 4.606 3.24 7.57z"/>
        </svg>
        WhatsApp öffnen
      </a>

      <p className="mt-6 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
        Du wirst gleich zu deinem Dashboard weitergeleitet.
      </p>
    </div>
  );
}

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
function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
    </div>
  );
}
