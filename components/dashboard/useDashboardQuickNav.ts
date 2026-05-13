"use client";

import { useRouter } from "next/navigation";
import type { QuickActionKey } from "./DashboardShell";

/** Quick-Action-Handler aus der Sidebar — auf jeder Sub-Page (Settings,
 *  KI-Features) navigiert er zu /dashboard mit dem passenden Hinweis,
 *  damit DashboardApp den entsprechenden Sub-Tab/Filter aktiviert. */
export function useDashboardQuickNav() {
  const router = useRouter();
  return (action: QuickActionKey) => {
    if (typeof window === "undefined") return;
    try {
      switch (action) {
        case "daily":
          sessionStorage.setItem("qrave-dashboard-tab", "karte");
          sessionStorage.setItem("qrave-karte-sub", "heute");
          router.push("/dashboard");
          break;
        case "notiz":
          sessionStorage.setItem("qrave-dashboard-tab", "karte");
          sessionStorage.setItem("qrave-karte-sub", "notiz");
          router.push("/dashboard");
          break;
        case "soldout":
          sessionStorage.setItem("qrave-dashboard-tab", "karte");
          sessionStorage.setItem("qrave-karte-sub", "menu");
          sessionStorage.setItem("qrave-karte-filter", "soldout");
          router.push("/dashboard");
          break;
        case "translate":
          router.push("/dashboard/ki-features#uebersetzen");
          break;
      }
    } catch {
      router.push("/dashboard");
    }
  };
}
