import type { MenuItem } from "@/lib/supabase";

/** Unterstützte Sprachen der Gäste-Speisekarte. `de` ist die Quellsprache. */
export const SUPPORTED_LOCALES = ["de", "en", "tr", "ar", "ru", "it", "fr"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** RTL-Layout für Arabisch (dir="rtl" auf den Page-Container). */
export const RTL_LOCALES: ReadonlySet<SupportedLocale> = new Set(["ar"]);

/** Mapping DeepL-Target-Codes (manche weichen vom Browser-Locale ab). */
export const DEEPL_TARGET_BY_LOCALE: Record<Exclude<SupportedLocale, "de">, string> = {
  en: "EN-US",
  tr: "TR",
  ar: "AR",
  ru: "RU",
  it: "IT",
  fr: "FR",
};

/** UI-Label pro Sprache (Settings-Overlay). */
export const LOCALE_LABEL: Record<SupportedLocale, string> = {
  de: "Deutsch",
  en: "English",
  tr: "Türkçe",
  ar: "العربية",
  ru: "Русский",
  it: "Italiano",
  fr: "Français",
};

function isSupported(code: string): code is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(code);
}

/** Liest die bevorzugte Sprache aus dem `Accept-Language`-Header (Server)
 *  oder `navigator.language` (Client). Fallback ist immer `de`. */
export function detectLocale(headerOrNavigator: string | null | undefined): SupportedLocale {
  if (!headerOrNavigator) return "de";
  // Accept-Language kann mehrere Einträge mit q-Faktoren enthalten — wir
  // nehmen den ersten (höchste Präferenz).
  const first = headerOrNavigator.split(",")[0]?.trim().toLowerCase() ?? "";
  const short = first.split(/[-;]/)[0];
  return isSupported(short) ? short : "de";
}

/** Liefert für eine Sprache den passenden `name` und `beschreibung`.
 *  Fallback ist immer die deutsche Quelle (auch wenn die Sprach-Spalte NULL ist). */
export function resolveItemFields(
  item: MenuItem,
  locale: SupportedLocale,
): { name: string; beschreibung: string | null } {
  if (locale === "de") {
    return { name: item.name, beschreibung: item.beschreibung };
  }
  const nameKey = `name_${locale}` as keyof MenuItem;
  const descKey = `beschreibung_${locale}` as keyof MenuItem;
  const rawName = item[nameKey];
  const rawDesc = item[descKey];
  const localName = typeof rawName === "string" ? rawName.trim() : "";
  const localDesc = typeof rawDesc === "string" ? rawDesc.trim() : "";
  return {
    name: localName.length > 0 ? localName : item.name,
    beschreibung: localDesc.length > 0 ? localDesc : item.beschreibung,
  };
}

/** Wendet `resolveItemFields` auf eine Liste an und ersetzt nur die beiden
 *  Display-Felder. Alle anderen Felder (auch die Sprach-Spalten selbst)
 *  bleiben erhalten, damit Tracking, Dashboard-Snippets etc. weiterhin auf
 *  die Roh-Daten zugreifen können. */
export function localizeMenuItems(items: MenuItem[], locale: SupportedLocale): MenuItem[] {
  if (locale === "de") return items;
  return items.map((item) => {
    const r = resolveItemFields(item, locale);
    return { ...item, name: r.name, beschreibung: r.beschreibung };
  });
}
