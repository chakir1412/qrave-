import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nextBerlinYmd, startOfBerlinYmdUtcIso } from "@/lib/berlin-time";
import { aggregateRestaurantAnalytics, type RawRestaurantEventRow } from "@/lib/restaurant-analytics-aggregate";
import { isYmd } from "@/lib/restaurant-analytics-presets";
import type { FounderRestaurantTableRow } from "@/lib/founder-types";
import type { RestaurantAnalyticsApiPayload, RestaurantAnalyticsApiRestaurant } from "@/lib/restaurant-analytics-api-types";

const EVENT_SELECT =
  "id,session_id,event_type,created_at,stunde,tisch_nummer,item_name,kategorie,tier,restaurant_id";

async function fetchEventsInRange(
  supabase: SupabaseClient,
  restaurantId: string,
  fromIso: string,
  toExclusiveIso: string,
): Promise<RawRestaurantEventRow[]> {
  const pageSize = 1000;
  let offset = 0;
  const all: RawRestaurantEventRow[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("scan_events")
      .select(EVENT_SELECT)
      .eq("restaurant_id", restaurantId)
      .gte("created_at", fromIso)
      .lt("created_at", toExclusiveIso)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...(data as RawRestaurantEventRow[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== process.env.FOUNDER_USER_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") ?? "";
  const fromYmd = searchParams.get("from") ?? "";
  const toYmd = searchParams.get("to") ?? "";

  if (!restaurantId || !isYmd(fromYmd) || !isYmd(toYmd)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }
  if (fromYmd > toYmd) {
    return NextResponse.json({ error: "from after to" }, { status: 400 });
  }

  const fromIso = startOfBerlinYmdUtcIso(fromYmd);
  const toExclusiveIso = startOfBerlinYmdUtcIso(nextBerlinYmd(toYmd));

  const { data: restaurantRow, error: rErr } = await supabase
    .from("restaurants")
    .select("id,name,slug,stadt,telefon,aktiv")
    .eq("id", restaurantId)
    .maybeSingle();
  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 });
  }
  if (!restaurantRow) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const { data: tablesData, error: tErr } = await supabase
    .from("restaurant_tables")
    .select("id,restaurant_id,tisch_nummer,bereich,qr_url,nfc_programmiert,sticker_angebracht,created_at")
    .eq("restaurant_id", restaurantId)
    .order("tisch_nummer", { ascending: true });
  if (tErr) {
    return NextResponse.json({ error: tErr.message }, { status: 500 });
  }

  const { data: extRow, error: eErr } = await supabase
    .from("founder_restaurants")
    .select("next_visit,last_visit,note,sticker_tier,sticker_paid,sticker_count")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (eErr) {
    return NextResponse.json({ error: eErr.message }, { status: 500 });
  }

  let events: RawRestaurantEventRow[] = [];
  try {
    events = await fetchEventsInRange(supabase, restaurantId, fromIso, toExclusiveIso);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const tables = (tablesData ?? []) as FounderRestaurantTableRow[];
  const computed = aggregateRestaurantAnalytics(events, tables, fromYmd, toYmd);

  const restaurant: RestaurantAnalyticsApiRestaurant = {
    id: restaurantRow.id as string,
    name: restaurantRow.name as string,
    slug: restaurantRow.slug as string,
    stadt: (restaurantRow.stadt as string | null) ?? null,
    telefon: (restaurantRow.telefon as string | null) ?? null,
    aktiv: Boolean(restaurantRow.aktiv),
  };

  const payload: RestaurantAnalyticsApiPayload = {
    fromYmd,
    toYmd,
    restaurant,
    tables,
    founderExtra: extRow
      ? {
          next_visit: (extRow.next_visit as string | null) ?? null,
          last_visit: (extRow.last_visit as string | null) ?? null,
          note: (extRow.note as string | null) ?? null,
          sticker_tier: (extRow.sticker_tier as string | null) ?? null,
          sticker_paid: Boolean(extRow.sticker_paid),
          sticker_count: Number(extRow.sticker_count ?? 0),
        }
      : null,
    computed,
    eventRowCount: events.length,
  };

  return NextResponse.json(payload);
}
