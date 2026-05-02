import type { Metadata } from "next";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FounderDashboard } from "@/components/founder/FounderDashboard";
import { loadFounderDashboardData } from "@/lib/load-founder-dashboard";

const FOUNDER_USER_ID = "b48eeabc-0652-4b8c-8579-4286c0570d54";

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
  if (user.id !== FOUNDER_USER_ID) {
    redirect("/founder/login");
  }

  const { data, errors } = await loadFounderDashboardData(supabase);

  return (
    <FounderDashboard
      data={data}
      initialLoadError={errors.length > 0 ? errors.join(" · ") : null}
    />
  );
}
