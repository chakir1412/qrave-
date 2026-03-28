import { useCallback } from "react";

export type AnalyticsEvent =
  | "view_menu"
  | "tab_switch"
  | "item_impression"
  | "item_open"
  | "add_to_wishlist";

export function useAnalytics() {
  const track = useCallback((event: AnalyticsEvent, data?: Record<string, unknown>) => {
    if (typeof window === "undefined") return;
    // Platzhalter: später an echtes Tracking (Supabase, PostHog, etc.) anbinden
    // console.debug("[analytics]", event, data);
  }, []);

  return { track };
}

