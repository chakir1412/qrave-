export const TEMPLATE_CARDS = [
  { id: "bar-soleil", label: "Bar Soleil", icon: "🖤" },
  { id: "kiosk-no7", label: "KIOSK No.7", icon: "🟡" },
  { id: "compound-cafe", label: "COMPOUND Café", icon: "🟤" },
  { id: "nami-sushi", label: "NAMI Sushi", icon: "🪵" },
  { id: "da-mario", label: "DA MARIO", icon: "🍕" },
  { id: "roots", label: "ROOTS", icon: "🌿" },
] as const;

/** Tailwind/CSS-Klasse für Glass-Cards (siehe globals.css) */
export const DASH_GLASS_CARD_CLASS = "dash-glass-card";

/**
 * Design-Tokens — Restaurant-Dashboard (dunkel, Glass, Teal-Akzent)
 * `or` / `ord` / `orm` bleiben als Kompatibilitäts-Aliase für Teal-Selektion.
 */
export const dash = {
  bg: "#080810",

  /** Glass-Card */
  cardBg: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,255,255,0.07)",

  s1: "rgba(255,255,255,0.04)",
  s2: "rgba(255,255,255,0.06)",
  s3: "rgba(255,255,255,0.08)",

  teal: "#00c8a0",
  orange: "#ff5c1a",
  blue: "#5b9bff",
  yellow: "#ffd426",
  gr: "#34e89e",
  re: "#ff4b6e",

  tx: "#ffffff",
  mu: "rgba(255,255,255,0.5)",
  mt: "rgba(255,255,255,0.3)",
  mi: "rgba(255,255,255,0.65)",

  bo: "rgba(255,255,255,0.07)",

  kpiLabel: "rgba(255,255,255,0.35)",

  primaryBg: "#00c8a0",
  primaryFg: "#000000",

  secondaryBg: "rgba(255,255,255,0.06)",
  secondaryBorder: "rgba(255,255,255,0.08)",
  secondaryFg: "#ffffff",

  /** @deprecated Kompatibilität: UI-Akzent = Teal */
  or: "#00c8a0",
  or2: "#00a88a",
  ord: "rgba(0,200,160,0.15)",
  orm: "rgba(0,200,160,0.35)",

  ye: "#ffd426",

  chartGrid: "rgba(255,255,255,0.04)",
  chartAxis: "rgba(255,255,255,0.25)",

  navBg: "rgba(10,10,20,0.95)",
  navBorderTop: "rgba(255,255,255,0.06)",
  navInactive: "rgba(255,255,255,0.35)",

  onlineBg: "rgba(52,232,158,0.15)",
  onlineBorder: "rgba(52,232,158,0.3)",
  onlineFg: "#34e89e",

  offlineBg: "rgba(255,75,110,0.15)",
  offlineFg: "#ff4b6e",
} as const;

/** Primär-Button (solid Teal) — gemeinsam für Overlays/Tabs */
export const dashPrimaryButtonStyle = {
  backgroundColor: dash.primaryBg,
  color: dash.primaryFg,
  boxShadow: "0 6px 20px rgba(0,200,160,0.28)",
} as const;

export const TAB_ANIM_MS = 280;
export const TAB_ANIM_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
