import React from "react";
import { notFound } from "next/navigation";
import { supabase, fetchDailyPush } from "@/lib/supabase";
import type { Restaurant, MenuItem } from "@/lib/supabase";
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

  const { data: restaurantData, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, slug, name, template")
    .eq("slug", slug)
    .single();

  if (restaurantError || !restaurantData) {
    notFound();
  }

  const restaurant = restaurantData as Restaurant;

  const extendedSelect =
    "id, restaurant_id, name, beschreibung, preis, kategorie, bild_url, aktiv, tags, emoji, allergen_ids, sponsored, partner_name, preis_volumen, sort_order, is_highlight, main_tab, section_subtitle";
  const baseSelect = "id, restaurant_id, name, beschreibung, preis, kategorie, main_tab, bild_url, aktiv, tags";

  let itemsData: unknown = null;
  let itemsError: { message: string } | null = null;

  const res = await supabase
    .from("menu_items")
    .select(extendedSelect)
    .eq("restaurant_id", restaurant.id)
    .eq("aktiv", true);
  itemsData = res.data;
  itemsError = res.error;

  if (itemsError?.message?.includes("column") || itemsError?.message?.includes("does not exist")) {
    const fallback = await supabase
      .from("menu_items")
      .select(baseSelect)
      .eq("restaurant_id", restaurant.id)
      .eq("aktiv", true);
    itemsData = fallback.data;
    itemsError = fallback.error;
  }

  if (itemsError) {
    console.error("Supabase menu_items:", itemsError);
    notFound();
  }

  const menuItems = (itemsData ?? []) as MenuItem[];

  const categories = [
    ...new Set(
      menuItems.map((item) => (item.kategorie?.trim() || "Sonstiges"))
    ),
  ].sort();

  const highlights = menuItems.filter((item) => item.is_highlight === true);
  const dailyPush = await fetchDailyPush(restaurant.id);

  const templateProps: SpeisekarteProps = {
    categories,
    menuItems,
    restaurantName: restaurant.name,
    highlights,
    dailyPush,
  };

  const templateKey = (restaurant.template ?? "bar-soleil") as string;
  const TemplateComponent = templateMap[templateKey] ?? templateMap["bar-soleil"];

  return <TemplateComponent {...templateProps} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data } = await supabase
    .from("restaurants")
    .select("name")
    .eq("slug", slug)
    .single();

  const name = (data as { name: string } | null)?.name ?? "Speisekarte";
  return {
    title: `${name} – Speisekarte`,
    description: `Digitale Speisekarte – ${name}`,
  };
}
