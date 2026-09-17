import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";

/**
 * Monatlicher Reset des Foto-Verbesserungs-Kontingents.
 * Setzt `restaurants.photo_credits_used_month` auf 0 für alle Restaurants.
 *
 * Trigger über cron-job.org am 1. jedes Monats um ~03:00 Europe/Berlin.
 * Auth: Bearer-Token wie bei aggregate-analytics.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET ist nicht gesetzt" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("restaurants")
      .update({ photo_credits_used_month: 0 })
      .gt("photo_credits_used_month", 0)
      .select("id");
    if (error) {
      console.error("reset-photo-credits:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, reset_count: data?.length ?? 0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Reset fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
