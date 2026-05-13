"use client";

import { useCallback, useState } from "react";
import { useDashboardSession } from "@/hooks/useDashboardSession";
import { useRestaurantMutations } from "@/hooks/useRestaurantMutations";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardToast } from "@/components/dashboard/DashboardToast";
import { SettingsContent } from "@/components/dashboard/settings/SettingsContent";
import { useDashboardQuickNav } from "@/components/dashboard/useDashboardQuickNav";

export default function SettingsPage() {
  const { state, setRestaurant } = useDashboardSession("/dashboard/einstellungen");
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => setToast(msg), []);
  const onQuickAction = useDashboardQuickNav();

  if (state.status === "loading") {
    return (
      <div
        className="flex min-h-dvh items-center justify-center font-sans text-sm"
        style={{ background: "#06040e", color: "rgba(242,242,242,0.5)" }}
      >
        Einstellungen werden geladen …
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

  return <SettingsInner state={state} setRestaurant={setRestaurant} onToast={showToast} toast={toast} setToast={setToast} onQuickAction={onQuickAction} />;
}

function SettingsInner({
  state,
  setRestaurant,
  onToast,
  toast,
  setToast,
  onQuickAction,
}: {
  state: { status: "ok"; restaurant: import("@/components/dashboard/types").DashboardRestaurant; userEmail: string; userFirstName: string };
  setRestaurant: (next: import("@/components/dashboard/types").DashboardRestaurant) => void;
  onToast: (msg: string) => void;
  toast: string | null;
  setToast: (m: string | null) => void;
  onQuickAction: (action: import("@/components/dashboard/DashboardShell").QuickActionKey) => void;
}) {
  const mutations = useRestaurantMutations({
    restaurant: state.restaurant,
    onRestaurantChange: setRestaurant,
    onToast,
  });
  const avatarLabel = (state.userFirstName.charAt(0) || state.restaurant.name.charAt(0) || "Q").toUpperCase();

  return (
    <DashboardShell
      title="Einstellungen"
      liveBadge={state.restaurant.published !== false && state.restaurant.aktiv !== false}
      avatarLabel={avatarLabel}
      previewUrl={`https://qrave.menu/${state.restaurant.slug}`}
      onQuickAction={onQuickAction}
    >
      <div className="mx-auto w-full max-w-[1200px] px-5 pb-16 pt-6 md:px-8 md:pt-8">
        <SettingsContent
          restaurant={state.restaurant}
          userEmail={state.userEmail}
          onLogout={() => void mutations.handleLogout()}
          logoPreview={mutations.logoPreview}
          onLogoFileChange={(e) => void mutations.handleLogoChange(e)}
          extracting={mutations.extracting}
          brandingMessage={mutations.brandingMessage}
          currentLogoUrl={mutations.currentLogoUrl}
          onPatchRestaurant={mutations.handlePatchRestaurant}
          onToast={onToast}
          splashMediaUrl={state.restaurant.splash_media_url ?? null}
          splashMediaType={state.restaurant.splash_media_type ?? null}
          splashUploading={mutations.splashUploading}
          onSplashMediaFileChange={(e) => void mutations.handleSplashMediaChange(e)}
          onSplashMediaRemove={() => void mutations.handleSplashMediaRemove()}
        />
      </div>
      <DashboardToast message={toast} onHide={() => setToast(null)} />
    </DashboardShell>
  );
}
