import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { supabase } from "@/lib/supabase";
import { berlinDateParts } from "@/lib/berlin-time";
import { loadRestaurantPublicBySlug } from "@/lib/load-restaurant-public";
import SplashScreen from "@/components/splash/SplashScreen";

export const runtime = "nodejs";

export default async function SlugSplashPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await loadRestaurantPublicBySlug(slug);
  if (!restaurant) notFound();

  const headersList = await headers();
  const ua = headersList.get("user-agent") ?? "";
  const deviceType = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
  const forwarded = headersList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "";
  const ipHash =
    ip.length > 0 ? Buffer.from(ip, "utf8").toString("base64").slice(0, 16) : null;
  const referer = headersList.get("referer") ?? "";
  const qrScanSource = referer.toLowerCase().includes("nfc") ? "nfc" : "qr_code";

  // Vercel läuft in UTC — Zeitfelder werden in Europe/Berlin gespeichert
  // (wochentag = 1=Mo … 7=So). day_berlin ist keine Spalte in scan_events;
  // das Tagesdatum wird vom Cron aus created_at + stunde rekonstruiert.
  const { hour, weekdayMon1, month, year } = berlinDateParts(new Date());

  const { error: scanErr } = await supabase.from("scan_events").insert({
    restaurant_id: restaurant.id,
    tier: 0,
    event_type: "scan",
    stunde: hour,
    wochentag: weekdayMon1,
    monat: month,
    jahr: year,
    device_type: deviceType,
    ip_hash: ipHash,
    qr_scan_source: qrScanSource,
  });
  if (scanErr) {
    console.error("Tier-0 scan_events:", scanErr);
  }

  return <SplashScreen restaurant={restaurant} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await loadRestaurantPublicBySlug(slug);
  const name = restaurant?.name ?? "Speisekarte";
  return {
    title: name,
    description: restaurant?.guest_note ?? `Digitale Speisekarte von ${name}`,
  };
}
