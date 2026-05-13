"use client";

import { useCallback, useState } from "react";
import { useDashboardSession } from "@/hooks/useDashboardSession";
import { useRestaurantMutations } from "@/hooks/useRestaurantMutations";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardToast } from "@/components/dashboard/DashboardToast";
import { KiFeaturesContent } from "@/components/dashboard/ki/KiFeaturesContent";
import { KiOnboardingOverlay } from "@/components/dashboard/ki/KiOnboardingOverlay";
import { useDashboardQuickNav } from "@/components/dashboard/useDashboardQuickNav";

export default function KiFeaturesPage() {
  const { state, setRestaurant } = useDashboardSession("/dashboard/ki-features");
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => setToast(msg), []);
  const onQuickAction = useDashboardQuickNav();

  if (state.status === "loading") {
    return (
      <div
        className="flex min-h-dvh items-center justify-center font-sans text-sm"
        style={{ background: "#06040e", color: "rgba(242,242,242,0.5)" }}
      >
        KI-Features werden geladen …
      </div>
    );
  }
  if (state.status === "no-restaurant") {
    return (
      <div
        className="flex min-h-dvh items-center justify-center px-6 text-center text-sm"
        style={{ background: "#06040e", color: "rgba(242,242,242,0.65)" }}
      >
        Kein Restaurant für diesen Account.
      </div>
    );
  }

  return (
    <KiInner
      restaurant={state.restaurant}
      setRestaurant={setRestaurant}
      userFirstName={state.userFirstName}
      onToast={showToast}
      toast={toast}
      setToast={setToast}
      onQuickAction={onQuickAction}
    />
  );
}

function KiInner({
  restaurant,
  setRestaurant,
  userFirstName,
  onToast,
  toast,
  setToast,
  onQuickAction,
}: {
  restaurant: import("@/components/dashboard/types").DashboardRestaurant;
  setRestaurant: (r: import("@/components/dashboard/types").DashboardRestaurant) => void;
  userFirstName: string;
  onToast: (m: string) => void;
  toast: string | null;
  setToast: (m: string | null) => void;
  onQuickAction: (action: import("@/components/dashboard/DashboardShell").QuickActionKey) => void;
}) {
  const mutations = useRestaurantMutations({
    restaurant,
    onRestaurantChange: setRestaurant,
    onToast,
  });
  const avatarLabel = (userFirstName.charAt(0) || restaurant.name.charAt(0) || "Q").toUpperCase();

  return (
    <DashboardShell
      title="KI-Features"
      liveBadge={restaurant.published !== false && restaurant.aktiv !== false}
      avatarLabel={avatarLabel}
      previewUrl={`https://qrave.menu/${restaurant.slug}`}
      onQuickAction={onQuickAction}
    >
      <div className="mx-auto w-full max-w-[1100px] px-5 pb-16 pt-6 md:px-8 md:pt-8">
        <KiFeaturesContent
          restaurant={restaurant}
          onToast={onToast}
          onPatchRestaurant={mutations.handlePatchRestaurant}
        />
      </div>
      <KiOnboardingOverlay />
      <DashboardToast message={toast} onHide={() => setToast(null)} />
    </DashboardShell>
  );
}
