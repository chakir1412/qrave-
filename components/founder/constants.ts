import type { CSSProperties } from "react";

/** Glass-Cards (backdrop-filter; inline, da Tailwind das hier nicht zuverlässig abbildet). */
export const founderGlassCard: CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "0.5px solid rgba(255,255,255,0.13)",
  borderRadius: 20,
  backdropFilter: "blur(30px)",
  WebkitBackdropFilter: "blur(30px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
};

export const founderDash = {
  bg: "#070818",
  s1: "rgba(255,255,255,0.07)",
  s2: "rgba(255,255,255,0.045)",
  s3: "rgba(255,255,255,0.03)",
  card: "rgba(255,255,255,0.07)",
  or: "#FF5C1A",
  or2: "#FF7A3D",
  ord: "rgba(255,92,26,0.18)",
  orm: "rgba(255,92,26,0.34)",
  tx: "#F9F9F9",
  mu: "rgba(249,249,249,0.38)",
  mi: "rgba(249,249,249,0.62)",
  bo: "rgba(255,255,255,0.11)",
  gr: "#34E89E",
  re: "#FF4B6E",
  ye: "#FFD426",
} as const;

export type FounderMainTab = "overview" | "restaurants" | "kontakte" | "todo";
