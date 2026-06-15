"use client";

import { useEffect } from "react";

type Props = {
  slug: string;
  activeLanguages: ReadonlyArray<string>;
  /** Vom Server gerenderte Locale (aus `?locale=` oder Accept-Language). */
  renderedLocale: string;
  /** True wenn `?locale=` explizit in der URL stand. */
  urlHasLocale: boolean;
};

/** Spiegelt Locale-Choice zwischen URL und `localStorage[qrave_locale_${slug}]`.
 *
 *  - URL hat `?locale=X` → persistiert X als gespeicherte Präferenz
 *  - URL hat KEIN `?locale=` → liest gespeicherte/Browser-Sprache,
 *    redirected einmalig falls die Wahl von der gerenderten Locale abweicht.
 *
 *  Kurzer Deutsch-Flash beim First-Paint ist akzeptiert. */
export function KarteLocaleSync({ slug, activeLanguages, renderedLocale, urlHasLocale }: Props) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `qrave_locale_${slug}`;

    if (urlHasLocale) {
      try {
        window.localStorage.setItem(key, renderedLocale);
      } catch {
        /* localStorage blockiert — egal, beim nächsten Besuch wird über URL erneut entschieden */
      }
      return;
    }

    let detected: string | null = null;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored && activeLanguages.includes(stored)) detected = stored;
    } catch {
      /* ignore */
    }
    if (!detected) {
      const navLang = (navigator.language || "de").toLowerCase().split("-")[0];
      if (activeLanguages.includes(navLang)) detected = navLang;
    }

    if (detected && detected !== renderedLocale) {
      window.location.replace(`/${slug}/karte?locale=${detected}`);
    }
  }, [slug, activeLanguages, renderedLocale, urlHasLocale]);

  return null;
}
