"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { DailyPush, MenuItem } from "@/lib/supabase";
import { fetchMenuItemsForDashboard } from "@/hooks/useMenuItems";
import { fetchDashboardAnalytics } from "@/hooks/useAnalytics";
import { DashboardApp } from "@/components/dashboard/DashboardApp";
import type { DashboardRestaurant } from "@/components/dashboard/types";

function firstNameFromSession(meta: Record<string, unknown> | undefined, email: string | null): string {
  const raw = meta?.full_name ?? meta?.name;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().split(/\s+/)[0] ?? "Gast";
  }
  if (email) {
    return email.split("@")[0] ?? "Gast";
  }
  return "Gast";
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<DashboardRestaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [dailyPush, setDailyPush] = useState<DailyPush | null>(null);
  const [userFirstName, setUserFirstName] = useState("Gast");
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof fetchDashboardAnalytics>> | null>(
    null,
  );
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login?redirect=/dashboard");
        return;
      }

      console.log("SESSION USER ID:", session.user.id);

      setUserFirstName(
        firstNameFromSession(
          session.user.user_metadata as Record<string, unknown> | undefined,
          session.user.email ?? null,
        ),
      );
      setUserEmail(session.user.email ?? "");

      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("auth_user_id", session.user.id)
        .single();

      console.log("session user id:", session.user.id);
      console.log("restaurant data:", data);
      console.log("error:", error);

      if (cancelled) return;

      if (error || !data) {
        setLoading(false);
        return;
      }

      const restRow = data as unknown as DashboardRestaurant;
      setRestaurant(restRow);

      const today = new Date().toISOString().slice(0, 10);
      const [items, pushRes, dashAnalytics] = await Promise.all([
        fetchMenuItemsForDashboard(restRow.id),
        supabase
          .from("daily_push")
          .select("id, restaurant_id, active_date, item_emoji, item_name, item_desc")
          .eq("restaurant_id", restRow.id)
          .eq("active_date", today)
          .maybeSingle(),
        fetchDashboardAnalytics(restRow.id),
      ]);

      if (cancelled) return;

      setMenuItems(items);
      setDailyPush(pushRes.data ? (pushRes.data as DailyPush) : null);
      setAnalytics(dashAnalytics);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center font-sans text-sm"
        style={{ backgroundColor: "#080810", color: "rgba(255,255,255,0.5)" }}
      >
        Dashboard wird geladen …
      </div>
    );
  }

  if (!restaurant || !analytics) {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center font-sans text-sm"
        style={{ backgroundColor: "#080810", color: "rgba(255,255,255,0.65)" }}
      >
        <p>Kein Restaurant für deinen Account gefunden.</p>
        <p className="text-xs opacity-70">Bitte Support kontaktieren oder Demo-Zugang prüfen.</p>
      </div>
    );
  }

  return (
    <DashboardApp
      userFirstName={userFirstName}
      userEmail={userEmail}
      restaurant={restaurant}
      initialMenuItems={menuItems}
      initialAnalytics={analytics}
      initialDailyPush={dailyPush}
    />
  );
}
