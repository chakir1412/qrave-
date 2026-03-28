import type { CSSProperties } from "react";

/** @deprecated Alte Glass-Tokens — nur falls Legacy-Imports bestehen. */
export const founderGlassCard: CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "0.5px solid rgba(255,255,255,0.13)",
  borderRadius: 20,
  padding: 20,
  backdropFilter: "blur(30px)",
  WebkitBackdropFilter: "blur(30px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
  marginBottom: 12,
};

export const founderGlassCompact: CSSProperties = {
  ...founderGlassCard,
  marginBottom: 0,
};

export const founderGlassStack: CSSProperties = {
  ...founderGlassCard,
  marginBottom: 0,
};

export const founderDash = {
  bg: "#070818",
  glass: "rgba(255,255,255,0.07)",
  s1: "rgba(255,255,255,0.07)",
  s2: "rgba(255,255,255,0.045)",
  s3: "rgba(255,255,255,0.08)",
  card: "rgba(255,255,255,0.07)",
  or: "#FF5C1A",
  or2: "#FF8C52",
  orGlow: "#FF5C1A",
  ord: "rgba(255,92,26,0.18)",
  orm: "rgba(255,92,26,0.34)",
  tx: "rgba(255,255,255,0.95)",
  mu: "rgba(255,255,255,0.35)",
  mi: "rgba(255,255,255,0.55)",
  bo: "rgba(255,255,255,0.13)",
  gr: "#34E89E",
  re: "#FF4B6E",
  ye: "#FFD426",
} as const;

export type FounderMainTab =
  | "overview"
  | "restaurants"
  | "analytics"
  | "kontakte"
  | "todo"
  | "settings";
