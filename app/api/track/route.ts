import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { berlinDateParts } from "@/lib/berlin-time";
import {
  checkRateLimit,
  getClientIp,
  isUuid,
  rateLimitHeaders,
} from "@/lib/rate-limit";

/** In-Memory-Cache existierender Restaurant-IDs (5 min TTL).
 *  Eine Function-Instance hält den Cache; bei Cache-Miss → DB-Lookup. */
const restaurantExistsCache = new Map<string, { exists: boolean; expiresAt: number }>();
const RESTAURANT_CACHE_TTL_MS = 5 * 60 * 1000;

async function restaurantExists(id: string): Promise<boolean> {
  const cached = restaurantExistsCache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.exists;
  const { data, error } = await supabase
    .from("restaurants")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  const exists = !error && Boolean(data);
  restaurantExistsCache.set(id, { exists, expiresAt: Date.now() + RESTAURANT_CACHE_TTL_MS });
  return exists;
}

const EVENT_TYPES = [
  "item_view",
  "item_detail",
  "item_detail_duration",
  "wishlist_add",
  "wishlist_remove",
  "category_enter",
  "category_leave",
  "tab_switch",
  "filter_set",
  "scroll_depth",
  "ad_view",
  "ad_click",
  "ad_detail",
  "session_end",
  "bounce",
] as const;

type EventType = (typeof EVENT_TYPES)[number];

function isEventType(x: unknown): x is EventType {
  return typeof x === "string" && (EVENT_TYPES as readonly string[]).includes(x);
}

function readString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function readOptionalString(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") return v;
  return undefined;
}

function readOptionalNumber(v: unknown): number | null | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function readOptionalBoolean(v: unknown): boolean | null | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "boolean") return v;
  return undefined;
}

const ALLOWED_ITEM_TAGS = new Set(["vegetarisch", "vegan", "glutenfrei", "alkoholfrei"]);
const ALLOWED_BEVERAGE_SUBCATEGORIES = new Set([
  "bier",
  "wein",
  "softdrinks",
  "cocktails",
  "wasser",
  "kaffee",
  "energy",
  "sonstiges_getraenk",
]);

function readItemTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const t of v) {
    if (typeof t !== "string") continue;
    const norm = t.trim().toLowerCase();
    if (ALLOWED_ITEM_TAGS.has(norm) && !out.includes(norm)) out.push(norm);
  }
  return out;
}

function readBeverageSubcategory(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const norm = v.trim().toLowerCase();
  return ALLOWED_BEVERAGE_SUBCATEGORIES.has(norm) ? norm : null;
}

function readItemPrice(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return Math.round(v * 100) / 100;
  }
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(",", "."));
    if (Number.isFinite(n) && n >= 0) return Math.round(n * 100) / 100;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    // ---- 1. Rate-Limit pro Client-IP. ----
    // 120 Events / Minute reicht für legitime Sessions
    // (item_detail + scroll_depth + tab_switch + session_end + …),
    // blockt aber Spam-Bots zuverlässig.
    const ip = getClientIp(req);
    const rl = await checkRateLimit("track", ip, 120, "1 m");
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const o = body as Record<string, unknown>;

    const restaurantId = readString(o.restaurantId);
    const eventTypeRaw = o.eventType;
    if (!restaurantId || !isEventType(eventTypeRaw)) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // ---- 2. UUID-Format-Check für restaurant_id und session_id. ----
    if (!isUuid(restaurantId)) {
      return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
    }

    const tischNummer = readOptionalNumber(o.tischNummer);
    const sessionId = readOptionalString(o.sessionId) ?? null;
    if (sessionId !== null && !isUuid(sessionId)) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    // ---- 3. Existenz-Check für restaurant_id. ----
    // Verhindert dass Spammer fake-IDs probieren und die DB mit
    // FK-Constraint-Errors belasten. 5-min Cache vorgeschaltet.
    if (!(await restaurantExists(restaurantId))) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }
    const itemId = readOptionalString(o.itemId) ?? null;
    const itemName = readOptionalString(o.itemName) ?? null;
    const kategorie = readOptionalString(o.kategorie) ?? null;
    const mainTab = readOptionalString(o.mainTab) ?? null;
    const filterKey = readOptionalString(o.filterKey) ?? null;
    const durationSeconds = readOptionalNumber(o.durationSeconds) ?? null;
    const scrollPct = readOptionalNumber(o.scrollPct) ?? null;
    const partnerName = readOptionalString(o.partnerName) ?? null;
    const produkt = readOptionalString(o.produkt) ?? null;
    const adPosition = readOptionalString(o.adPosition) ?? null;
    const sessionDuration = readOptionalNumber(o.sessionDuration) ?? null;
    const returnVisit = readOptionalBoolean(o.returnVisit) ?? null;
    const bounce = readOptionalBoolean(o.bounce) ?? null;

    // Käuferorientierte Felder — nur bei item_detail relevant, werden aber
    // generell akzeptiert (Aggregation filtert per event_type).
    const itemPrice = readItemPrice(o.itemPrice);
    const itemTags = readItemTags(o.itemTags);
    const beverageSubcategory = readBeverageSubcategory(o.beverageSubcategory);

    // Vercel-Functions laufen in UTC. Tracking-Felder müssen Europe/Berlin
    // sein, sonst stimmen Tagesblöcke / Peak-Hour / Wochentag-Aggregationen
    // nicht. wochentag = 1=Mo … 7=So (passend zu WEEKDAY_LABELS).
    const { hour, weekdayMon1, month, year } = berlinDateParts(new Date());

    const { error } = await supabase.from("scan_events").insert({
      restaurant_id: restaurantId,
      tisch_nummer: tischNummer ?? null,
      tier: 1,
      event_type: eventTypeRaw,
      stunde: hour,
      wochentag: weekdayMon1,
      monat: month,
      jahr: year,
      session_id: sessionId,
      item_id: itemId,
      item_name: itemName,
      kategorie,
      main_tab: mainTab,
      filter_key: filterKey,
      duration_seconds: durationSeconds !== undefined ? durationSeconds : null,
      scroll_pct: scrollPct !== undefined ? scrollPct : null,
      partner_name: partnerName,
      produkt,
      ad_position: adPosition,
      session_duration: sessionDuration !== undefined ? sessionDuration : null,
      return_visit: returnVisit,
      bounce,
      item_price: itemPrice,
      item_tags: itemTags,
      beverage_subcategory: beverageSubcategory,
    });

    if (error) {
      console.error("scan_events insert:", error);
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
