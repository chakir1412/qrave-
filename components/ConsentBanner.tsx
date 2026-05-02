"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ConsentValue = "accepted" | "declined";

type ConsentBannerProps = {
  onConsent: (value: ConsentValue) => void;
};

const STORAGE_KEY = "qrave_consent";
const ANIM_MS = 400;

export default function ConsentBanner({ onConsent }: ConsentBannerProps) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasChoice = useMemo(() => {
    if (typeof window === "undefined") return true;
    return Boolean(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  useEffect(() => {
    if (hasChoice) return;
    setOpen(true);
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(t);
  }, [hasChoice]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  };

  const decide = (value: ConsentValue) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
    setVisible(false);
    window.setTimeout(() => setOpen(false), ANIM_MS);
    onConsent(value);
    showToast(value === "accepted" ? "✓ Danke — nie wieder gefragt" : "Verstanden · Kein Tracking aktiv");
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[950] flex items-end justify-center"
        onClick={() => decide("declined")}
        style={{
          backgroundColor: "rgba(0,0,0,0.5)",
          opacity: visible ? 1 : 0,
          transition: `opacity ${ANIM_MS}ms ease`,
        }}
      />

      <div
        className="fixed left-0 right-0 bottom-0 z-[1000] px-4 pb-4"
        style={{
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: `transform ${ANIM_MS}ms ease`,
        }}
      >
        <div className="mx-auto w-full max-w-[560px] rounded-3xl bg-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] overflow-hidden">
          <div className="p-5" onClick={(e) => e.stopPropagation()}>
            <div className="text-[1.1rem] font-extrabold text-[#111] leading-snug">
              Hilf uns die Karte besser zu machen. 🙌
            </div>
            <div className="mt-2 text-[0.82rem] text-[#555] leading-relaxed">
              Wir speichern anonym wie du die Karte nutzt — kein Name, kein Profil, kein Standort. 🤝 Einmalig gefragt, nie wieder.
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { emoji: "🙈", title: "Kein Name", sub: "Wir wissen nicht wer du bist" },
                { emoji: "📵", title: "Kein Standort", sub: "Kein GPS, keine Adresse" },
                { emoji: "🔥", title: "Nur Beliebtheit", sub: "Welche Gerichte gerade gefragt sind" },
              ].map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-[#e8e4dc] bg-[#f7f6f2] px-3 py-3 text-center"
                >
                  <div className="text-[1.4rem]">{c.emoji}</div>
                  <div className="mt-1 text-[0.74rem] font-bold text-[#111]">{c.title}</div>
                  <div className="mt-0.5 text-[0.7rem] text-[#8a8378] leading-snug">
                    {c.sub}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="mt-4 text-[0.78rem] font-semibold text-[#111] underline underline-offset-4"
              onClick={() => window.open("/datenschutz", "_blank")}
            >
              🔍 Volle Transparenz →
            </button>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => decide("declined")}
                className="w-full"
                style={{
                  padding: "12px 0",
                  flex: 1,
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  border: "1.5px solid #ccc",
                  background: "transparent",
                  color: "#333",
                  cursor: "pointer",
                }}
              >
                Lieber nicht
              </button>
              <button
                type="button"
                onClick={() => decide("accepted")}
                className="w-full"
                style={{
                  padding: "12px 0",
                  flex: 1,
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  border: "1.5px solid #ccc",
                  background: "transparent",
                  color: "#333",
                  cursor: "pointer",
                }}
              >
                Ja, ich helfe gerne 🙌
              </button>
            </div>

            <div className="mt-4 flex items-center justify-center gap-4 text-[0.72rem] text-[#777]">
              <a className="underline underline-offset-4" href="/datenschutz" target="_blank" rel="noreferrer">
                Datenschutzerklärung
              </a>
              <span>·</span>
              <a className="underline underline-offset-4" href="/impressum" target="_blank" rel="noreferrer">
                Impressum
              </a>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className="fixed left-1/2 z-[1100] -translate-x-1/2 rounded-full px-4 py-2 text-[0.82rem] font-semibold"
          style={{
            bottom: 88,
            backgroundColor: "#111",
            color: "#fff",
            boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}

