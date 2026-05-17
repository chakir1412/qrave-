/**
 * Hintergrund-Mode pro Template. Wirt kann im Design-Tab zwischen 5 Stufen
 * wählen, von sehr hell bis sehr dunkel. Pro Template-CI sind die Bg-Töne
 * vorberechnet, Text-/Card-/Border-Farben werden je nach Helligkeit abgeleitet.
 *
 * Templates wenden das Resultat auf den Body-Wrapper an (`background` + `color`).
 * Karten/Borders bleiben rgba-basiert und passen sich dadurch dem Bg an.
 */

export type BackgroundMode = "extraLight" | "light" | "neutral" | "dark" | "extraDark";

export const BACKGROUND_MODES: ReadonlyArray<BackgroundMode> = [
  "extraLight", "light", "neutral", "dark", "extraDark",
];

export type ResolvedBackground = {
  bg: string;
  /** Haupttext */
  text: string;
  /** Sub-Text / muted */
  textMuted: string;
  /** Card-Background (für Item-Cards, Banner etc.). */
  card: string;
  /** Card-Border. */
  cardBorder: string;
  /** true = dunkles Theme, weiße Text-Variante. */
  isDark: boolean;
};

type TemplateId =
  | "heritage" | "noir" | "clean" | "trattoria" | "minimal"
  | "playful" | "asian-dark" | "street-food" | "mediterranean";

/** Bg-Werte pro Template × Mode (User-Spec). */
const BG_PER_TEMPLATE: Record<TemplateId, Record<BackgroundMode, string>> = {
  heritage:      { extraLight: "#fdf9f4", light: "#f5ede0", neutral: "#e8d8c0", dark: "#2c1a0e", extraDark: "#1a0e06" },
  noir:          { extraLight: "#1a1510", light: "#0f0c08", neutral: "#0a0805", dark: "#060402", extraDark: "#020100" },
  clean:         { extraLight: "#fdfcfa", light: "#f0eeea", neutral: "#dbd7cf", dark: "#2a2820", extraDark: "#1a1810" },
  trattoria:     { extraLight: "#fdf8f2", light: "#f5ede0", neutral: "#e8d4b8", dark: "#2c1a0e", extraDark: "#1a0e06" },
  minimal:       { extraLight: "#ffffff", light: "#f5f5f5", neutral: "#e0e0e0", dark: "#333333", extraDark: "#111111" },
  playful:       { extraLight: "#fff0f6", light: "#ffe5f0", neutral: "#ffc8e0", dark: "#3d1020", extraDark: "#1a0810" },
  "asian-dark":  { extraLight: "#1a1015", light: "#0f0a0d", neutral: "#0d0d0f", dark: "#060408", extraDark: "#020103" },
  "street-food": { extraLight: "#1a1a10", light: "#141410", neutral: "#111110", dark: "#080808", extraDark: "#020202" },
  mediterranean: { extraLight: "#fdf8f0", light: "#faf6f0", neutral: "#f0e6d8", dark: "#2c1a0e", extraDark: "#1a0e06" },
};

/** Defaults — welcher Mode entspricht dem "Out-of-the-Box"-Look pro Template? */
export const DEFAULT_MODE_PER_TEMPLATE: Record<TemplateId, BackgroundMode> = {
  heritage: "light",
  noir: "neutral",
  clean: "light",
  trattoria: "light",
  minimal: "light",
  playful: "light",
  "asian-dark": "neutral",
  "street-food": "neutral",
  mediterranean: "light",
};

/** Templates die VON HAUS AUS dunkel sind — alle ihre 5 Mode-Bg-Töne
 *  liegen im dunklen Bereich. Sie nutzen IMMER helle Schrift, egal
 *  welcher Mode gewählt ist. */
const INHERENTLY_DARK_TEMPLATES = new Set<TemplateId>([
  "noir",
  "asian-dark",
  "street-food",
]);

function darkTextFor(template: TemplateId): string {
  // Pro hellem Mode: dunkler Templates-eigener Text-Ton.
  switch (template) {
    case "heritage": return "#1A1209";
    case "clean": return "#1a1a1a";
    case "trattoria": return "#1c1410";
    case "minimal": return "#111111";
    case "playful": return "#1a0a12";
    case "mediterranean": return "#2c1a0e";
    default: return "#1a1a1a";
  }
}

function lightTextFor(template: TemplateId): string {
  // Pro dunklem Mode: heller Cream/Off-White-Ton, leicht template-getönt.
  switch (template) {
    case "heritage":
    case "trattoria":
    case "mediterranean":
      return "rgba(245,237,224,0.92)";
    case "clean":
      return "rgba(240,238,234,0.92)";
    case "minimal":
      return "#ffffff";
    case "playful":
      return "rgba(255,229,240,0.95)";
    case "noir":
      return "rgba(255,248,235,0.88)";
    case "asian-dark":
      return "#f0eee8";
    case "street-food":
      return "#f5f4f0";
  }
}

export function resolveBackground(
  templateId: string | null | undefined,
  mode: BackgroundMode | null | undefined,
): ResolvedBackground {
  const t = (templateId && templateId in BG_PER_TEMPLATE ? templateId : "minimal") as TemplateId;
  const m: BackgroundMode = mode && BACKGROUND_MODES.includes(mode) ? mode : DEFAULT_MODE_PER_TEMPLATE[t];
  const bg = BG_PER_TEMPLATE[t][m];
  // Templates die strukturell dunkel sind (Noir/AsianDark/StreetFood) sind
  // in ALLEN Modi dunkel — egal welche Stufe der Wirt wählt. Sonst (helle
  // Templates) bestimmt der Mode ob dark oder light.
  const isDark = INHERENTLY_DARK_TEMPLATES.has(t) || m === "dark" || m === "extraDark";

  if (isDark) {
    return {
      bg,
      text: lightTextFor(t),
      textMuted: "rgba(255,255,255,0.55)",
      card: "rgba(255,255,255,0.04)",
      cardBorder: "rgba(255,255,255,0.08)",
      isDark: true,
    };
  }
  return {
    bg,
    text: darkTextFor(t),
    textMuted: "rgba(0,0,0,0.55)",
    card: "rgba(0,0,0,0.03)",
    cardBorder: "rgba(0,0,0,0.08)",
    isDark: false,
  };
}

/** Labels für die UI (DesignTab-Slider). */
export const MODE_LABELS: Record<BackgroundMode, string> = {
  extraLight: "Sehr hell",
  light: "Hell",
  neutral: "Standard",
  dark: "Dunkel",
  extraDark: "Sehr dunkel",
};
