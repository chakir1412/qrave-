import React from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { loadPublicSpeisekarteBySlug } from "@/lib/load-public-speisekarte";
import { loadRestaurantPublicBySlug } from "@/lib/load-restaurant-public";
import { loadSponsoredItems } from "@/lib/speisekarte-logic";
import { detectLocale, localizeMenuItems, RTL_LOCALES, type SupportedLocale } from "@/lib/menu-i18n";
import type { SpeisekarteProps } from "@/components/speisekarte";
import HeritageTemplate from "@/components/templates/Heritage";
import NoirTemplate from "@/components/templates/Noir";
import CleanTemplate from "@/components/templates/Clean";
import TrattoriaTemplate from "@/components/templates/Trattoria";
import MinimalTemplate from "@/components/templates/Minimal";
import PlayfulTemplate from "@/components/templates/Playful";
import AsianDarkTemplate from "@/components/templates/AsianDark";
import StreetFoodTemplate from "@/components/templates/StreetFood";
import MediterraneanTemplate from "@/components/templates/Mediterranean";
import BlossomTemplate from "@/components/templates/Blossom";
import { KarteLocaleSync } from "@/components/speisekarte/KarteLocaleSync";

const templateMap: Record<string, React.ComponentType<SpeisekarteProps>> = {
  heritage: HeritageTemplate,
  noir: NoirTemplate,
  clean: CleanTemplate,
  trattoria: TrattoriaTemplate,
  minimal: MinimalTemplate,
  playful: PlayfulTemplate,
  "asian-dark": AsianDarkTemplate,
  "street-food": StreetFoodTemplate,
  mediterranean: MediterraneanTemplate,
  blossom: BlossomTemplate,
};

export default async function SpeisekartePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const localeOverride = typeof sp.locale === "string" ? sp.locale : undefined;

  const data = await loadPublicSpeisekarteBySlug(slug);
  if (!data) {
    notFound();
  }

  // Sponsored-Items + Header parallel — DB-Hop entfällt aus der TTFB.
  const [sponsoredItems, headerStore] = await Promise.all([
    loadSponsoredItems(data.restaurant.id),
    headers(),
  ]);

  // Sprache aus `Accept-Language` ableiten. Restaurant kann die Sprache
  // im Dashboard deaktiviert haben — dann Fallback auf Deutsch.
  const acceptLanguage = headerStore.get("accept-language");
  const detected = detectLocale(localeOverride ?? acceptLanguage);
  const activeLanguages = (data.restaurant.active_languages ?? ["de"]).filter(
    (code): code is SupportedLocale => typeof code === "string",
  );
  const locale: SupportedLocale = activeLanguages.includes(detected) ? detected : "de";
  const isRtl = RTL_LOCALES.has(locale);

  const localizedItems = localizeMenuItems(data.menuItems, locale);

  const templateProps: SpeisekarteProps = {
    categories: data.categories,
    menuItems: localizedItems,
    restaurantName: data.restaurant.name,
    accentColor: data.restaurant.accent_color ?? undefined,
    logoUrl: data.restaurant.logo_url ?? undefined,
    dailyPushes: data.dailyPushes,
    restaurantId: data.restaurant.id,
    sponsoredItems,
    guestNote: data.restaurant.guest_note ?? null,
    lunchOffers: data.lunchOffers,
    backgroundMode: (data.restaurant as { background_mode?: string | null }).background_mode ?? null,
    customBgColor: (data.restaurant as { custom_bg_color?: string | null }).custom_bg_color ?? null,
    customTextColor: (data.restaurant as { custom_text_color?: string | null }).custom_text_color ?? null,
    locale,
  };

  const templateKey = (data.restaurant.template ?? "minimal") as string;
  const TemplateComponent = templateMap[templateKey] ?? templateMap["minimal"];

  // `dir`-Attribut wirkt für CSS logical properties + Text-Richtung;
  // alle Templates erben es vom Wrapper, ohne dass jedes einzeln angepasst werden muss.
  return (
    <div dir={isRtl ? "rtl" : "ltr"} lang={locale}>
      <KarteLocaleSync
        slug={slug}
        activeLanguages={activeLanguages}
        renderedLocale={locale}
        urlHasLocale={typeof localeOverride === "string"}
      />
      <TemplateComponent {...templateProps} />
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await loadRestaurantPublicBySlug(slug);
  const name = restaurant?.name;
  const title = name ? `${name} – Speisekarte` : "Qrave – Digitale Speisekarte";
  const description = name
    ? `Die digitale Speisekarte von ${name}. Jetzt online entdecken.`
    : "Digitale Speisekarten auf qrave.menu";
  const url = `https://qrave.menu/${slug}/karte`;
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
