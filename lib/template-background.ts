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
  | "playful" | "asian-dark" | "street-food" | "mediterranean" | "blossom";

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
  blossom:       { extraLight: "#fffaf5", light: "#fdf6f0", neutral: "#f4e4d6", dark: "#3d2b1f", extraDark: "#2a1d14" },
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
  blossom: "light",
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
    case "blossom": return "#3d2b1f";
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
    case "blossom":
      return "rgba(253,246,240,0.92)";
  }
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const m6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (m6) return [parseInt(m6[1], 16), parseInt(m6[2], 16), parseInt(m6[3], 16)];
  const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex.trim());
  if (m3) {
    return [
      parseInt(m3[1] + m3[1], 16),
      parseInt(m3[2] + m3[2], 16),
      parseInt(m3[3] + m3[3], 16),
    ];
  }
  return null;
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((n) => clamp255(n).toString(16).padStart(2, "0")).join("");
}

/** Average der RGB-Werte. < 128 = dunkel. Akzeptiert #rgb und #rrggbb. */
export function isDarkHex(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  return (rgb[0] + rgb[1] + rgb[2]) / 3 < 128;
}

/** Hellt einen dunklen Hex auf bzw. dunkelt einen hellen ab — uniform
 *  pro RGB-Kanal, geclampt auf 0–255. Für Card-/Border-Töne aus dem Bg. */
export function lightenOrDarken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const delta = isDarkHex(hex) ? amount : -amount;
  return rgbToHex(rgb[0] + delta, rgb[1] + delta, rgb[2] + delta);
}

/** Abgeleitete Akzentfarbe: Gold für dunkle Hintergründe, Terrakotta für helle. */
export function deriveAccentColor(bgHex: string): string {
  return isDarkHex(bgHex) ? "#c9a84c" : "#c0580a";
}

/** HSL-Konversion (Werte: h 0–360, s/l 0–1). */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rN) h = ((gN - bN) / d + (gN < bN ? 6 : 0)) * 60;
    else if (max === gN) h = ((bN - rN) / d + 2) * 60;
    else h = ((rN - gN) / d + 4) * 60;
  }
  return { h, s, l };
}

/** Template-spezifische 4er-Akzentpaletten — pro CI kuratiert.
 *  Reihenfolge: meist [weiss, dunkel, brand-haupt, brand-variant]. */
const ACCENT_SUGGESTIONS_PER_TEMPLATE: Record<TemplateId, ReadonlyArray<string>> = {
  heritage:      ["#ffffff", "#1a1a1a", "#c8a96e", "#c0580a"],
  noir:          ["#ffffff", "#c9a84c", "#b8860b", "#888888"],
  clean:         ["#ffffff", "#1a1a1a", "#2d6a4f", "#4a9a6f"],
  trattoria:     ["#ffffff", "#1a1a1a", "#c0392b", "#e8724a"],
  minimal:       ["#ffffff", "#1a1a1a", "#555555", "#888888"],
  playful:       ["#ffffff", "#ff1493", "#ff69b4", "#1a1a1a"],
  "asian-dark":  ["#ffffff", "#e8282e", "#ff6b6b", "#ffd700"],
  "street-food": ["#ffffff", "#f5c842", "#ff6b00", "#1a1a1a"],
  mediterranean: ["#ffffff", "#1a1a1a", "#c0603e", "#e8845a"],
  blossom:       ["#ffffff", "#3d2b1f", "#e8836a", "#c86040"],
};

/** Liefert die 4 Akzent-Vorschläge fürs aktuelle Template. Wenn `templateId`
 *  nicht bekannt: Fallback auf bg-derivierte Logik (Weiss/Schwarz/Gold +
 *  semantischer 4er aus dem Hue-Bucket). */
export function suggestAccentColors(templateId: string | null | undefined, bg: string): string[] {
  if (templateId && templateId in ACCENT_SUGGESTIONS_PER_TEMPLATE) {
    return [...ACCENT_SUGGESTIONS_PER_TEMPLATE[templateId as TemplateId]];
  }

  const fixed = ["#ffffff", "#111110", "#c9a84c"];
  const rgb = hexToRgb(bg);
  if (!rgb) return [...fixed, "#c0580a"];
  const { h, s, l } = rgbToHsl(rgb[0], rgb[1], rgb[2]);

  // Schwarz/Anthrazit oder dunkles Grau → Creme
  if (l < 0.1 || (s < 0.15 && l < 0.4)) return [...fixed, "#f0eee8"];
  // Hell/Weiß/Creme → Terrakotta
  if (l > 0.85) return [...fixed, "#c0580a"];
  // Hellgrau (mid-light, niedrige Sättigung) → Blau
  if (s < 0.15 && l > 0.5) return [...fixed, "#2980b9"];

  // Klassifizierung nach Hue für gesättigte Farben
  // Rot / Weinrot
  if (h >= 345 || h < 15) {
    return [...fixed, l < 0.45 ? "#e8c97a" : "#c0580a"];
  }
  // Orange / Braun / Warm
  if (h < 70) return [...fixed, "#c0580a"];
  // Grün
  if (h < 170) return [...fixed, "#4ade80"];
  // Blau / Navy
  if (h < 260) return [...fixed, "#60a5fa"];
  // Lila / Magenta → Default
  return [...fixed, "#c0580a"];
}

export function resolveBackground(
  templateId: string | null | undefined,
  mode: BackgroundMode | null | undefined,
  customBg?: string | null,
  customText?: string | null,
): ResolvedBackground {
  const t = (templateId && templateId in BG_PER_TEMPLATE ? templateId : "minimal") as TemplateId;

  // Custom-Override: Wirt hat eigene Hintergrund-/Schriftfarbe gewählt.
  if (customBg || customText) {
    const bg = customBg ?? BG_PER_TEMPLATE[t][DEFAULT_MODE_PER_TEMPLATE[t]];
    const isDark = isDarkHex(bg);
    return {
      bg,
      text: customText ?? (isDark ? lightTextFor(t) : darkTextFor(t)),
      textMuted: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
      card: lightenOrDarken(bg, 20),
      cardBorder: lightenOrDarken(bg, 35),
      isDark,
    };
  }

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
      card: lightenOrDarken(bg, 20),
      cardBorder: lightenOrDarken(bg, 35),
      isDark: true,
    };
  }
  return {
    bg,
    text: darkTextFor(t),
    textMuted: "rgba(0,0,0,0.55)",
    card: lightenOrDarken(bg, 20),
    cardBorder: lightenOrDarken(bg, 35),
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
