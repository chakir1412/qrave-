import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { berlinDaySpanInclusive } from "@/lib/berlin-time";
import { isYmd } from "@/lib/restaurant-analytics-presets";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import { backfillAnalyticsRange } from "@/lib/run-analytics-aggregation";

const MAX_BACKFILL_DAYS = 120;

type BodyJson = {
  from?: string;
  to?: string;
  restaurantId?: string;
};

/**
 * Founder-only: füllt `restaurant_analytics_daily` für einen Zeitraum (max. MAX_BACKFILL_DAYS Tage).
 * POST JSON: { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "restaurantId"?: "uuid" }
 */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabaseUser = createServerClient(
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
  } = await supabaseUser.auth.getUser();
  if (!user || user.id !== process.env.FOUNDER_USER_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: BodyJson = {};
  try {
    body = (await req.json()) as BodyJson;
  } catch {
    body = {};
  }
  const fromYmd = typeof body.from === "string" ? body.from : "";
  const toYmd = typeof body.to === "string" ? body.to : "";
  const restaurantId =
    typeof body.restaurantId === "string" && body.restaurantId.trim().length > 0
      ? body.restaurantId.trim()
      : undefined;

  if (!isYmd(fromYmd) || !isYmd(toYmd)) {
    return NextResponse.json(
      { error: "Ungültige Parameter: from und to als YYYY-MM-DD erforderlich" },
      { status: 400 },
    );
  }
  if (fromYmd > toYmd) {
    return NextResponse.json({ error: "from liegt nach to" }, { status: 400 });
  }

  const span = berlinDaySpanInclusive(fromYmd, toYmd);
  if (span > MAX_BACKFILL_DAYS) {
    return NextResponse.json(
      {
        error: `Zeitraum zu groß (max. ${MAX_BACKFILL_DAYS} Tage). Bitte in mehreren Anfragen ausführen.`,
        maxDays: MAX_BACKFILL_DAYS,
        requestedDays: span,
      },
      { status: 400 },
    );
  }

  try {
    const supabase = createServiceRoleClient();
    const result = await backfillAnalyticsRange(supabase, fromYmd, toYmd, { restaurantId });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Backfill fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
