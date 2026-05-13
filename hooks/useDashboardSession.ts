"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { DashboardRestaurant } from "@/components/dashboard/types";

type SessionState =
  | { status: "loading" }
  | { status: "no-restaurant" }
  | { status: "ok"; restaurant: DashboardRestaurant; userEmail: string; userFirstName: string };

function firstName(meta: Record<string, unknown> | undefined, fallback: string): string {
  const raw = meta?.full_name ?? meta?.name;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().split(/\s+/)[0] ?? fallback;
  }
  return fallback;
}

/** Lädt Auth-Session + zugehöriges Restaurant. Wenn nicht eingeloggt:
 *  redirect zu /login?redirect=<currentPath>. Wird von /dashboard,
 *  /dashboard/einstellungen und /dashboard/ki-features verwendet. */
export function useDashboardSession(redirectPath: string): {
  state: SessionState;
  setRestaurant: (next: DashboardRestaurant) => void;
} {
  const router = useRouter();
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace(`/login?redirect=${encodeURIComponent(redirectPath)}`);
        return;
      }
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("auth_user_id", session.user.id)
        .single();
      if (cancelled) return;
      if (error || !data) {
        setState({ status: "no-restaurant" });
        return;
      }
      const restaurant = data as unknown as DashboardRestaurant;
      setState({
        status: "ok",
        restaurant,
        userEmail: session.user.email ?? "",
        userFirstName: firstName(
          session.user.user_metadata as Record<string, unknown> | undefined,
          restaurant.name,
        ),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [router, redirectPath]);

  return {
    state,
    setRestaurant: (next) => {
      setState((prev) =>
        prev.status === "ok"
          ? { status: "ok", restaurant: next, userEmail: prev.userEmail, userFirstName: prev.userFirstName }
          : prev,
      );
    },
  };
}
