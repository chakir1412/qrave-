import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loadFounderDashboardData } from "@/lib/load-founder-dashboard";

export async function GET() {
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
