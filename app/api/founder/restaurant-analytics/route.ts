import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { nextBerlinYmd, startOfBerlinYmdUtcIso } from "@/lib/berlin-time";
import { isYmd } from "@/lib/restaurant-analytics-presets";
import type { RestaurantAnalyticsApiPayload, RestaurantAnalyticsApiRestaurant } from "@/lib/restaurant-analytics-api-types";
import {
  aggregateRestaurantAnalytics,
  type RawRestaurantEventRow,
} from "@/lib/restaurant-analytics-aggregate";
import { createServiceRoleClient } from "@/lib/supabase-service-role";

const EVENT_SELECT =
  "id,session_id,event_type,created_at,stunde,wochentag,tisch_nummer,item_id,item_name,kategorie,main_tab,duration_seconds,session_duration,bounce,return_visit,device_type,tier,restaurant_id,item_price,item_tags,beverage_subcategory";

const RESTAURANT_SELECT =
  "id,name,slug,stadt,telefon,aktiv,cuisine_type,stadtbezirk,sitzplaetze_ca,restaurant_typ";

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
  const supabaseSrv = createServiceRoleClient();

  type RestaurantRow = {
    id: string;
    name: string;
    slug: string;
    stadt: string | null;
    telefon: string | null;
    aktiv: boolean;
    cuisine_type: string | null;
    stadtbezirk: string | null;
    sitzplaetze_ca: number | null;
    restaurant_typ: string | null;
  };

  let restaurantRow: RestaurantRow;
  let extRow: RestaurantAnalyticsApiPayload["founderExtra"] = null;
  let events: RawRestaurantEventRow[] = [];

  try {
    const [rRes, frRes, eventsRes] = await Promise.all([
      supabase.from("restaurants").select(RESTAURANT_SELECT).eq("id", restaurantId).maybeSingle(),
      supabase
        .from("founder_restaurants")
        .select("next_visit,last_visit,note,sticker_tier,sticker_paid,sticker_count")
        .eq("restaurant_id", restaurantId)
        .maybeSingle(),
      supabaseSrv
        .from("scan_events")
        .select(EVENT_SELECT)
        .eq("restaurant_id", restaurantId)
        .gte("created_at", fromIso)
        .lt("created_at", toExclusiveIso)
        .order("created_at", { ascending: true })
        .limit(50000),
    ]);

    if (rRes.error) {
      return NextResponse.json({ error: rRes.error.message }, { status: 500 });
    }
    if (!rRes.data) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }
    if (frRes.error) {
      return NextResponse.json({ error: frRes.error.message }, { status: 500 });
    }
    if (eventsRes.error) {
      return NextResponse.json({ error: eventsRes.error.message }, { status: 500 });
    }

    restaurantRow = rRes.data as RestaurantRow;
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
    events = (eventsRes.data ?? []) as RawRestaurantEventRow[];
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const computed = aggregateRestaurantAnalytics(events, fromYmd, toYmd);

  const restaurant: RestaurantAnalyticsApiRestaurant = {
    id: restaurantRow.id,
    name: restaurantRow.name,
    slug: restaurantRow.slug,
    stadt: restaurantRow.stadt ?? null,
    telefon: restaurantRow.telefon ?? null,
    aktiv: Boolean(restaurantRow.aktiv),
    cuisine_type: restaurantRow.cuisine_type ?? null,
    stadtbezirk: restaurantRow.stadtbezirk ?? null,
    sitzplaetze_ca:
      typeof restaurantRow.sitzplaetze_ca === "number" ? restaurantRow.sitzplaetze_ca : null,
    restaurant_typ: restaurantRow.restaurant_typ ?? null,
  };

  const payload: RestaurantAnalyticsApiPayload = {
    fromYmd,
    toYmd,
    restaurant,
    founderExtra: extRow,
    computed,
    eventRowCount: events.length,
  };

  return NextResponse.json(payload);
}
