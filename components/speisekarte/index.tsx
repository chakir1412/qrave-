import type { MenuItem, DailyPush, SponsoredItem, LunchOffer } from "@/lib/supabase";

/** Shared Props der Speisekarten-Templates. Wird von jedem der 10 Templates
 *  (Heritage/Noir/Clean/Trattoria/Minimal/Playful/AsianDark/StreetFood/
 *  Mediterranean/Blossom) konsumiert und vom Karte-Route-Page-Loader
 *  (`app/[slug]/karte/page.tsx`) befüllt. */
export type SpeisekarteProps = {
  categories: string[];
  menuItems: MenuItem[];
  restaurantName: string;
  accentColor?: string;
  logoUrl?: string;
  /** Bis zu 3 Tages-Specials pro Tag. */
  dailyPushes?: DailyPush[];
  /** Öffentliche Restaurant-ID für Tier-1-Tracking */
  restaurantId?: string;
  tischNummer?: number;
  /** Gesponserte Partner-Items (lib/speisekarte-logic) */
  sponsoredItems?: SponsoredItem[];
  /** Frei-Text-Hinweis für Gäste (z. B. „Heute extra-lange Wartezeiten"). */
  guestNote?: string | null;
  /** Mittagsangebote — wenn aktuell im Zeitfenster, eigene Sektion oben. */
  lunchOffers?: LunchOffer[];
  /** Vom Wirt gewählter Hintergrund-Mode (extraLight..extraDark). Wenn null,
   *  nutzt das jeweilige Template seinen Default. */
  backgroundMode?: string | null;
  /** Vom Wirt frei gewählte Hintergrundfarbe (#rrggbb). Überschreibt
   *  background_mode wenn gesetzt. */
  customBgColor?: string | null;
  /** Vom Wirt frei gewählte Schriftfarbe (#rrggbb). */
  customTextColor?: string | null;
  /** Aktive Anzeige-Sprache der Karte (für UI-Strings + Kategorie-Übersetzung).
   *  Default "de" wenn nicht übergeben (Backward-Compat). */
  locale?: string;
};
