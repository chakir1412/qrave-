import { notFound } from "next/navigation";
import { loadRestaurantPublicBySlug } from "@/lib/load-restaurant-public";
import ContactPage from "@/components/splash/ContactPage";

export default async function SlugKontaktPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await loadRestaurantPublicBySlug(slug);
  if (!restaurant) notFound();
  return <ContactPage restaurant={restaurant} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await loadRestaurantPublicBySlug(slug);
  const name = restaurant?.name ?? "Restaurant";
  return {
    title: `Kontakt – ${name}`,
  };
}
