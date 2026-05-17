"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, fetchDailyPushes, fetchLunchOffers } from "@/lib/supabase";
import type { DailyPush, LunchOffer, MenuItem } from "@/lib/supabase";
import { fetchMenuItemsForDashboard } from "@/hooks/useMenuItems";
import { fetchDashboardAnalytics } from "@/hooks/useAnalytics";
import { DashboardApp } from "@/components/dashboard/DashboardApp";
import type { DashboardRestaurant } from "@/components/dashboard/types";

function firstNameFromSession(
  meta: Record<string, unknown> | undefined,
  fallback: string,
): string {
  const raw = meta?.full_name ?? meta?.name;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().split(/\s+/)[0] ?? fallback;
  }
  return fallback;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<DashboardRestaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [dailyPushes, setDailyPushes] = useState<DailyPush[]>([]);
  const [lunchOffers, setLunchOffers] = useState<LunchOffer[]>([]);
  const [userFirstName, setUserFirstName] = useState("Gast");
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof fetchDashboardAnalytics>> | null>(
    null,
  );

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

      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("auth_user_id", session.user.id)
        .single();

      if (cancelled) return;

      if (error || !data) {
        setLoading(false);
        return;
      }

      const restRow = data as unknown as DashboardRestaurant;
      setRestaurant(restRow);
      setUserFirstName(
        firstNameFromSession(
          session.user.user_metadata as Record<string, unknown> | undefined,
          restRow.name,
        ),
      );

      // allSettled: einzelne Resource-Fehler dürfen den Rest nicht killen.
      // Wir loggen jeden Fehler, setzen aber alle erfolgreichen States.
      const results = await Promise.allSettled([
        fetchMenuItemsForDashboard(restRow.id),
        fetchDailyPushes(restRow.id),
        fetchLunchOffers(restRow.id),
        fetchDashboardAnalytics(restRow.id),
      ]);

      if (cancelled) return;

      const [itemsRes, pushesRes, offersRes, analyticsRes] = results;
      if (itemsRes.status === "fulfilled") setMenuItems(itemsRes.value);
      else console.error("[dashboard] menu items failed:", itemsRes.reason);
      if (pushesRes.status === "fulfilled") setDailyPushes(pushesRes.value);
      else console.error("[dashboard] daily pushes failed:", pushesRes.reason);
      if (offersRes.status === "fulfilled") setLunchOffers(offersRes.value);
      else console.error("[dashboard] lunch offers failed:", offersRes.reason);
      if (analyticsRes.status === "fulfilled") setAnalytics(analyticsRes.value);
      else console.error("[dashboard] analytics failed:", analyticsRes.reason);
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
      restaurant={restaurant}
      initialMenuItems={menuItems}
      initialAnalytics={analytics}
      initialDailyPushes={dailyPushes}
      initialLunchOffers={lunchOffers}
    />
  );
}
