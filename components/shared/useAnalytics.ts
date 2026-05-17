import { useCallback } from "react";

export type AnalyticsEvent =
  | "view_menu"
  | "tab_switch"
  | "item_impression"
  | "item_open"
  | "add_to_wishlist";

/** No-op Analytics-Hook. Echte Tracking-Implementierung läuft über
 *  `lib/tracking.ts` (Tier-0/Tier-1 mit Consent-Check). Dieser Hook bleibt
 *  als stabile API für Templates, falls View-Tracking direkt in Components
 *  benötigt wird. */
export function useAnalytics() {
  const track = useCallback((_event: AnalyticsEvent, _data?: Record<string, unknown>) => {
    // bewusst leer
  }, []);

  return { track };
}
