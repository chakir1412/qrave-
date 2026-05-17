import Link from "next/link";
import type { PublicRestaurant } from "@/lib/load-restaurant-public";
import { getOpenStatus } from "@/lib/oeffnungszeiten";
import ShareButton from "./ShareButton";
import { LanguageButton } from "./LanguageButton";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/menu-i18n";
import { resolveBackground, type BackgroundMode } from "@/lib/template-background";

type Props = {
  restaurant: PublicRestaurant;
};

/** Splash-Seite für die Gäste-Speisekarte (qrave.menu/[slug]). Server-rendered,
 *  kein JS-State. Design synchronisiert sich mit dem gewählten Karten-Template
 *  (restaurant.template) — same 9 Variants wie die Speisekarte. */

type ThemeId =
  | "heritage" | "noir" | "clean" | "trattoria" | "minimal"
  | "playful" | "asian-dark" | "street-food" | "mediterranean";

type SplashTheme = {
  /** Hintergrund unter dem Media-Overlay; wird auch sichtbar wenn kein Hero-Bild gesetzt ist. */
  bg: string;
  /** Hauptfarbe für Headline + alles wo "Text" hin soll. */
  text: string;
  /** Sub-Texte (Adresse, Stadtteil). */
  textMuted: string;
  /** Akzent (Streifen, Link-Hover, LanguageButton). */
  accent: string;
  /** Primär-CTA Background. */
  buttonBg: string;
  /** Primär-CTA Text. */
  buttonFg: string;
  /** Sekundär-Buttons (Kontakt + Sprache): bg + border + text. */
  secondaryBg: string;
  secondaryBorder: string;
  secondaryText: string;
  /** Font-Stack für die Headline. */
  fontDisplay: string;
  /** Italic-Style für Headline (Lora/Cormorant). */
  fontItalic: boolean;
  /** "warm" für Light-Themes (Status-Badge dunklere Texte), "cool" für Dark. */
  mode: "light" | "dark";
  /** Dunkles oder helles Overlay-Tint übers Hero-Bild. */
  mediaOverlay: string;
  /** Optionaler ornamentaler Streifen oben (nur Mediterranean). */
  ornamentStripe?: string;
  /** Bei Playful: harter Button-Schadow. */
  hardShadow?: boolean;
  /** Google-Font @import-URL für die Display-Font. Optional. */
  fontImport?: string;
};

