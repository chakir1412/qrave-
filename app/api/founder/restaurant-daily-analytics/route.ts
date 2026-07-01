import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isYmd } from "@/lib/restaurant-analytics-presets";
import { checkRateLimit, getClientIp, rateLimitHeaders, isUuid } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase-service-role";

const SELECT_COLS =
  "restaurant_id, day_berlin, scan_count, sessions_count, sessions_with_consent, item_detail_count, scans_morning, scans_midday, scans_evening, scans_night, category_clicks, beverage_subcategory_clicks, top_items, vegan_clicks, vegetarian_clicks, avg_item_price_clicked";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit("founder-daily-analytics", ip, 60, "1 m");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate Limit überschritten." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

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

  if (!isUuid(restaurantId) || !isYmd(fromYmd) || !isYmd(toYmd) || fromYmd > toYmd) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const srv = createServiceRoleClient();
  const { data, error } = await srv
    .from("restaurant_analytics_daily")
    .select(SELECT_COLS)
    .eq("restaurant_id", restaurantId)
    .gte("day_berlin", fromYmd)
    .lte("day_berlin", toYmd)
    .order("day_berlin", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}
