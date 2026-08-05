/**
 * Shared Design-Tokens für ConsentBanner + PrivacySettingsLink.
 * Beide Komponenten nutzen dieselbe visuelle Sprache (Bottom-Sheet,
 * Panel-Farben pro Theme), damit sich das Re-Open-Sheet für Widerruf
 * exakt wie der initiale Consent-Banner anfühlt.
 */

export type ConsentTheme = "default" | "warm" | "dark";

export const CONSENT_STORAGE_KEY = "qrave_consent";
export const CONSENT_ANIM_MS = 400;

export const CONSENT_THEMES = {
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
    statusActiveBg: "rgba(16,185,129,0.1)",
    statusActiveText: "#047857",
    statusInactiveBg: "rgba(107,114,128,0.12)",
    statusInactiveText: "#4b5563",
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
    statusActiveBg: "rgba(120,164,102,0.16)",
    statusActiveText: "#3F5A34",
    statusInactiveBg: "rgba(139,115,85,0.14)",
    statusInactiveText: "#6E5A44",
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
    statusActiveBg: "rgba(52,211,153,0.16)",
    statusActiveText: "#6ee7b7",
    statusInactiveBg: "rgba(255,255,255,0.08)",
    statusInactiveText: "rgba(245,245,245,0.65)",
    headlineFontFamily: "inherit",
  },
} as const;
