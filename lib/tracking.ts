import { isTrackingConsented } from "@/lib/consent";

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

const VISITOR_KEY = "qrave_visitor_id";
const VISITOR_CREATED_AT_KEY = "qrave_visitor_id_created_at";
/** 12 Monate in Millisekunden (DSGVO Storage-Limitation). */
const VISITOR_TTL_MS = 365 * 24 * 60 * 60 * 1000;

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
  // isTrackingConsented() prüft accepted UND version. Wenn die gespeicherte
  // Consent-Version veraltet ist (Zwecke haben sich geändert), pausiert
  // Tier-1 automatisch bis der Gast in der neuen Version bestätigt hat.
  if (!isTrackingConsented()) return;
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
  // DSGVO/TTDSG §25: Identifier-ID nur nach aktiver, versionierter
  // Einwilligung. Veraltete Consent-Version zählt wie kein Consent.
  if (!isTrackingConsented()) {
    return { visitorId: "", returnVisit: false };
  }
  try {

    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) {
      const createdAtRaw = window.localStorage.getItem(VISITOR_CREATED_AT_KEY);
      // Bestandsnutzer ohne Timestamp: jetzt setzen, ID behalten.
      if (!createdAtRaw) {
        window.localStorage.setItem(VISITOR_CREATED_AT_KEY, new Date().toISOString());
        return { visitorId: existing, returnVisit: true };
      }
      const createdAt = Date.parse(createdAtRaw);
      if (!Number.isFinite(createdAt) || Date.now() - createdAt > VISITOR_TTL_MS) {
        // Rotation: ID + Timestamp abgelaufen (oder Timestamp korrupt).
        const rotated = crypto.randomUUID();
        window.localStorage.setItem(VISITOR_KEY, rotated);
        window.localStorage.setItem(VISITOR_CREATED_AT_KEY, new Date().toISOString());
        return { visitorId: rotated, returnVisit: false };
      }
      return { visitorId: existing, returnVisit: true };
    }

    const id = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, id);
    window.localStorage.setItem(VISITOR_CREATED_AT_KEY, new Date().toISOString());
    return { visitorId: id, returnVisit: false };
  } catch {
    return { visitorId: "", returnVisit: false };
  }
}

/**
 * Widerruf: löscht visitor_id + Timestamp. Consent-Key selbst wird
 * vom Aufrufer gesetzt (declined). Getrennt gehalten damit der Widerruf
 * auch dann greift wenn der Consent-Key aus anderer Quelle geändert wird.
 */
export function deleteVisitorId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(VISITOR_KEY);
    window.localStorage.removeItem(VISITOR_CREATED_AT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Nach erneuter Zustimmung (declined → accepted) frische ID erzeugen.
 * Setzt qrave_consent NICHT — das macht der Aufrufer.
 */
export function regenerateVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    const id = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, id);
    window.localStorage.setItem(VISITOR_CREATED_AT_KEY, new Date().toISOString());
    return id;
  } catch {
    return "";
  }
}
