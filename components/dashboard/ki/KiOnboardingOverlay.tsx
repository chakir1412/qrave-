"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "qrave-ki-onboarding-seen";

const STEPS: { icon: string; title: string; body: string }[] = [
  {
    icon: "fa-solid fa-wand-magic-sparkles",
    title: "Beschreibung in Sekunden",
    body: "Trag den Namen eines Gerichts ein — Claude Haiku schreibt eine kurze, appetitliche Beschreibung. Du kannst sie übernehmen oder anpassen.",
  },
  {
    icon: "fa-solid fa-language",
    title: "Karte in 7 Sprachen",
    body: "Aktiviere die Sprachen, die deine Gäste sprechen — DeepL übersetzt automatisch. Bestehende Übersetzungen werden nie überschrieben.",
  },
  {
    icon: "fa-solid fa-shield-halved",
    title: "Sicher & sparsam",
    body: "Beide Features laufen mit Rate-Limit pro Restaurant. Du bezahlst nichts — die Modelle sind günstig und schnell.",
  },
];

export function KiOnboardingOverlay() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch {
      // localStorage blockiert — Onboarding nicht anzeigen.
    }
  }, []);

  function close() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  }

  if (!open) return null;
  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ background: "rgba(6,4,14,0.8)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-[420px] overflow-hidden rounded-[18px] border p-6"
        style={{
          background: "var(--qrave-hero-gradient)",
          borderColor: "color-mix(in srgb, var(--qrave-accent) 35%, transparent)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-7 rounded-full transition-all"
                style={{
                  background: i <= step ? "var(--qrave-accent-strong)" : "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={close}
            className="text-[12px] font-medium"
            style={{ color: "rgba(242,242,242,0.5)" }}
          >
            Überspringen
          </button>
        </div>

        <div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-[12px]"
          style={{
            background: "rgba(255,255,255,0.12)",
            color: "var(--qrave-accent-soft)",
          }}
        >
          <i className={`${s.icon} text-[20px]`} />
        </div>

        <h3 className="qrave-font-display mb-2 text-[20px] font-black leading-tight">{s.title}</h3>
        <p className="mb-6 text-[13px] leading-relaxed" style={{ color: "rgba(242,242,242,0.75)" }}>
          {s.body}
        </p>

        <div className="flex items-center justify-end gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-[10px] border px-4 py-2 text-[13px] font-semibold"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(242,242,242,0.75)" }}
            >
              Zurück
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (isLast ? close() : setStep((s) => s + 1))}
            className="rounded-[10px] px-5 py-2 text-[13px] font-bold"
            style={{
              background: "var(--qrave-accent-gradient)",
              color: "#fff",
              boxShadow: "0 6px 20px rgba(147,51,234,0.4)",
            }}
          >
            {isLast ? "Los geht's" : "Weiter"}
          </button>
        </div>
      </div>
    </div>
  );
}
