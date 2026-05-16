import React from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { loadPublicSpeisekarteBySlug } from "@/lib/load-public-speisekarte";
import { loadSponsoredItems } from "@/lib/speisekarte-logic";
import { detectLocale, localizeMenuItems, RTL_LOCALES, type SupportedLocale } from "@/lib/menu-i18n";
import type { SpeisekarteProps } from "@/components/speisekarte";
import FrankfurterWirtshausTemplate from "@/components/templates/FrankfurterWirtshaus";

const templateMap: Record<string, React.ComponentType<SpeisekarteProps>> = {
  "frankfurter-wirtshaus": FrankfurterWirtshausTemplate,
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

  const sponsoredItems = await loadSponsoredItems(data.restaurant.id);

  // Sprache aus `Accept-Language` ableiten. Restaurant kann die Sprache
  // im Dashboard deaktiviert haben — dann Fallback auf Deutsch.
  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  const detected = detectLocale(localeOverride ?? acceptLanguage);
  const activeLanguages = (data.restaurant.active_languages ?? ["de"]).filter(
    (code): code is SupportedLocale => typeof code === "string",
  );
  const locale: SupportedLocale = activeLanguages.includes(detected) ? detected : "de";
  const isRtl = RTL_LOCALES.has(locale);

  const localizedItems = localizeMenuItems(data.menuItems, locale);
  const localizedHighlights = localizeMenuItems(data.highlights, locale);

  const templateProps: SpeisekarteProps = {
    categories: data.categories,
    menuItems: localizedItems,
    restaurantName: data.restaurant.name,
    accentColor: data.restaurant.accent_color ?? undefined,
    logoUrl: data.restaurant.logo_url ?? undefined,
    highlights: localizedHighlights,
    dailyPushes: data.dailyPushes,
    restaurantId: data.restaurant.id,
    sponsoredItems,
    guestNote: data.restaurant.guest_note ?? null,
    lunchOffers: data.lunchOffers,
  };

  const templateKey = (data.restaurant.template ?? "frankfurter-wirtshaus") as string;
  const TemplateComponent = templateMap[templateKey] ?? templateMap["frankfurter-wirtshaus"];

  // `dir`-Attribut wirkt für CSS logical properties + Text-Richtung;
  // alle Templates erben es vom Wrapper, ohne dass jedes einzeln angepasst werden muss.
  return (
    <div dir={isRtl ? "rtl" : "ltr"} lang={locale}>
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
  const data = await loadPublicSpeisekarteBySlug(slug);
  const name = data?.restaurant.name ?? "Speisekarte";
  return {
    title: `${name} – Speisekarte`,
  };
}
