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
 * Design-Tokens — Restaurant-Dashboard (Qrave CI v5, lila Akzent).
 * `teal`/`or*` bleiben als Aliase aus historischen Gründen, die Werte
 * zeigen jetzt auf den lila Akzent — so propagiert das Reskinning ohne
 * Anpassung in den einzelnen Tab-Dateien.
 */
export const dash = {
  bg: "#06040e",

  /** Glass-Card */
  cardBg: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,255,255,0.07)",

  s1: "rgba(255,255,255,0.04)",
  s2: "rgba(255,255,255,0.06)",
  s3: "rgba(255,255,255,0.08)",

  teal: "#9333ea",
  orange: "#fb923c",
  blue: "#60a5fa",
  yellow: "#facc15",
  gr: "#4ade80",
  re: "#f87171",

  tx: "#f2f2f2",
  mu: "rgba(242,242,242,0.55)",
  mt: "rgba(242,242,242,0.35)",
  mi: "rgba(242,242,242,0.7)",

  bo: "rgba(255,255,255,0.07)",

  kpiLabel: "rgba(242,242,242,0.5)",

  primaryBg: "#9333ea",
  primaryFg: "#ffffff",

  secondaryBg: "rgba(255,255,255,0.06)",
  secondaryBorder: "rgba(255,255,255,0.08)",
  secondaryFg: "#ffffff",

  /** @deprecated Aliase — zeigen jetzt auf den lila Akzent. */
  or: "#9333ea",
  or2: "#a855f7",
  ord: "rgba(147,51,234,0.18)",
  orm: "rgba(147,51,234,0.4)",

  ye: "#facc15",

  chartGrid: "rgba(255,255,255,0.05)",
  chartAxis: "rgba(242,242,242,0.5)",

  navBg: "rgba(6,4,14,0.95)",
  navBorderTop: "rgba(255,255,255,0.06)",
  navInactive: "rgba(242,242,242,0.4)",

  onlineBg: "rgba(74,222,128,0.12)",
  onlineBorder: "rgba(74,222,128,0.25)",
  onlineFg: "#4ade80",

  offlineBg: "rgba(248,113,113,0.12)",
  offlineFg: "#f87171",
} as const;

/** Primär-Button (solid lila) — gemeinsam für Overlays/Tabs */
export const dashPrimaryButtonStyle = {
  background: "linear-gradient(135deg, #9333ea, #7c3aed)",
  color: "#ffffff",
  boxShadow: "0 6px 20px rgba(147,51,234,0.4)",
} as const;

export const TAB_ANIM_MS = 280;
export const TAB_ANIM_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
