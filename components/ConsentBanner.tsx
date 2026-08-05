"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n-menu";
import {
  CONSENT_ANIM_MS as ANIM_MS,
  CONSENT_THEMES,
  type ConsentTheme,
} from "@/lib/consent-theme";
import {
  hasValidStoredChoice,
  logConsent,
  writeConsentDecision,
  type ConsentValue,
} from "@/lib/consent";

type ConsentBannerProps = {
  onConsent: (value: ConsentValue) => void;
  /** Restaurant-UUID für den serverseitigen Consent-Log. Fehlt sie
   *  (z. B. während Preview-Rendering ohne DB-Kontext), wird lokal
   *  gespeichert aber kein Server-Log-Eintrag erzeugt. */
  restaurantId?: string;
  /** "warm" für Heritage/Clean/Blossom/Trattoria/Mediterranean (creme/sand),
   *  "dark" für Noir/AsianDark/StreetFood (dunkles Card-BG),
   *  "default" = neutrales Hell. */
  theme?: ConsentTheme;
  /** Gast-Sprache (von der Speisekarte runtergereicht). Default `"de"`. */
  locale?: string;
};

export default function ConsentBanner({
  onConsent,
  restaurantId,
  theme = "default",
  locale = "de",
}: ConsentBannerProps) {
  const tokens = CONSENT_THEMES[theme];
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // hasValidStoredChoice() prüft Wert + Version. Wenn die gespeicherte
  // Consent-Version nicht mehr aktuell ist (Zwecke geändert), gilt die
  // alte Wahl als abgelaufen und der Banner erscheint erneut.
  useEffect(() => {
    if (hasValidStoredChoice()) return;
    // Erst open, dann im nächsten Frame visible — genug Zeit für den
    // initialen Render mit visible=false, damit die Slide-in-Transition
    // greift. Kein doppeltes rAF: einige Desktop-Browser fassen die
    // beiden Frames zu einem Layout-Pass zusammen und die Transition
    // wird geskippt, was den Banner unsichtbar erscheinen lässt.
    setOpen(true);
    const timer = window.setTimeout(() => setVisible(true), 16);
    return () => window.clearTimeout(timer);
  }, []);

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
    writeConsentDecision(value);
    // Nur granted geht in den Consent-Log — initialer Decline wird nicht
    // protokolliert (nichts wurde erteilt, es gibt nichts nachzuweisen).
    // Ohne restaurantId (Preview-Rendering ohne DB-Kontext) wird lokal
    // gespeichert aber kein Server-Log-Eintrag erzeugt.
    if (value === "accepted" && restaurantId) {
      void logConsent({ restaurantId, action: "granted", locale });
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
  if (typeof document === "undefined") return null;

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

  // Portal in document.body: sonst positioniert eine transform/will-change-
  // Vorfahre (siehe app/[slug]/karte/template.tsx `.qrave-slide-up-in`) den
  // position:fixed-Wrapper relativ zum Vorfahren statt zum Viewport — das
  // Overlay füllt dann die Seite statt das Fenster und das Panel liegt am
  // Seiten-Ende außerhalb des sichtbaren Bereichs.
  return createPortal(
    <>
      <div
        onClick={() => decide("declined")}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          zIndex: 2147483646,
          backgroundColor: "rgba(0,0,0,0.5)",
          opacity: visible ? 1 : 0,
          transition: `opacity ${ANIM_MS}ms ease`,
        }}
      />

      <div
        className="px-4 pb-4"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2147483647,
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
          className="rounded-full px-4 py-2 text-[0.82rem] font-semibold"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 88,
            transform: "translateX(-50%)",
            zIndex: 2147483647,
            backgroundColor: "#111",
            color: "#fff",
            boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
          }}
        >
          {toast}
        </div>
      )}
    </>,
    document.body,
  );
}
