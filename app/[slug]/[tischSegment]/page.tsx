import type { ComponentType } from "react";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadPublicSpeisekarteBySlug } from "@/lib/load-public-speisekarte";
import { loadSponsoredItems } from "@/lib/speisekarte-logic";
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

export const runtime = "nodejs";

const templateMap: Record<string, ComponentType<SpeisekarteProps>> = {
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

  // Tisch existiert nicht in DB → ohne Tisch-Tracking weiterlaufen (Phase-1-Verhalten).

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
    dailyPushes: data.dailyPushes,
    restaurantId: data.restaurant.id,
    tischNummer: tischNr,
    sponsoredItems,
    guestNote: data.restaurant.guest_note ?? null,
    lunchOffers: data.lunchOffers,
    backgroundMode: (data.restaurant as { background_mode?: string | null }).background_mode ?? null,
    customBgColor: (data.restaurant as { custom_bg_color?: string | null }).custom_bg_color ?? null,
    customTextColor: (data.restaurant as { custom_text_color?: string | null }).custom_text_color ?? null,
  };

  const templateKey = (data.restaurant.template ?? "minimal") as string;
  const TemplateComponent = templateMap[templateKey] ?? templateMap["minimal"];

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
