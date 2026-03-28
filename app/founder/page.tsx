import type { Metadata } from "next";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FounderDashboard } from "@/components/founder/FounderDashboard";
import type { FounderDashboardData } from "@/lib/founder-types";

export const metadata: Metadata = {
  title: "Founder · Qrave",
  robots: { index: false, follow: false },
};

export default async function FounderPage() {
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
  if (!user) redirect("/founder/login");
  if (user.id !== process.env.FOUNDER_USER_ID) {
    redirect("/founder/login");
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [restaurantsRes, scansRes, pipelineRes, todosRes, extRes] = await Promise.all([
    supabase.from("restaurants").select("*").order("created_at", { ascending: false }),
    supabase
      .from("scan_events")
      .select(
        "event_type, stunde, wochentag, monat, tisch_nummer, item_name, kategorie, main_tab, duration_seconds, tier, created_at, restaurant_id",
      )
      .gt("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("founder_pipeline").select("*").order("added_at", { ascending: false }),
    supabase.from("founder_todos").select("*").order("created_at", { ascending: false }),
    supabase.from("founder_restaurants").select("*"),
  ]);

  const data: FounderDashboardData = {
    restaurants: (restaurantsRes.data ?? []) as FounderDashboardData["restaurants"],
    scanEvents: (scansRes.data ?? []) as FounderDashboardData["scanEvents"],
    pipeline: (pipelineRes.data ?? []) as FounderDashboardData["pipeline"],
    todos: (todosRes.data ?? []) as FounderDashboardData["todos"],
    restaurantExtras: (extRes.data ?? []) as FounderDashboardData["restaurantExtras"],
  };

  return <FounderDashboard data={data} />;
}
