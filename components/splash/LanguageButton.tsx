"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_LABEL, SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/menu-i18n";

const LOCALE_FLAG: Record<SupportedLocale, string> = {
  de: "🇩🇪",
  en: "🇬🇧",
  tr: "🇹🇷",
  ar: "🇸🇦",
  ru: "🇷🇺",
  it: "🇮🇹",
  fr: "🇫🇷",
};

type Props = {
  slug: string;
  activeLanguages: SupportedLocale[];
  accent: string;
};

const STORAGE_KEY = "qrave-locale";

export function LanguageButton({ slug, activeLanguages, accent }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<SupportedLocale>("de");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as SupportedLocale | null;
      if (stored && activeLanguages.includes(stored)) setCurrent(stored);
    } catch {
      // ignore
    }
  }, [activeLanguages]);

  function selectLocale(locale: SupportedLocale) {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore
    }
    setCurrent(locale);
    setOpen(false);
    router.push(`/${slug}/karte?locale=${locale}`);
  }

  // Wenn nur eine Sprache aktiv ist, Button funktioniert wie ein Link zur Karte.
  const onlyOne = activeLanguages.length <= 1;

  return (
    <>
      <button
        type="button"
        onClick={() => (onlyOne ? router.push(`/${slug}/karte`) : setOpen(true))}
        className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-4 py-4 text-sm font-semibold transition-colors active:bg-white/[0.04]"
        style={{
          borderColor: "rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.04)",
          color: "#fff",
        }}
        aria-label="Sprache wählen"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" strokeLinecap="round" />
        </svg>
        <span>{LOCALE_LABEL[current]}</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[200] flex items-end justify-center px-4 sm:items-center"
          style={{ background: "rgba(6,4,14,0.78)", backdropFilter: "blur(8px)" }}
        >
          <button
            type="button"
            aria-label="Schließen"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <div
            className="relative w-full max-w-[360px] overflow-hidden rounded-[18px] border bg-black/40 p-5"
            style={{ borderColor: "rgba(255,255,255,0.14)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-[18px] font-light tracking-tight" style={{ color: "#fff" }}>
                Sprache wählen
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[14px] font-medium"
                style={{ color: "rgba(255,255,255,0.6)" }}
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
            <ul className="flex flex-col gap-1.5">
              {(SUPPORTED_LOCALES as readonly SupportedLocale[])
                .filter((l) => activeLanguages.includes(l))
                .map((locale) => {
                  const active = current === locale;
                  return (
                    <li key={locale}>
                      <button
                        type="button"
                        onClick={() => selectLocale(locale)}
                        className="flex w-full items-center gap-3 rounded-[12px] border px-4 py-3 text-left transition active:scale-[0.98]"
                        style={{
                          borderColor: active ? accent : "rgba(255,255,255,0.1)",
                          background: active ? `${accent}15` : "rgba(255,255,255,0.04)",
                          color: "#fff",
                        }}
                      >
                        <span className="text-[22px] leading-none">{LOCALE_FLAG[locale]}</span>
                        <span className="flex-1 text-[14px] font-semibold">{LOCALE_LABEL[locale]}</span>
                        {active ? (
                          <span style={{ color: accent, fontSize: 14 }}>●</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
