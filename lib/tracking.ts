export type TrackEventParams = {
  restaurantId: string;
  tischNummer?: number;
  sessionId: string;
  eventType:
    | "item_view"
    | "item_detail"
    | "item_detail_duration"
    | "wishlist_add"
    | "wishlist_remove"
    | "category_enter"
    | "category_leave"
    | "tab_switch"
    | "filter_set"
    | "scroll_depth"
    | "ad_view"
    | "ad_click"
    | "ad_detail"
    | "session_end"
    | "bounce";
  itemId?: string;
  itemName?: string;
  kategorie?: string;
  mainTab?: string;
  filterKey?: string;
  durationSeconds?: number;
  scrollPct?: number;
  partnerName?: string;
  produkt?: string;
  adPosition?: string;
  sessionDuration?: number;
  returnVisit?: boolean;
  bounce?: boolean;
};

const CONSENT_KEY = "qrave_consent";

export async function trackEvent(params: TrackEventParams): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(CONSENT_KEY) !== "accepted") return;
  } catch {
    return;
  }
  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, tier: 1 }),
    });
  } catch {
    /* Tracking-Fehler nie crashen lassen */
  }
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const key = "qrave_session";
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.sessionStorage.setItem(key, id);
    return id;
  } catch {
    return "";
  }
}
