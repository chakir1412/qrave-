"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/lib/i18n-menu";

type ConsentValue = "accepted" | "declined";

type ConsentTheme = "default" | "warm" | "dark";

type ConsentBannerProps = {
  onConsent: (value: ConsentValue) => void;
  /** "warm" für Heritage/Clean/Blossom/Trattoria/Mediterranean (creme/sand),
   *  "dark" für Noir/AsianDark/StreetFood (dunkles Card-BG),
   *  "default" = neutrales Hell. */
  theme?: ConsentTheme;
  /** Gast-Sprache (von der Speisekarte runtergereicht). Default `"de"`. */
  locale?: string;
};

const STORAGE_KEY = "qrave_consent";
const ANIM_MS = 400;

const THEMES = {
  default: {
    panel: "#fdfcfa",
    panelBorder: "rgba(0,0,0,0.06)",
    headline: "#111111",
    subText: "#555555",
    linkColor: "#111111",
    footerLink: "#777777",
    btnBg: "#f5f2ee",
    btnBgHover: "#ece8e1",
    btnBorder: "rgba(0,0,0,0.06)",
    btnText: "#111111",
    headlineFontFamily: "inherit",
  },
  warm: {
    panel: "#F5F0E8",
    panelBorder: "rgba(200,137,78,0.25)",
    headline: "#1A1209",
    subText: "#6E665C",
    linkColor: "#1A1209",
    footerLink: "#8B7355",
    btnBg: "rgba(200,137,78,0.1)",
    btnBgHover: "rgba(200,137,78,0.18)",
    btnBorder: "rgba(200,137,78,0.3)",
    btnText: "#1A1209",
    headlineFontFamily: 'Georgia, "Times New Roman", ui-serif, serif',
  },
  dark: {
    panel: "#1a1a1d",
    panelBorder: "rgba(255,255,255,0.08)",
    headline: "#f5f5f5",
    subText: "rgba(245,245,245,0.65)",
    linkColor: "#f5f5f5",
    footerLink: "rgba(245,245,245,0.55)",
    btnBg: "rgba(255,255,255,0.08)",
    btnBgHover: "rgba(255,255,255,0.13)",
    btnBorder: "rgba(255,255,255,0.1)",
    btnText: "#f5f5f5",
    headlineFontFamily: "inherit",
  },
} as const;

export default function ConsentBanner({
  onConsent,
  theme = "default",
  locale = "de",
}: ConsentBannerProps) {
  const tokens = THEMES[theme];
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
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(raf);
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
    showToast(
      value === "accepted"
        ? t("consent_toast_accepted", locale)
        : t("consent_toast_declined", locale),
    );
  };

  if (!open) return null;

  const buttonStyle: React.CSSProperties = {
    padding: "14px 0",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    border: `1px solid ${tokens.btnBorder}`,
    background: tokens.btnBg,
    color: tokens.btnText,
    cursor: "pointer",
    transition: "background 0.15s ease",
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[950]"
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
        <div
          className="mx-auto w-full max-w-[480px] rounded-3xl shadow-[0_18px_60px_rgba(0,0,0,0.35)] overflow-hidden"
          style={{
            backgroundColor: tokens.panel,
            border: `1px solid ${tokens.panelBorder}`,
          }}
        >
          <div className="px-6 py-7" onClick={(e) => e.stopPropagation()}>
            <div
              className="text-[1.25rem] font-extrabold leading-snug"
              style={{ color: tokens.headline, fontFamily: tokens.headlineFontFamily }}
            >
              {t("help_improve", locale)}
            </div>
            <div
              className="mt-2.5 text-[0.92rem] leading-relaxed"
              style={{ color: tokens.subText }}
            >
              {t("help_improve_sub", locale)}
            </div>

            <a
              href="/datenschutz"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-[0.85rem] font-semibold"
              style={{ color: tokens.linkColor }}
            >
              {t("consent_more", locale)} →
            </a>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => decide("declined")}
                style={buttonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = tokens.btnBgHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = tokens.btnBg;
                }}
              >
                {t("consent_decline", locale)}
              </button>
              <button
                type="button"
                onClick={() => decide("accepted")}
                style={buttonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = tokens.btnBgHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = tokens.btnBg;
                }}
              >
                {t("consent_accept", locale)}
              </button>
            </div>

            <div
              className="mt-5 flex items-center justify-center gap-4 text-[0.72rem]"
              style={{ color: tokens.footerLink }}
            >
              <a
                className="underline underline-offset-4"
                href="/datenschutz"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: tokens.footerLink }}
              >
                {t("privacy_policy_link", locale)}
              </a>
              <span>·</span>
              <a
                className="underline underline-offset-4"
                href="/impressum"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: tokens.footerLink }}
              >
                {t("imprint", locale)}
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
