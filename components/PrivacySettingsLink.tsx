"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck } from "lucide-react";
import { t } from "@/lib/i18n-menu";
import {
  CONSENT_ANIM_MS as ANIM_MS,
  CONSENT_THEMES,
  type ConsentTheme,
} from "@/lib/consent-theme";
import { deleteVisitorId, regenerateVisitorId } from "@/lib/tracking";
import {
  CONSENT_STORAGE_KEY,
  logConsent,
  writeConsentDecision,
  type ConsentValue,
} from "@/lib/consent";

type Props = {
  /** Restaurant-UUID für den serverseitigen Consent-Log. Fehlt sie,
   *  wird lokal gespeichert aber kein Server-Log-Eintrag erzeugt. */
  restaurantId?: string;
  /** "warm" für Heritage/Clean/Blossom/Trattoria/Mediterranean,
   *  "dark" für Noir/AsianDark/StreetFood,
   *  "default" = neutrales Hell. */
  theme?: ConsentTheme;
  /** Gast-Sprache. Default `"de"`. */
  locale?: string;
  /** Farbe des Footer-Links (fügt sich in bestehende COL.muted-Palette ein). */
  color?: string;
};

const VISITOR_KEY = "qrave_visitor_id";

export default function PrivacySettingsLink({
  restaurantId,
  theme = "default",
  locale = "de",
  color,
}: Props) {
  const tokens = CONSENT_THEMES[theme];
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [consent, setConsent] = useState<ConsentValue | null>(null);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readConsent = (): ConsentValue | null => {
    try {
      const v = window.localStorage.getItem(CONSENT_STORAGE_KEY);
      return v === "accepted" || v === "declined" ? v : null;
    } catch {
      return null;
    }
  };

  const readVisitorId = (): string | null => {
    try {
      const v = window.localStorage.getItem(VISITOR_KEY);
      return v && v.length > 0 ? v : null;
    } catch {
      return null;
    }
  };

  const openSheet = () => {
    setConsent(readConsent());
    setVisitorId(readVisitorId());
    setCopyState("idle");
    setOpen(true);
    // 16 ms Delay statt rAF-Kette: einige Desktop-Browser fassen
    // aufeinanderfolgende Frames zusammen und die Slide-in-Transition
    // wird geskippt.
    window.setTimeout(() => setVisible(true), 16);
  };

  const closeSheet = () => {
    setVisible(false);
    window.setTimeout(() => setOpen(false), ANIM_MS);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  };

  const revoke = () => {
    writeConsentDecision("declined");
    deleteVisitorId();
    setVisitorId(null);
    if (restaurantId) void logConsent({ restaurantId, action: "withdrawn", locale });
    setConsent("declined");
    showToast(t("privacy_toast_revoked", locale));
    closeSheet();
  };

  const grant = () => {
    writeConsentDecision("accepted");
    const freshId = regenerateVisitorId();
    setVisitorId(freshId || null);
    if (restaurantId) void logConsent({ restaurantId, action: "granted", locale });
    setConsent("accepted");
    showToast(t("privacy_toast_granted", locale));
    closeSheet();
  };

  const copyVisitorId = async () => {
    if (!visitorId) return;
    try {
      await navigator.clipboard.writeText(visitorId);
    } catch {
      // Fallback: nichts weiter — Kopieren kann verweigert werden.
      return;
    }
    setCopyState("copied");
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyState("idle"), 1600);
  };

  const linkColor = color ?? tokens.footerLink;
  const isActive = consent === "accepted";
  const hasChoice = consent !== null;

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: "transparent",
          border: "none",
          padding: 0,
          margin: 0,
          font: "inherit",
          color: linkColor,
          cursor: "pointer",
          textDecoration: "none",
        }}
        aria-label={t("privacy_settings", locale)}
      >
        <ShieldCheck size={12} strokeWidth={1.8} aria-hidden />
        <span>{t("privacy_settings", locale)}</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <>
          <div
            onClick={closeSheet}
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
                  style={{
                    color: tokens.headline,
                    fontFamily: tokens.headlineFontFamily,
                  }}
                >
                  {t("privacy_settings", locale)}
                </div>

                {hasChoice && (
                  <div
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.78rem] font-semibold"
                    style={{
                      backgroundColor: isActive
                        ? tokens.statusActiveBg
                        : tokens.statusInactiveBg,
                      color: isActive
                        ? tokens.statusActiveText
                        : tokens.statusInactiveText,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: isActive
                          ? tokens.statusActiveText
                          : tokens.statusInactiveText,
                      }}
                      aria-hidden
                    />
                    {isActive
                      ? t("consent_status_accepted", locale)
                      : t("consent_status_declined", locale)}
                  </div>
                )}

                <div
                  className="mt-4 text-[0.92rem] leading-relaxed"
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

                {/* Betroffenenrechte (Art. 11 DSGVO): visitor_id anzeigen
                    damit der Gast per E-Mail Auskunft/Löschung anfragen kann. */}
                <div
                  className="mt-5 rounded-2xl px-4 py-3"
                  style={{
                    backgroundColor: tokens.btnBg,
                    border: `1px solid ${tokens.btnBorder}`,
                  }}
                >
                  <div
                    className="text-[0.8rem] font-semibold"
                    style={{ color: tokens.headline }}
                  >
                    {t("your_data", locale)}
                  </div>
                  {visitorId ? (
                    <>
                      <div className="mt-2 flex items-center gap-2">
                        <code
                          className="flex-1 truncate text-[0.72rem]"
                          style={{
                            color: tokens.subText,
                            fontFamily:
                              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          }}
                          title={visitorId}
                        >
                          {visitorId}
                        </code>
                        <button
                          type="button"
                          onClick={copyVisitorId}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            border: `1px solid ${tokens.btnBorder}`,
                            background: tokens.panel,
                            color: tokens.btnText,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {copyState === "copied"
                            ? t("copied", locale)
                            : t("copy", locale)}
                        </button>
                      </div>
                      <div
                        className="mt-2 text-[0.72rem] leading-relaxed"
                        style={{ color: tokens.subText }}
                      >
                        {t("your_data_desc", locale)}
                      </div>
                    </>
                  ) : (
                    <div
                      className="mt-1 text-[0.72rem] leading-relaxed"
                      style={{ color: tokens.subText }}
                    >
                      {t("your_data_none", locale)}
                    </div>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={closeSheet}
                    style={{
                      padding: "14px 0",
                      borderRadius: 10,
                      fontSize: 15,
                      fontWeight: 600,
                      border: `1px solid ${tokens.btnBorder}`,
                      background: tokens.btnBg,
                      color: tokens.btnText,
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = tokens.btnBgHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = tokens.btnBg;
                    }}
                  >
                    {t("close", locale)}
                  </button>
                  {isActive ? (
                    <button
                      type="button"
                      onClick={revoke}
                      style={{
                        padding: "14px 0",
                        borderRadius: 10,
                        fontSize: 15,
                        fontWeight: 600,
                        border: `1px solid ${tokens.btnBorder}`,
                        background: tokens.btnBg,
                        color: tokens.btnText,
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = tokens.btnBgHover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = tokens.btnBg;
                      }}
                    >
                      {t("revoke_consent", locale)}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={grant}
                      style={{
                        padding: "14px 0",
                        borderRadius: 10,
                        fontSize: 15,
                        fontWeight: 600,
                        border: `1px solid ${tokens.btnBorder}`,
                        background: tokens.btnBg,
                        color: tokens.btnText,
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = tokens.btnBgHover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = tokens.btnBg;
                      }}
                    >
                      {t("grant_consent", locale)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}

      {toast && typeof document !== "undefined" && createPortal(
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
        </div>,
        document.body,
      )}
    </>
  );
}
