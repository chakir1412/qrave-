import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import { createServiceRoleClient } from "@/lib/supabase-service-role";

export const metadata: Metadata = {
  title: "Onboarding – Qrave",
  description: "Letzter Schritt: Erzähl uns kurz, was du anbietest.",
};

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
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
  if (!user) {
    redirect("/login?redirect=/onboarding");
  }

  const srv = createServiceRoleClient();
  const { data: restaurant } = await srv
    .from("restaurants")
    .select("id, name, cuisine_type, stadt, telefon, onboarding_completed")
    .eq("auth_user_id", user.id)
    .single();

  if (!restaurant) {
    redirect("/dashboard");
  }

  if (restaurant.onboarding_completed) {
    redirect("/dashboard");
  }

  return (
    <OnboardingWizard
      initialName={restaurant.name ?? ""}
      initialCuisine={restaurant.cuisine_type ?? ""}
      initialStadt={restaurant.stadt ?? ""}
      initialTelefon={restaurant.telefon ?? ""}
    />
  );
}
