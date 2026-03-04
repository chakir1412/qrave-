import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Restaurant, MenuItem } from "@/lib/supabase";
import SpeisekarteClient from "@/components/SpeisekarteClient";

export default async function SpeisekartePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: restaurantData, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, slug, name")
    .eq("slug", slug)
    .single();

  if (restaurantError || !restaurantData) {
    notFound();
  }

  const restaurant = restaurantData as Restaurant;

  const { data: itemsData, error: itemsError } = await supabase
    .from("menu_items")
    .select("id, restaurant_id, name, beschreibung, preis, kategorie, bild_url, aktiv, tags")
    .eq("restaurant_id", restaurant.id)
    .eq("aktiv", true);

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

  return (
    <SpeisekarteClient
      categories={categories}
      menuItems={menuItems}
      restaurantName={restaurant.name}
    />
  );
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
