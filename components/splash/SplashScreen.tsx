"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublicRestaurant } from "@/lib/load-restaurant-public";
import { getOpenStatus } from "@/lib/oeffnungszeiten";
import ShareButton from "./ShareButton";
import { LanguageButton } from "./LanguageButton";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/menu-i18n";
import { t } from "@/lib/i18n-menu";
import {
  deriveAccentColor,
  hexToRgb,
  isDarkHex,
  resolveBackground,
  type BackgroundMode,
} from "@/lib/template-background";

type Props = {
  restaurant: PublicRestaurant;
  /** Erste daily_push-Zeile für heute (Europe/Berlin). Wird als Pill
   *  unterhalb des Restaurant-Namens angezeigt. */
  todaySpecial?: { name: string; emoji: string | null } | null;
};

/** Splash-Seite für die Gäste-Speisekarte (qrave.menu/[slug]). Server-rendered,
 *  kein JS-State. Design synchronisiert sich mit dem gewählten Karten-Template
 *  (restaurant.template) — same 9 Variants wie die Speisekarte. */

type ThemeId =
  | "heritage" | "noir" | "clean" | "trattoria" | "minimal"
  | "playful" | "asian-dark" | "street-food" | "mediterranean" | "blossom";

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
  blossom: {
    bg: "#fdf6f0",
    text: "#3d2b1f",
    textMuted: "rgba(61,43,31,0.55)",
    accent: "#e8836a",
    buttonBg: "#e8836a",
    buttonFg: "#ffffff",
    secondaryBg: "#ffffff",
    secondaryBorder: "#f0ddd4",
    secondaryText: "#3d2b1f",
    fontDisplay: `'Lora', Georgia, ui-serif, serif`,
    fontItalic: true,
    mode: "light",
    mediaOverlay: "linear-gradient(180deg, rgba(253,246,240,0.55) 0%, rgba(253,246,240,0.92) 70%, rgba(253,246,240,1) 100%)",
    fontImport: "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;1,500;1,600&family=Nunito:wght@400;600;700;800&display=swap",
  },
};

function getTheme(template: string | null | undefined): SplashTheme {
  if (template && template in THEMES) return THEMES[template as ThemeId];
  return THEMES.heritage;
}

/** Überschreibt die Theme-Tokens mit Wirt-gewählten custom_bg/text_color.
 *  Akzent + Sekundär-Token werden aus der Helligkeit des Bg abgeleitet. */
