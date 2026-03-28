import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

export async function POST(req: Request) {
  try {
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

    const tischNummer = readOptionalNumber(o.tischNummer);
    const sessionId = readOptionalString(o.sessionId) ?? null;
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

    const now = new Date();

    const { error } = await supabase.from("scan_events").insert({
      restaurant_id: restaurantId,
      tisch_nummer: tischNummer ?? null,
      tier: 1,
      event_type: eventTypeRaw,
      stunde: now.getHours(),
      wochentag: now.getDay(),
      monat: now.getMonth() + 1,
      jahr: now.getFullYear(),
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
