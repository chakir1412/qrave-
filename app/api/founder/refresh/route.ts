import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loadFounderDashboardData } from "@/lib/load-founder-dashboard";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit("founder-refresh", ip, 60, "1 m");
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

  const { data } = await loadFounderDashboardData(supabase);
  return NextResponse.json(data);
}
