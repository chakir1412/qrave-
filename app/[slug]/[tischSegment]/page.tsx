import type { ComponentType } from "react";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadPublicSpeisekarteBySlug } from "@/lib/load-public-speisekarte";
import { loadSponsoredItems } from "@/lib/speisekarte-logic";
import type { SpeisekarteProps } from "@/components/speisekarte";
import FrankfurterWirtshausTemplate from "@/components/templates/FrankfurterWirtshaus";

export const runtime = "nodejs";

const templateMap: Record<string, ComponentType<SpeisekarteProps>> = {
  "frankfurter-wirtshaus": FrankfurterWirtshausTemplate,
};

function parseTischNummer(segment: string): number | null {
  const m = /^tisch-(\d+)$/.exec(segment.trim().toLowerCase());
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default async function TischSpeisekartePage({
  params,
}: {
  params: Promise<{ slug: string; tischSegment: string }>;
}) {
  const { slug, tischSegment } = await params;
  const tischNr = parseTischNummer(tischSegment);
  if (tischNr === null) {
    notFound();
  }

  const data = await loadPublicSpeisekarteBySlug(slug);
  if (!data) {
    notFound();
  }

  const { restaurant } = data;

  const { data: tischLegacy, error: tischLegacyError } = await supabase
    .from("tables")
    .select("id, restaurant_id, tisch_nummer, aktiv")
    .eq("restaurant_id", data.restaurant.id)
    .eq("tisch_nummer", tischNr)
    .eq("aktiv", true)
    .maybeSingle();

  let tischExists = Boolean(tischLegacy);
  if (!tischExists) {
    const { data: tischNew, error: tischNewError } = await supabase
      .from("restaurant_tables")
      .select("id, restaurant_id, tisch_nummer")
      .eq("restaurant_id", data.restaurant.id)
      .eq("tisch_nummer", tischNr)
      .maybeSingle();
    tischExists = Boolean(tischNew);
    if (tischNewError) {
      console.error("Tisch lookup restaurant_tables:", tischNewError);
    }
  }

  if (tischLegacyError) {
    console.error("Tisch lookup tables:", tischLegacyError);
  }

  if (!tischExists) {
    console.log("Tisch fallback debug:", {
      slug,
      tischSegment,
      tischNr,
      restaurantFound: !!restaurant,
      restaurantId: restaurant?.id,
      tischFound: false,
      mode: "continue_without_table_tracking",
    });
  }

  // Tisch-Tracking vorbereitet — INSERT deaktiviert bis Phase 2
  // (dynamische QR-Codes pro Tisch). Tier-0 Scan wird aktuell in der
  // Splash-Route `app/[slug]/page.tsx` getrackt.

  const sponsoredItems = await loadSponsoredItems(data.restaurant.id);

  if (tischLegacy?.id) {
    const { error: rpcErr } = await supabase.rpc("increment_table_scan", {
      table_id: tischLegacy.id,
    });
    if (rpcErr) {
      console.error("increment_table_scan:", rpcErr);
    }
  }

  const templateProps: SpeisekarteProps = {
    categories: data.categories,
    menuItems: data.menuItems,
    restaurantName: data.restaurant.name,
    accentColor: data.restaurant.accent_color ?? undefined,
    logoUrl: data.restaurant.logo_url ?? undefined,
    highlights: data.highlights,
    dailyPushes: data.dailyPushes,
    restaurantId: data.restaurant.id,
    tischNummer: tischNr,
    sponsoredItems,
    guestNote: data.restaurant.guest_note ?? null,
    lunchOffers: data.lunchOffers,
  };

  const templateKey = (data.restaurant.template ?? "frankfurter-wirtshaus") as string;
  const TemplateComponent = templateMap[templateKey] ?? templateMap["frankfurter-wirtshaus"];

  return <TemplateComponent {...templateProps} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; tischSegment: string }>;
}) {
  const { tischSegment } = await params;
  const nr = parseTischNummer(tischSegment);
  return {
    title: nr !== null ? `Tisch ${nr}` : "Speisekarte",
  };
}