const THEMES: Record<ThemeId, SplashTheme> = {
  heritage: {
    bg: "#f5ede0",
    text: "#1c1410",
    textMuted: "rgba(28,20,16,0.55)",
    accent: "#c0580a",
    buttonBg: "#c0580a",
    buttonFg: "#fff8eb",
    secondaryBg: "rgba(28,20,16,0.05)",
    secondaryBorder: "rgba(28,20,16,0.14)",
    secondaryText: "#1c1410",
    fontDisplay: `'Lora', Georgia, ui-serif, serif`,
    fontItalic: true,
    mode: "light",
    mediaOverlay: "linear-gradient(180deg, rgba(245,237,224,0.55) 0%, rgba(245,237,224,0.92) 70%, rgba(245,237,224,1) 100%)",
    fontImport: "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;1,400;1,500&display=swap",
  },
  noir: {
    bg: "#0a0805",
    text: "rgba(255,248,235,0.92)",
    textMuted: "rgba(255,248,235,0.45)",
    accent: "#c9a84c",
    buttonBg: "#c9a84c",
    buttonFg: "#0a0805",
    secondaryBg: "rgba(255,248,235,0.04)",
    secondaryBorder: "rgba(201,168,76,0.2)",
    secondaryText: "rgba(255,248,235,0.85)",
    fontDisplay: `'Cormorant Garamond', Georgia, ui-serif, serif`,
    fontItalic: false,
    mode: "dark",
    mediaOverlay: "linear-gradient(180deg, rgba(10,8,5,0.5) 0%, rgba(10,8,5,0.85) 60%, rgba(10,8,5,1) 100%)",
    fontImport: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&display=swap",
  },
  clean: {
    bg: "#f0eeea",
    text: "#1a1a1a",
    textMuted: "rgba(26,26,26,0.55)",
    accent: "#2d6a4f",
    buttonBg: "#2d6a4f",
    buttonFg: "#ffffff",
    secondaryBg: "#ffffff",
    secondaryBorder: "#e4e1db",
    secondaryText: "#1a1a1a",
    fontDisplay: `'Playfair Display', Georgia, ui-serif, serif`,
    fontItalic: false,
    mode: "light",
    mediaOverlay: "linear-gradient(180deg, rgba(240,238,234,0.55) 0%, rgba(240,238,234,0.92) 70%, rgba(240,238,234,1) 100%)",
    fontImport: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&display=swap",
  },
  trattoria: {
    bg: "#f5ede0",
    text: "#1c1410",
    textMuted: "rgba(28,20,16,0.55)",
    accent: "#c0392b",
    buttonBg: "#c0392b",
    buttonFg: "#fff",
    secondaryBg: "#fffaf5",
    secondaryBorder: "#e8d8c4",
    secondaryText: "#1c1410",
    fontDisplay: `'Lora', Georgia, ui-serif, serif`,
    fontItalic: true,
    mode: "light",
    mediaOverlay: "linear-gradient(180deg, rgba(245,237,224,0.55) 0%, rgba(245,237,224,0.92) 70%, rgba(245,237,224,1) 100%)",
    fontImport: "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;1,400;1,500&display=swap",
  },
  minimal: {
    bg: "#ffffff",
    text: "#111111",
    textMuted: "rgba(17,17,17,0.55)",
    accent: "#111111",
    buttonBg: "#111111",
    buttonFg: "#ffffff",
    secondaryBg: "#f5f5f5",
    secondaryBorder: "#ebebeb",
    secondaryText: "#111111",
    fontDisplay: `'Inter', system-ui, -apple-system, sans-serif`,
    fontItalic: false,
    mode: "light",
    mediaOverlay: "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.92) 70%, rgba(255,255,255,1) 100%)",
    fontImport: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  },
  playful: {
    bg: "#ffe5f0",
    text: "#1a0a12",
    textMuted: "rgba(26,10,18,0.55)",
    accent: "#ff3d7f",
    buttonBg: "#ff3d7f",
    buttonFg: "#ffffff",
    secondaryBg: "#ffffff",
    secondaryBorder: "#1a0a12",
    secondaryText: "#1a0a12",
    fontDisplay: `'Syne', system-ui, sans-serif`,
    fontItalic: false,
    mode: "light",
    mediaOverlay: "linear-gradient(180deg, rgba(255,229,240,0.55) 0%, rgba(255,229,240,0.92) 70%, rgba(255,229,240,1) 100%)",
    hardShadow: true,
    fontImport: "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap",
  },
  "asian-dark": {
    bg: "#0d0d0f",
    text: "#f0eee8",
    textMuted: "rgba(240,238,232,0.45)",
    accent: "#e8282e",
    buttonBg: "#e8282e",
    buttonFg: "#ffffff",
    secondaryBg: "rgba(255,255,255,0.04)",
    secondaryBorder: "rgba(240,238,232,0.1)",
    secondaryText: "rgba(240,238,232,0.85)",
    fontDisplay: `'Noto Sans JP', system-ui, sans-serif`,
    fontItalic: false,
    mode: "dark",
    mediaOverlay: "linear-gradient(180deg, rgba(13,13,15,0.5) 0%, rgba(13,13,15,0.85) 60%, rgba(13,13,15,1) 100%)",
    fontImport: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap",
  },
  "street-food": {
    bg: "#111110",
    text: "#f5f4f0",
    textMuted: "rgba(245,244,240,0.55)",
    accent: "#e8b400",
    buttonBg: "#e8b400",
    buttonFg: "#111110",
    secondaryBg: "rgba(255,255,255,0.05)",
    secondaryBorder: "rgba(245,244,240,0.12)",
    secondaryText: "#f5f4f0",
    fontDisplay: `'Bebas Neue', Impact, system-ui, sans-serif`,
    fontItalic: false,
    mode: "dark",
    mediaOverlay: "linear-gradient(180deg, rgba(17,17,16,0.5) 0%, rgba(17,17,16,0.85) 60%, rgba(17,17,16,1) 100%)",
    fontImport: "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap",
  },
  mediterranean: {
    bg: "#faf6f0",
    text: "#2c1a0e",
    textMuted: "rgba(44,26,14,0.55)",
    accent: "#c0580a",
    buttonBg: "#c0580a",
    buttonFg: "#ffffff",
    secondaryBg: "#ffffff",
    secondaryBorder: "rgba(44,26,14,0.1)",
    secondaryText: "#2c1a0e",
    fontDisplay: `'Inter', system-ui, sans-serif`,
    fontItalic: false,
    mode: "light",
    mediaOverlay: "linear-gradient(180deg, rgba(250,246,240,0.55) 0%, rgba(250,246,240,0.92) 70%, rgba(250,246,240,1) 100%)",
    ornamentStripe: "repeating-linear-gradient(90deg, #d4613a 0px, #d4613a 12px, #c9972a 12px, #c9972a 24px, #5c8a3c 24px, #5c8a3c 36px, #c9972a 36px, #c9972a 48px)",
    fontImport: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  },
};

