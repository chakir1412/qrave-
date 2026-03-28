export const TEMPLATE_CARDS = [
  { id: "bar-soleil", label: "Bar Soleil", icon: "🖤" },
  { id: "kiosk-no7", label: "KIOSK No.7", icon: "🟡" },
  { id: "compound-cafe", label: "COMPOUND Café", icon: "🟤" },
  { id: "nami-sushi", label: "NAMI Sushi", icon: "🪵" },
  { id: "da-mario", label: "DA MARIO", icon: "🍕" },
  { id: "roots", label: "ROOTS", icon: "🌿" },
] as const;

/** Design-Tokens (Qrave Dashboard dunkel) */
export const dash = {
  bg: "#0a0a0a",
  s1: "#141414",
  s2: "#1c1c1c",
  s3: "#242424",
  or: "#E85002",
  or2: "#F16001",
  ord: "rgba(232,80,2,0.12)",
  orm: "rgba(232,80,2,0.28)",
  tx: "#F9F9F9",
  mu: "rgba(249,249,249,0.38)",
  mi: "rgba(249,249,249,0.62)",
  bo: "rgba(249,249,249,0.07)",
  gr: "#4caf7d",
  re: "#e05c5c",
  ye: "#f0b429",
} as const;

export const TAB_ANIM_MS = 280;
export const TAB_ANIM_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
