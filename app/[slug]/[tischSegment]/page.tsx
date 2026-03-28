import type { ComponentType } from "react";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabase } from "@/lib/supabase";
import { loadPublicSpeisekarteBySlug } from "@/lib/load-public-speisekarte";
import type { SpeisekarteProps } from "@/components/speisekarte";
import BarSoleilTemplate from "@/components/templates/BarSoleil";
import KioskNo7Template from "@/components/templates/KioskNo7";
import CompoundCafeTemplate from "@/components/templates/CompoundCafe";
import NamiSushiTemplate from "@/components/templates/NamiSushi";
import DaMarioTemplate from "@/components/templates/DaMario";
import RootsTemplate from "@/components/templates/RootsPlantKitchen";

export const runtime = "nodejs";

const templateMap: Record<string, ComponentType<SpeisekarteProps>> = {
  "bar-soleil": BarSoleilTemplate,
  "kiosk-no7": KioskNo7Template,
  "compound-cafe": CompoundCafeTemplate,
  "nami-sushi": NamiSushiTemplate,
  "da-mario": DaMarioTemplate,
  roots: RootsTemplate,
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

  const { data: tisch, error: tischError } = await supabase
    .from("tables")
    .select("id, restaurant_id, tisch_nummer, aktiv")
    .eq("restaurant_id", data.restaurant.id)
    .eq("tisch_nummer", tischNr)
    .eq("aktiv", true)
    .maybeSingle();

  if (tischError || !tisch) {
    console.log("Tisch redirect debug:", {
      slug,
      tischSegment,
      tischNr,
      restaurantFound: !!restaurant,
      restaurantId: restaurant?.id,
      tischFound: !!tisch,
      tischAktiv: tisch?.aktiv,
    });
    redirect(`/${slug}`);
  }

  const headersList = await headers();
  const ua = headersList.get("user-agent") ?? "";
  const deviceType = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
  const forwarded = headersList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "";
  const ipHash =
    ip.length > 0 ? Buffer.from(ip, "utf8").toString("base64").slice(0, 16) : null;
  const now = new Date();
  const referer = headersList.get("referer") ?? "";
  const qrScanSource = referer.toLowerCase().includes("nfc") ? "nfc" : "qr_code";

  const { error: scanErr } = await supabase.from("scan_events").insert({
    restaurant_id: data.restaurant.id,
    tisch_nummer: tischNr,
    tier: 0,
    event_type: "scan",
    stunde: now.getHours(),
    wochentag: now.getDay(),
    monat: now.getMonth() + 1,
    jahr: now.getFullYear(),
    device_type: deviceType,
    ip_hash: ipHash,
    qr_scan_source: qrScanSource,
  });
  if (scanErr) {
    console.error("Tier-0 scan_events:", scanErr);
  }

  const { error: rpcErr } = await supabase.rpc("increment_table_scan", {
    table_id: tisch.id,
  });
  if (rpcErr) {
    console.error("increment_table_scan:", rpcErr);
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
    tischNummer: tischNr,
  };

  const templateKey = (data.restaurant.template ?? "bar-soleil") as string;
  const TemplateComponent = templateMap[templateKey] ?? templateMap["bar-soleil"];

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