function getTheme(template: string | null | undefined): SplashTheme {
  if (template && template in THEMES) return THEMES[template as ThemeId];
  return THEMES.heritage;
}

function berlinTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Status-Badge: semantische Farben (grün/gelb/rot) bleiben universal,
 *  Tint-Stärke + Text-Farbe passen sich an Light/Dark-Theme an. */
function statusBadgeColors(kind: "open" | "opens-later" | "closed-today", mode: "light" | "dark") {
  const palette = {
    open: { hue: "52,232,158", dark: "#1a6b3a" },
    "opens-later": { hue: "255,193,7", dark: "#7a5a00" },
    "closed-today": { hue: "239,68,68", dark: "#8a1c1c" },
  } as const;
  const p = palette[kind];
  if (mode === "dark") {
    return {
      bg: `rgba(${p.hue},0.14)`,
      border: `rgba(${p.hue},0.4)`,
      text: "#fff",
      dot: `rgb(${p.hue})`,
    };
  }
  return {
    bg: `rgba(${p.hue},0.18)`,
    border: `rgba(${p.hue},0.5)`,
    text: p.dark,
    dot: `rgb(${p.hue})`,
  };
}

export default function SplashScreen({ restaurant }: Props) {
  const theme = getTheme(restaurant.template);
  const bgOverride = resolveBackground(
    restaurant.template,
    ((restaurant as { background_mode?: string | null }).background_mode ?? null) as BackgroundMode | null,
  );
  const mediaUrl = restaurant.splash_media_url?.trim() ?? "";
  const mediaType = restaurant.splash_media_type === "video" ? "video" : "image";
  const legacyImageUrl =
    mediaUrl.length === 0
      ? restaurant.splash_image_url?.trim() || restaurant.logo_url?.trim() || ""
      : "";
  const status = getOpenStatus(restaurant.oeffnungszeiten ?? null);

  const todayIso = berlinTodayIso();
  const overrideToday =
    restaurant.oeffnungszeiten?.heute_override &&
    restaurant.oeffnungszeiten.heute_override.date === todayIso
      ? restaurant.oeffnungszeiten.heute_override
      : null;

  const closedAreas = (restaurant.tisch_bereiche ?? [])
    .filter((b) => b?.geschlossen === true && typeof b.name === "string" && b.name.trim().length > 0)
    .map((b) => b.name.trim());

  const statusBadge = (() => {
    if (status.kind === "open") {
      const c = statusBadgeColors("open", theme.mode);
      return { ...c, label: `Geöffnet · bis ${status.closesAt}` };
    }
    if (status.kind === "opens-later") {
      const c = statusBadgeColors("opens-later", theme.mode);
      return { ...c, label: `Geschlossen · öffnet um ${status.opensAt}` };
    }
    if (status.kind === "closed-today") {
      const c = statusBadgeColors("closed-today", theme.mode);
      return { ...c, label: "Heute geschlossen" };
    }
    return null;
  })();

  const isDark = theme.mode === "dark";

  return (
    <div
      className="relative flex min-h-dvh flex-col overflow-hidden"
      style={{ background: bgOverride.bg, color: bgOverride.text, fontFamily: theme.fontDisplay }}
    >
      {theme.fontImport ? <style>{`@import url('${theme.fontImport}');`}</style> : null}

      {/* Optionaler Ornament-Streifen (nur Mediterranean) */}
      {theme.ornamentStripe ? (
        <div aria-hidden style={{ height: 6, background: theme.ornamentStripe, position: "relative", zIndex: 5 }} />
      ) : null}

      {/* Hero-Media + theme-passendes Overlay */}
      {mediaUrl.length > 0 ? (
        <>
          {mediaType === "video" ? (
            <video
              aria-hidden
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              poster={restaurant.splash_image_url?.trim() || undefined}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            >
              <source src={mediaUrl} />
            </video>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              aria-hidden
              src={mediaUrl}
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
          <div aria-hidden style={{ position: "absolute", inset: 0, background: theme.mediaOverlay }} />
        </>
      ) : legacyImageUrl.length > 0 ? (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url("${legacyImageUrl}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              filter: isDark ? "blur(2px) brightness(0.55)" : "blur(2px) brightness(1.05)",
              transform: "scale(1.05)",
            }}
          />
          <div aria-hidden style={{ position: "absolute", inset: 0, background: theme.mediaOverlay }} />
        </>
      ) : (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 50% 30%, ${theme.accent}26 0%, transparent 60%)`,
          }}
        />
      )}

      {/* Share-Button oben rechts */}
      <div className="absolute right-5 top-5 z-20" style={{ marginTop: theme.ornamentStripe ? 6 : 0 }}>
        <ShareButton restaurantName={restaurant.name} slug={restaurant.slug} />
      </div>

      {/* Inhalt */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-16 pb-6">
        {/* Akzent-Streifen oben */}
        <div className="mx-auto mb-8 h-[3px] w-16 rounded-full" style={{ background: theme.accent }} />

        {/* Restaurant-Name — Wrapper kappt Überstand, H1 skaliert clamp-responsive.
            Playful (Syne 800) ist visuell deutlich breiter pro Buchstabe —
            eigene, kleinere clamp-Range damit lange Namen nicht raus laufen. */}
        {(() => {
          const isPlayful = theme.fontDisplay.includes("Syne");
          const wrapperPadding = isPlayful ? "0 20px" : "0 24px";
          const headlineSize = isPlayful
            ? "clamp(1.4rem, 6vw, 2rem)"
            : "clamp(1.6rem, 7vw, 2.4rem)";
          return (
            <div style={{ overflow: "hidden", padding: wrapperPadding, width: "100%" }}>
              <h1
                className="text-center leading-tight tracking-tight"
                style={{
                  color: theme.text,
                  fontFamily: theme.fontDisplay,
                  fontStyle: theme.fontItalic ? "italic" : "normal",
                  fontWeight: theme.fontDisplay.includes("Bebas") ? 400 : isPlayful ? 800 : 500,
                  letterSpacing: theme.fontDisplay.includes("Bebas") ? "0.03em" : "-0.02em",
                  fontSize: headlineSize,
                  maxWidth: "100%",
                  wordBreak: "break-word",
                  margin: 0,
                }}
              >
                {restaurant.name}
              </h1>
            </div>
          );
        })()}

        {/* Stadtteil / Adresse */}
        {(restaurant.stadtbezirk?.trim() || restaurant.adresse?.trim()) ? (
          <p
            className="mt-3 text-center text-[12px] uppercase tracking-[0.18em]"
            style={{ color: theme.textMuted, fontFamily: "system-ui, sans-serif" }}
          >
            {restaurant.stadtbezirk?.trim() || restaurant.adresse?.trim()}
          </p>
        ) : null}

        {/* Öffnungsstatus */}
        {statusBadge ? (
          <div className="mt-6 flex justify-center">
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold"
              style={{
                background: statusBadge.bg,
                color: statusBadge.text,
                border: `1px solid ${statusBadge.border}`,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: statusBadge.dot }} />
              {statusBadge.label}
              {overrideToday?.grund?.trim() ? (
                <span style={{ opacity: 0.7 }}> · {overrideToday.grund.trim()}</span>
              ) : null}
            </span>
          </div>
        ) : null}

        {closedAreas.length > 0 ? (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {closedAreas.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium"
                style={{
                  background: theme.secondaryBg,
                  border: `1px solid ${theme.secondaryBorder}`,
                  color: theme.textMuted,
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                <i className="fa-solid fa-circle-info text-[10px]" style={{ opacity: 0.7 }} />
                {name} heute geschlossen
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex-1" />

        {/* Sekundär-Buttons (Kontakt + Sprache) */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/${restaurant.slug}/kontakt`}
            prefetch
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-4 py-4 text-sm font-semibold transition-colors"
            style={{
              borderColor: theme.secondaryBorder,
              background: theme.secondaryBg,
              color: theme.secondaryText,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Kontakt</span>
          </Link>

          <LanguageButton
            slug={restaurant.slug}
            activeLanguages={
              (restaurant.active_languages ?? ["de"]).filter((c): c is SupportedLocale =>
                (SUPPORTED_LOCALES as readonly string[]).includes(c),
              ) as SupportedLocale[]
            }
            accent={theme.accent}
            bg={theme.secondaryBg}
            border={theme.secondaryBorder}
            text={theme.secondaryText}
          />
        </div>

        {/* Primär-CTA */}
        <Link
          href={`/${restaurant.slug}/karte`}
          prefetch
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-bold tracking-tight active:scale-[0.98]"
          style={{
            background: theme.buttonBg,
            color: theme.buttonFg,
            boxShadow: theme.hardShadow
              ? `4px 4px 0 ${theme.text}`
              : `0 10px 30px ${theme.buttonBg}55`,
            border: theme.hardShadow ? `2px solid ${theme.text}` : "none",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Zur Speisekarte
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/* Hero-Media-Overlay nicht über Inhalt: durch z-Index oben gelöst */}
    </div>
  );
}