function customizeTheme(base: SplashTheme, customBg: string, customText: string): SplashTheme {
  const accent = deriveAccentColor(customBg);
  const dark = isDarkHex(customBg);
  const rgb = hexToRgb(customBg);
  const rgbStr = rgb ? rgb.join(",") : "0,0,0";
  return {
    ...base,
    bg: customBg,
    text: customText,
    textMuted: dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
    accent,
    buttonBg: accent,
    // Button-Text in Bg-Farbe — guter Kontrast gegen den Akzent.
    buttonFg: customBg,
    secondaryBg: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
    secondaryBorder: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
    secondaryText: customText,
    mode: dark ? "dark" : "light",
    // Tint übers Hero-Media in der Bg-Farbe — saftiger Übergang zum custom Bg.
    mediaOverlay: `linear-gradient(180deg, rgba(${rgbStr},0.55) 0%, rgba(${rgbStr},0.92) 70%, rgba(${rgbStr},1) 100%)`,
  };
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

/** Per-Slug localStorage-Key — getrennt von der globalen `qrave-locale`-Variante. */
function localeStorageKey(slug: string): string {
  return `qrave_locale_${slug}`;
}

export default function SplashScreen({ restaurant, todaySpecial = null }: Props) {
  const baseTheme = getTheme(restaurant.template);
  const activeLanguages = (restaurant.active_languages ?? ["de"]).filter(
    (c): c is SupportedLocale =>
      (SUPPORTED_LOCALES as readonly string[]).includes(c),
  ) as SupportedLocale[];

  /** Locale-State: Default "de" (matched dem SSR-Markup). Effect läuft auf
   *  Mount, liest localStorage → navigator.language → fällt auf "de" zurück.
   *  Kurzes DE-Flicker beim First-Paint ist akzeptiert. */
  const [locale, setLocale] = useState<SupportedLocale>("de");
  const [wifiOpen, setWifiOpen] = useState(false);
  const [wifiCopied, setWifiCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let detected: SupportedLocale | null = null;
    try {
      const stored = window.localStorage.getItem(localeStorageKey(restaurant.slug)) as
        | SupportedLocale
        | null;
      if (stored && activeLanguages.includes(stored)) {
        detected = stored;
      }
    } catch {
      /* localStorage blockiert (Private-Mode etc.) → weiter zu navigator */
    }
    if (!detected) {
      const navLang = (navigator.language || "de").toLowerCase().split("-")[0];
      if ((activeLanguages as readonly string[]).includes(navLang)) {
        detected = navLang as SupportedLocale;
      }
    }
    setLocale(detected ?? "de");
  }, [restaurant.slug, activeLanguages]);

  function handleLocaleChange(next: SupportedLocale) {
    setLocale(next);
    try {
      window.localStorage.setItem(localeStorageKey(restaurant.slug), next);
    } catch {
      /* ignore */
    }
  }

  // Playful ignoriert custom-Farben — die Pink-CI ist konstitutiv.
  const customBgRaw = (restaurant as { custom_bg_color?: string | null }).custom_bg_color?.trim() || null;
  const customTextRaw = (restaurant as { custom_text_color?: string | null }).custom_text_color?.trim() || null;
  const useCustom = Boolean(customBgRaw && customTextRaw && restaurant.template !== "playful");
  const theme: SplashTheme =
    useCustom && customBgRaw && customTextRaw
      ? customizeTheme(baseTheme, customBgRaw, customTextRaw)
      : baseTheme;
  const bgOverride = resolveBackground(
    restaurant.template,
    ((restaurant as { background_mode?: string | null }).background_mode ?? null) as BackgroundMode | null,
    useCustom ? customBgRaw : null,
    useCustom ? customTextRaw : null,
  );
  const mediaUrl = restaurant.splash_media_url?.trim() ?? "";
  const mediaType = restaurant.splash_media_type === "video" ? "video" : "image";
  const legacyImageUrl =
    mediaUrl.length === 0
      ? restaurant.splash_image_url?.trim() || restaurant.logo_url?.trim() || ""
      : "";
  const status = getOpenStatus(restaurant.oeffnungszeiten ?? null);
  const wifiName = restaurant.wifi_name?.trim() ?? "";
  const wifiPassword = restaurant.wifi_password?.trim() ?? "";
  const hasWifi = wifiName.length > 0;

  const todayIso = berlinTodayIso();
  const overrideToday =
    restaurant.oeffnungszeiten?.heute_override &&
    restaurant.oeffnungszeiten.heute_override.date === todayIso
      ? restaurant.oeffnungszeiten.heute_override
      : null;

  const closedAreas = (restaurant.tisch_bereiche ?? [])
    .filter((b) => b?.geschlossen === true && typeof b.name === "string" && b.name.trim().length > 0)
    .map((b) => b.name.trim());

  const kitchenCloses = restaurant.kitchen_closes_at?.trim().slice(0, 5) ?? "";
  const statusBadge = (() => {
    if (status.kind === "open") {
      const c = statusBadgeColors("open", theme.mode);
      const base = `${t("open_until", locale)} ${status.closesAt}`;
      const label =
        kitchenCloses.length > 0
          ? `${base} (${t("kitchen_until", locale)} ${kitchenCloses})`
          : base;
      return { ...c, label };
    }
    if (status.kind === "opens-later") {
      const c = statusBadgeColors("opens-later", theme.mode);
      return { ...c, label: `${t("closed_today", locale)} · ${t("opens_at", locale)} ${status.opensAt}` };
    }
    if (status.kind === "closed-today") {
      const c = statusBadgeColors("closed-today", theme.mode);
      return { ...c, label: t("closed_today_full", locale) };
    }
    return null;
  })();

  const isDark = theme.mode === "dark";

  const isRtl = locale === "ar";

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      lang={locale}
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

        {/* Tages-Special-Pill */}
        {todaySpecial && todaySpecial.name.trim().length > 0 ? (
          <div className="mt-3 flex justify-center">
            <span
              className="inline-flex max-w-full items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold"
              style={{
                background: theme.secondaryBg,
                color: theme.accent,
                borderColor: theme.secondaryBorder,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              <span aria-hidden>{todaySpecial.emoji?.trim() || "✨"}</span>
              <span className="truncate">
                {t("todays_special_badge", locale).replace(/^✨\s*/, "")}: {todaySpecial.name.trim()}
              </span>
            </span>
          </div>
        ) : null}

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
                {name} {t("area_closed_today", locale)}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex-1" />

        {/* Sekundär-Buttons (Kontakt + ggf. WLAN + Sprache) */}
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: hasWifi ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))" }}
        >
          <Link
            href={`/${restaurant.slug}/kontakt`}
            prefetch
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-4 text-sm font-semibold transition-colors"
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
            <span>{t("contact", locale)}</span>
          </Link>

          {hasWifi ? (
            <button
              type="button"
              onClick={() => {
                setWifiCopied(false);
                setWifiOpen(true);
              }}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-4 text-sm font-semibold transition-colors"
              style={{
                borderColor: theme.secondaryBorder,
                background: theme.secondaryBg,
                color: theme.secondaryText,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
              <span>WLAN</span>
            </button>
          ) : null}

          <LanguageButton
            slug={restaurant.slug}
            activeLanguages={activeLanguages}
            current={locale}
            onLocaleChange={handleLocaleChange}
            accent={theme.accent}
            bg={theme.secondaryBg}
            border={theme.secondaryBorder}
            text={theme.secondaryText}
          />
        </div>

        {/* Primär-CTA */}
        <Link
          href={`/${restaurant.slug}/karte?locale=${locale}`}
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
          {t("to_menu", locale)}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/* Hero-Media-Overlay nicht über Inhalt: durch z-Index oben gelöst */}

      {hasWifi && wifiOpen ? (
        <WifiSheet
          name={wifiName}
          password={wifiPassword}
          copied={wifiCopied}
          onCopy={async () => {
            try {
              await navigator.clipboard.writeText(wifiPassword);
              setWifiCopied(true);
            } catch {
              setWifiCopied(true);
            }
          }}
          onClose={() => setWifiOpen(false)}
          theme={theme}
        />
      ) : null}
    </div>
  );
}

