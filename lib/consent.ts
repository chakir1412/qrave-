/**
 * Consent-Versionierung + Consent-ID + Server-Log-Client.
 *
 * DSGVO Art. 7 Abs. 1 (Nachweispflicht) verlangt dass wir jede Einwilligung
 * und jeden Widerruf serverseitig festhalten — localStorage allein reicht
 * rechtlich nicht. Dieses Modul hält:
 *   - CURRENT_CONSENT_VERSION: Bump wenn sich Zwecke ändern → Re-Consent.
 *   - consent_id: pseudonyme Kennung ausschließlich für den Consent-Log.
 *     Getrennt von visitor_id gehalten (Zweckentkopplung: das Log muss
 *     auch nach visitor_id-Löschung Bestand haben).
 *   - logConsent(): Fire-and-forget-Request an POST /api/consent.
 */

/**
 * Version erhöhen wenn sich Zwecke ändern — z.B. wenn Werbe-Placements /
 * Datenweitergabe hinzukommen (dann v3-YYYY-MM). Bei Bump verfällt jede
 * gespeicherte Wahl (accepted/declined) und der Banner erscheint erneut,
 * bis der Gast die neuen Zwecke bestätigt.
 *
 * Änderungshistorie:
 *   v2-2026-07 (2026-07-17): Erste versionierte Fassung.
 *     Zwecke: analytics=true (Gerichte + Kategorien pseudonym messen),
 *     advertising=false (Werbe-Placements aktuell nicht aktiv).
 */
export const CURRENT_CONSENT_VERSION = "v2-2026-07";

export const CURRENT_CONSENT_PURPOSES = {
  analytics: true,
  advertising: false,
} as const;

export const CONSENT_STORAGE_KEY = "qrave_consent";
export const CONSENT_VERSION_STORAGE_KEY = "qrave_consent_version";
export const CONSENT_ID_STORAGE_KEY = "qrave_consent_id";

export type ConsentAction = "granted" | "withdrawn";
export type ConsentValue = "accepted" | "declined";

/** Client-seitige Prüfung: Gilt die gespeicherte Wahl noch (Version aktuell)? */
export function hasValidStoredChoice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    const version = window.localStorage.getItem(CONSENT_VERSION_STORAGE_KEY);
    return (
      (v === "accepted" || v === "declined") &&
      version === CURRENT_CONSENT_VERSION
    );
  } catch {
    return false;
  }
}

/** Prüft ob aktive, versionierte Zustimmung vorliegt (für Tier-1-Gate). */
export function isTrackingConsented(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(CONSENT_STORAGE_KEY) === "accepted" &&
      window.localStorage.getItem(CONSENT_VERSION_STORAGE_KEY) === CURRENT_CONSENT_VERSION
    );
  } catch {
    return false;
  }
}

/**
 * Consent-ID: pseudonyme Kennung, ausschließlich für den Consent-Log.
 * Beim ersten Consent-Event erzeugt, danach persistent in localStorage.
 * NICHT identisch mit qrave_visitor_id — bewusste Zweckentkopplung.
 */
export function getOrCreateConsentId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(CONSENT_ID_STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(CONSENT_ID_STORAGE_KEY, id);
    return id;
  } catch {
    return "";
  }
}

/** Schreibt Wahl + Version in localStorage. */
export function writeConsentDecision(value: ConsentValue): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
    window.localStorage.setItem(CONSENT_VERSION_STORAGE_KEY, CURRENT_CONSENT_VERSION);
  } catch {
    // ignore
  }
}

/**
 * Serverseitiges Consent-Log via POST /api/consent (fire-and-forget).
 * Nur granted + withdrawn werden geloggt — initialer Decline bekommt
 * keinen Log-Eintrag (nichts wurde erteilt, nichts wurde entzogen).
 */
export async function logConsent(params: {
  restaurantId: string;
  action: ConsentAction;
  locale?: string | null;
}): Promise<void> {
  if (typeof window === "undefined") return;
  const consentId = getOrCreateConsentId();
  if (!consentId) return;
  try {
    await fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consentId,
        restaurantId: params.restaurantId,
        consentVersion: CURRENT_CONSENT_VERSION,
        purposes: CURRENT_CONSENT_PURPOSES,
        action: params.action,
        locale: params.locale ?? null,
      }),
      keepalive: true,
    });
  } catch {
    // Nicht crashen — Log ist nice-to-have für Nachweis, aber der
    // Consent selbst gilt ab localStorage.
  }
}
