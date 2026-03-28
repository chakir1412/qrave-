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

  const fetchPage = async (offset: number): Promise<RawRestaurantEventRow[]> => {
    const { data, error } = await supabase
      .from("scan_events")
      .select(EVENT_SELECT)
      .eq("restaurant_id", restaurantId)
      .gte("created_at", fromIso)
      .lt("created_at", toExclusiveIso)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    return (data ?? []) as RawRestaurantEventRow[];
  };

  const all: RawRestaurantEventRow[] = [];
  let offset = 0;
  for (;;) {
    const [a, b, c] = await Promise.all([
      fetchPage(offset),
      fetchPage(offset + pageSize),
      fetchPage(offset + 2 * pageSize),
    ]);
    all.push(...a, ...b, ...c);
    if (a.length === 0) break;
    if (c.length < pageSize) break;
    offset += 3 * pageSize;
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

  type RestaurantRow = {
    id: string;
    name: string;
    slug: string;
    stadt: string | null;
    telefon: string | null;
    aktiv: boolean;
  };

  let restaurantRow: RestaurantRow;
  let tablesData: FounderRestaurantTableRow[] | null = null;
  let extRow: {
    next_visit: string | null;
    last_visit: string | null;
    note: string | null;
    sticker_tier: string | null;
    sticker_paid: boolean;
    sticker_count: number;
  } | null = null;

  let events: RawRestaurantEventRow[] = [];
  try {
    const [rRes, tRes, frRes, ev] = await Promise.all([
      supabase.from("restaurants").select("id,name,slug,stadt,telefon,aktiv").eq("id", restaurantId).maybeSingle(),
      supabase
        .from("restaurant_tables")
        .select("id,restaurant_id,tisch_nummer,bereich,qr_url,nfc_programmiert,sticker_angebracht,created_at")
        .eq("restaurant_id", restaurantId)
        .order("tisch_nummer", { ascending: true }),
      supabase
        .from("founder_restaurants")
        .select("next_visit,last_visit,note,sticker_tier,sticker_paid,sticker_count")
        .eq("restaurant_id", restaurantId)
        .maybeSingle(),
      fetchEventsInRange(supabase, restaurantId, fromIso, toExclusiveIso),
    ]);

    if (rRes.error) {
      return NextResponse.json({ error: rRes.error.message }, { status: 500 });
    }
    if (!rRes.data) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }
    if (tRes.error) {
      return NextResponse.json({ error: tRes.error.message }, { status: 500 });
    }
    if (frRes.error) {
      return NextResponse.json({ error: frRes.error.message }, { status: 500 });
    }

    restaurantRow = rRes.data as RestaurantRow;
    tablesData = tRes.data as FounderRestaurantTableRow[] | null;
    extRow = frRes.data
      ? {
          next_visit: (frRes.data.next_visit as string | null) ?? null,
          last_visit: (frRes.data.last_visit as string | null) ?? null,
          note: (frRes.data.note as string | null) ?? null,
          sticker_tier: (frRes.data.sticker_tier as string | null) ?? null,
          sticker_paid: Boolean(frRes.data.sticker_paid),
          sticker_count: Number(frRes.data.sticker_count ?? 0),
        }
      : null;
    events = ev;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const tables = (tablesData ?? []) as FounderRestaurantTableRow[];
  const computed = aggregateRestaurantAnalytics(events, tables, fromYmd, toYmd);

  const restaurant: RestaurantAnalyticsApiRestaurant = {
    id: restaurantRow.id,
    name: restaurantRow.name,
    slug: restaurantRow.slug,
    stadt: restaurantRow.stadt ?? null,
    telefon: restaurantRow.telefon ?? null,
    aktiv: Boolean(restaurantRow.aktiv),
  };

  const payload: RestaurantAnalyticsApiPayload = {
    fromYmd,
    toYmd,
    restaurant,
    tables,
    founderExtra: extRow,
    computed,
    eventRowCount: events.length,
  };

  return NextResponse.json(payload);
}