function WifiSheet({
  name,
  password,
  copied,
  onCopy,
  onClose,
  theme,
}: {
  name: string;
  password: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
  theme: SplashTheme;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="WLAN-Zugang"
      className="fixed inset-0 z-[1000] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-t-3xl px-5 pb-7 pt-5"
        style={{
          background: theme.bg,
          color: theme.text,
          boxShadow: "0 -16px 48px rgba(0,0,0,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: theme.textMuted }} />

        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.textMuted }}>
          WLAN
        </div>
        <div className="mb-5 text-lg font-bold" style={{ fontFamily: theme.fontDisplay, fontStyle: theme.fontItalic ? "italic" : undefined }}>
          {name}
        </div>

        {password.length > 0 ? (
          <>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: theme.textMuted }}>
              Passwort
            </div>
            <div
              className="mb-4 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-base"
              style={{ borderColor: theme.secondaryBorder, background: theme.secondaryBg, color: theme.secondaryText, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
            >
              <span className="truncate">{password}</span>
              <button
                type="button"
                onClick={onCopy}
                className="shrink-0 rounded-xl px-3 py-1.5 text-[13px] font-semibold transition-colors active:scale-[0.97]"
                style={{ background: theme.buttonBg, color: theme.buttonFg, fontFamily: "system-ui, sans-serif" }}
              >
                {copied ? "Kopiert ✓" : "Kopieren"}
              </button>
            </div>
          </>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold"
          style={{
            borderColor: theme.secondaryBorder,
            background: theme.secondaryBg,
            color: theme.secondaryText,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Schließen
        </button>
      </div>
    </div>
  );
}
