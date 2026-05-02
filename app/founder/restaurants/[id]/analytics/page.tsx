import type { Metadata } from "next";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RestaurantAnalyticsClient } from "@/components/founder/restaurant-analytics/RestaurantAnalyticsClient";
import { defaultLast7Ymd, isYmd } from "@/lib/restaurant-analytics-presets";

const FOUNDER_USER_ID = "b48eeabc-0652-4b8c-8579-4286c0570d54";

export const metadata: Metadata = {
  title: "Restaurant Analytics · Founder",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function RestaurantAnalyticsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

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
  if (user.id !== FOUNDER_USER_ID) {
    redirect("/founder/login");
  }

  const from = typeof sp.from === "string" ? sp.from : "";
  const to = typeof sp.to === "string" ? sp.to : "";
  if (!isYmd(from) || !isYmd(to) || from > to) {
    const d = defaultLast7Ymd();
    redirect(`/founder/restaurants/${id}/analytics?from=${d.fromYmd}&to=${d.toYmd}`);
  }

  return <RestaurantAnalyticsClient restaurantId={id} fromYmd={from} toYmd={to} />;
}
