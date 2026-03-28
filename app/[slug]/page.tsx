import React from "react";
import { notFound } from "next/navigation";
import { loadPublicSpeisekarteBySlug } from "@/lib/load-public-speisekarte";
import type { SpeisekarteProps } from "@/components/speisekarte";
import BarSoleilTemplate from "@/components/templates/BarSoleil";
import KioskNo7Template from "@/components/templates/KioskNo7";
import CompoundCafeTemplate from "@/components/templates/CompoundCafe";
import NamiSushiTemplate from "@/components/templates/NamiSushi";
import DaMarioTemplate from "@/components/templates/DaMario";
import RootsTemplate from "@/components/templates/RootsPlantKitchen";

const templateMap: Record<string, React.ComponentType<SpeisekarteProps>> = {
  "bar-soleil": BarSoleilTemplate,
  "kiosk-no7": KioskNo7Template,
  "compound-cafe": CompoundCafeTemplate,
  "nami-sushi": NamiSushiTemplate,
  "da-mario": DaMarioTemplate,
  roots: RootsTemplate,
};

export default async function SpeisekartePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const data = await loadPublicSpeisekarteBySlug(slug);
  if (!data) {
    notFound();
  }

  const templateProps: SpeisekarteProps = {
    categories: data.categories,
    menuItems: data.menuItems,
    restaurantName: data.restaurant.name,
    accentColor: data.restaurant.accent_color ?? undefined,
    logoUrl: data.restaurant.logo_url ?? undefined,
    highlights: data.highlights,
    dailyPush: data.dailyPush,
    restaurantId: data.restaurant.id,
  };

  const templateKey = (data.restaurant.template ?? "bar-soleil") as string;
  const TemplateComponent = templateMap[templateKey] ?? templateMap["bar-soleil"];

  return <TemplateComponent {...templateProps} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadPublicSpeisekarteBySlug(slug);
  const name = data?.restaurant.name ?? "Speisekarte";
  return {
    title: `${name} – Speisekarte`,
  };
}
