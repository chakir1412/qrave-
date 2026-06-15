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
  /** Käuferorientierte Felder — nur bei item_detail. */
  itemPrice?: number | null;
  itemTags?: string[];
  beverageSubcategory?: string | null;
  /** Preis-Bucket aus itemPrice (budget/mid/premium). Bei item_detail
   *  und wishlist_add gesetzt. */
  priceBucket?: "budget" | "mid" | "premium" | null;
};

const CONSENT_KEY = "qrave_consent";

/** Preis-Bucket aus EUR-Preis ableiten. Mid umfasst 5,00–15,00 inkl. */
export function priceBucketFromEur(
  price: number | null | undefined,
): "budget" | "mid" | "premium" | null {
  if (price == null || !Number.isFinite(price) || price < 0) return null;
  if (price < 5) return "budget";
  if (price <= 15) return "mid";
  return "premium";
}

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
      body: JSON.stringify({ ...params, tier: 1, consentGiven: true }),
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

/**
 * Persistente Browser-Identifier-ID für `return_visit`-Tracking.
 *
 * Anders als `qrave_session` (sessionStorage, pro Tab) liegt diese ID
 * in `localStorage` und überlebt Tab-Schließungen, Page-Reloads und
 * Browser-Neustarts. Dadurch kann der Server entscheiden, ob ein
 * Besucher schon mal da war.
 *
 * Tier-0: kein Consent für die reine localStorage-Speicherung nötig
 * (technisch notwendige, anonyme Identifier-ID, kein Cross-Site-Tracking).
 * Das **Übermitteln** an den Server bleibt aber Tier-1: passiert nur
 * über `trackEvent()`, das vorher `qrave_consent === 'accepted'` prüft.
 *
 * Rückgabe: `{ visitorId, returnVisit }`. `returnVisit` ist `true`,
 * wenn die ID beim Aufruf bereits in localStorage existierte.
 */
export function getOrCreateVisitorId(): { visitorId: string; returnVisit: boolean } {
  if (typeof window === "undefined") return { visitorId: "", returnVisit: false };
  try {
    // DSGVO/TTDSG §25: Identifier-ID nur nach aktiver Einwilligung schreiben.
    // Ohne Consent darf weder gelesen noch geschrieben werden.
    if (window.localStorage.getItem(CONSENT_KEY) !== "accepted") {
      return { visitorId: "", returnVisit: false };
    }
    const key = "qrave_visitor_id";
    const existing = window.localStorage.getItem(key);
    if (existing) return { visitorId: existing, returnVisit: true };
    const id = crypto.randomUUID();
    window.localStorage.setItem(key, id);
    return { visitorId: id, returnVisit: false };
  } catch {
    return { visitorId: "", returnVisit: false };
  }
}
