"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

type Prefill = {
  name: string;
  cuisine: string;
  stadt: string;
  telefon: string;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login?redirect=/onboarding");
        return;
      }
      const { data, error } = await supabase
        .from("restaurants")
        .select("name, cuisine_type, stadt, telefon, onboarding_completed")
        .eq("auth_user_id", session.user.id)
        .single();
      if (cancelled) return;
      if (error || !data) {
        router.replace("/dashboard");
        return;
      }
      if (data.onboarding_completed) {
        router.replace("/dashboard");
        return;
      }
      setPrefill({
        name: data.name ?? "",
        cuisine: data.cuisine_type ?? "",
        stadt: data.stadt ?? "",
        telefon: data.telefon ?? "",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!prefill) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center font-sans text-sm"
        style={{ backgroundColor: "#06040e", color: "rgba(255,255,255,0.5)" }}
      >
        Onboarding wird geladen …
      </div>
    );
  }

  return (
    <OnboardingWizard
      initialName={prefill.name}
      initialCuisine={prefill.cuisine}
      initialStadt={prefill.stadt}
      initialTelefon={prefill.telefon}
    />
  );
}
