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
  const name = restaurant?.name;
  const title = name
    ? `${name} – Kontakt & Öffnungszeiten`
    : "Qrave – Digitale Speisekarte";
  const description = name
    ? `Kontakt, Adresse und Öffnungszeiten von ${name}.`
    : "Digitale Speisekarten auf qrave.menu";
  const url = `https://qrave.menu/${slug}/kontakt`;
  // Splash-Foto als og:image. Priorität:
  //   1) splash_media_url wenn Bild (kein Video).
  //   2) splash_image_url (Legacy).
  //   3) Statisches /og-image.jpg als Fallback.
  const splashMedia = restaurant?.splash_media_url?.trim();
  const splashLegacy = restaurant?.splash_image_url?.trim();
  const mediaIsImage = restaurant?.splash_media_type !== "video";
  const ogImage =
    mediaIsImage && splashMedia && splashMedia.length > 0
      ? splashMedia
      : splashLegacy && splashLegacy.length > 0
        ? splashLegacy
        : "https://qrave.menu/og-image.jpg";
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: "Qrave",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}
