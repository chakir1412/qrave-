"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  open: boolean;
  onClose: () => void;
};

const FEATURES = [
  {
    icon: "fa-solid fa-wand-magic-sparkles",
    title: "Beschreibung generieren",
    body: "Claude Haiku schreibt eine kurze, appetitliche Beschreibung (max. 200 Zeichen) zu jedem Gericht. Du übernimmst sie oder passt sie an.",
  },
  {
    icon: "fa-solid fa-language",
    title: "Karte übersetzen",
    body: "Aktivierte Sprachen werden via DeepL automatisch befüllt — bestehende Übersetzungen bleiben unangetastet.",
  },
  {
    icon: "fa-solid fa-file-pdf",
    title: "PDF-Import",
    body: "Lade dein bestehendes PDF-Menü hoch — die KI extrahiert Gerichte, Preise und Kategorien.",
  },
];

const NEWS = [
  {
    badge: "Update",
    title: '"Oft zusammen bestellt" jetzt kategorie-basiert',
    body: "Speisen schlagen passende Getränke vor, Getränke schlagen passende Speisen vor — Items mit Bild zuerst.",
  },
];

export function KiInfoPanel({ open, onClose }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onEsc);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[180] flex" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="qrave-ki-panel-backdrop flex-1 cursor-default"
        style={{ background: "rgba(6,4,14,0.6)", backdropFilter: "blur(6px)" }}
      />
      <aside
        className="qrave-ki-panel relative flex w-full max-w-[420px] flex-col overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #15082e 0%, #0a0518 60%, #06040e 100%)",
          borderLeft: "1px solid color-mix(in srgb, var(--qrave-accent) 30%, transparent)",
          boxShadow: "-24px 0 48px rgba(0,0,0,0.45)",
        }}
      >
        <div
          aria-hidden
          className="qrave-ki-panel-pulse pointer-events-none absolute"
          style={{
            top: -120,
            right: -80,
            width: 360,
            height: 360,
            background: "radial-gradient(circle, color-mix(in srgb, var(--qrave-accent) 35%, transparent) 0%, transparent 65%)",
            filter: "blur(40px)",
          }}
        />

        <header className="relative flex items-center justify-between px-6 pt-6">
          <div className="flex items-center gap-3">
            <div
              className="qrave-ki-panel-icon flex h-10 w-10 items-center justify-center rounded-[12px]"
              style={{
                background: "var(--qrave-accent-gradient)",
                boxShadow: "0 8px 24px rgba(147,51,234,0.45)",
              }}
            >
              <i className="fa-solid fa-wand-magic-sparkles text-[16px] text-white" />
            </div>
            <div>
              <div className="qrave-font-display text-[18px] font-black tracking-tight">
                KI-<span style={{ color: "var(--qrave-accent-strong)" }}>Features</span>
              </div>
              <div className="text-[11px]" style={{ color: "rgba(242,242,242,0.5)" }}>
                Was die KI für deine Karte tun kann
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-9 w-9 items-center justify-center rounded-[9px] border transition"
            style={{
              borderColor: "rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(242,242,242,0.7)",
            }}
          >
            <i className="fa-solid fa-xmark text-[13px]" />
          </button>
        </header>

        <div className="relative flex-1 overflow-y-auto px-6 pb-6 pt-5">
          <p className="qrave-ki-panel-fadein mb-6 text-[13px] leading-relaxed" style={{ color: "rgba(242,242,242,0.75)" }}>
            Drei kleine Helfer im Hintergrund: Beschreibungen schreiben, Karte übersetzen, PDF importieren. Du behältst die Kontrolle — die KI schlägt vor, du entscheidest.
          </p>

          <section className="mb-6">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(242,242,242,0.45)" }}>
              Verfügbare Features
            </h3>
            <ul className="space-y-2">
              {FEATURES.map((f, i) => (
                <li
                  key={f.title}
                  className="qrave-ki-panel-fadein rounded-[12px] border px-4 py-3"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderColor: "rgba(255,255,255,0.07)",
                    animationDelay: `${120 + i * 80}ms`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]"
                      style={{
                        background: "color-mix(in srgb, var(--qrave-accent) 18%, transparent)",
                        color: "var(--qrave-accent-strong)",
                      }}
                    >
                      <i className={`${f.icon} text-[13px]`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold">{f.title}</div>
                      <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: "rgba(242,242,242,0.6)" }}>
                        {f.body}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(242,242,242,0.45)" }}>
              Was ist neu
            </h3>
            <ul className="space-y-2">
              {NEWS.map((n) => (
                <li
                  key={n.title}
                  className="rounded-[12px] border px-4 py-3"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderColor: "rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-[2px] text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        background: "color-mix(in srgb, var(--qrave-accent) 20%, transparent)",
                        color: "var(--qrave-accent-soft)",
                      }}
                    >
                      {n.badge}
                    </span>
                    <span className="text-[13px] font-semibold">{n.title}</span>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: "rgba(242,242,242,0.55)" }}>
                    {n.body}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(242,242,242,0.45)" }}>
              Direkt nutzen
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/dashboard/ki-features");
                }}
                className="flex items-center gap-3 rounded-[11px] px-4 py-3 text-left text-[13px] font-bold transition"
                style={{
                  background: "var(--qrave-accent-gradient)",
                  color: "#fff",
                  boxShadow: "0 6px 20px rgba(147,51,234,0.4)",
                }}
              >
                <i className="fa-solid fa-wand-magic-sparkles text-[13px]" />
                Beschreibung generieren
                <i className="fa-solid fa-arrow-right ml-auto text-[11px]" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/dashboard/ki-features#uebersetzen");
                }}
                className="flex items-center gap-3 rounded-[11px] border px-4 py-3 text-left text-[13px] font-bold transition"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderColor: "rgba(255,255,255,0.1)",
                  color: "var(--qrave-accent-soft)",
                }}
              >
                <i className="fa-solid fa-language text-[13px]" />
                Speisekarte übersetzen
                <i className="fa-solid fa-arrow-right ml-auto text-[11px]" />
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
