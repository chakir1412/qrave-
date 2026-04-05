import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
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
  } = await supabaseAuth.auth.getUser();
  if (!user || user.id !== process.env.FOUNDER_USER_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  if (!restaurantId) {
    return NextResponse.json({ error: "restaurantId fehlt" }, { status: 400 });
  }

  let srv;
  try {
    srv = createServiceRoleClient();
  } catch {
    return NextResponse.json({ error: "Server-Konfiguration unvollständig" }, { status: 500 });
  }

  const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString();

  const { data: rows, error } = await srv
    .from("scan_events")
    .select("tisch_nummer")
    .eq("restaurant_id", restaurantId)
    .eq("event_type", "scan")
    .gte("created_at", sinceIso)
    .limit(20000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tableScans: Record<string, number> = {};
  for (const r of rows ?? []) {
    const rec = r as { tisch_nummer: number | null };
    if (rec.tisch_nummer == null || !Number.isFinite(rec.tisch_nummer)) continue;
    const k = String(rec.tisch_nummer);
    tableScans[k] = (tableScans[k] ?? 0) + 1;
  }

  return NextResponse.json({ tableScans });
}
