/**
 * Rate-Limit-Helper für öffentliche API-Routes.
 *
 * Backend: Upstash Redis (Token-Bucket via @upstash/ratelimit).
 * Aktivierung über ENV-Vars:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Fehlen die Vars: Rate-Limit ist deaktiviert, jeder Aufruf wird durchgelassen
 * (mit einmaligem Console-Warning beim Cold-Start). So bleibt der Deploy
 * grün auch ohne Upstash-Setup; Aktivierung später ohne Code-Änderung.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Duration =
  | `${number} ms`
  | `${number} s`
  | `${number} m`
  | `${number} h`
  | `${number} d`;

let cachedRedis: Redis | null | undefined;
const limiterCache = new Map<string, Ratelimit>();
let warnedMissing = false;

function getRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    if (!warnedMissing) {
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN fehlen — Rate-Limit deaktiviert.",
      );
      warnedMissing = true;
    }
    cachedRedis = null;
    return null;
  }
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

function getLimiter(name: string, limit: number, window: Duration): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const key = `${name}:${limit}:${window}`;
  const existing = limiterCache.get(key);
  if (existing) return existing;
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `qrave:rl:${name}`,
    analytics: false,
  });
  limiterCache.set(key, rl);
  return rl;
}

/** Extrahiert die Client-IP aus dem Request (Vercel setzt `x-forwarded-for`). */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim();
  if (first) return first;
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

export type RateLimitResult = {
  ok: boolean;
  /** `true`, wenn Rate-Limit nicht aktiv ist (z. B. fehlende ENV). */
  bypass: boolean;
  limit: number;
  remaining: number;
  /** Unix-ms bis zum Reset des Buckets. */
  reset: number;
};

/**
 * Prüft den Token-Bucket für eine Identität (typischerweise IP-Adresse).
 *
 * @param name      Eindeutiger Limiter-Name (z. B. "track", "contact")
 * @param identity  Token-Bucket-Schlüssel (z. B. Client-IP)
 * @param limit     Max. Anfragen pro Fenster
 * @param window    Zeitfenster, z. B. "1 m", "1 h"
 */
export async function checkRateLimit(
  name: string,
  identity: string,
  limit: number,
  window: Duration,
): Promise<RateLimitResult> {
  const rl = getLimiter(name, limit, window);
  if (!rl) {
    return { ok: true, bypass: true, limit, remaining: limit, reset: Date.now() };
  }
  try {
    const res = await rl.limit(identity);
    return {
      ok: res.success,
      bypass: false,
      limit: res.limit,
      remaining: res.remaining,
      reset: res.reset,
    };
  } catch (e) {
    // Bei Upstash-Fehler: nicht blocken, sondern durchwinken. Sicherheit vs.
    // Verfügbarkeit — bei kurzlebigem Netzwerk-Glitch lieber Spam durchlassen
    // als legitime Tracking-Calls abweisen.
    console.error("[rate-limit] limiter error:", e);
    return { ok: true, bypass: true, limit, remaining: limit, reset: Date.now() };
  }
}

/** Standard-Header-Set für 429-Antworten. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const retryAfterSec = Math.max(0, Math.ceil((result.reset - Date.now()) / 1000));
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
    "Retry-After": String(retryAfterSec),
  };
}

/** Strikter UUID-Format-Check (v1–v8 akzeptiert, case-insensitive). */
export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
