import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { supabase } from "@/lib/supabase";
import { berlinDateParts, berlinYmd } from "@/lib/berlin-time";
import { loadRestaurantPublicBySlug } from "@/lib/load-restaurant-public";
import SplashScreen from "@/components/splash/SplashScreen";

export const runtime = "nodejs";

async function hashIp(ip: string): Promise<string | null> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return null;
  // Täglich rotierender HMAC-Key. Hash desselben IP morgen ≠ heute,
  // also keine Cross-Day-Reidentifikation möglich. Brute-Force-Reversion
  // der IP innerhalb eines Tages bleibt theoretisch möglich, hat aber
  // nur 24h Lebensdauer und wird durch die 48h-Deletion endgültig
  // ausgehebelt.
  const dateKey = new Date().toISOString().slice(0, 10);
  const secretKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${cronSecret}:${dateKey}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign(
    "HMAC",
    secretKey,
    new TextEncoder().encode(ip),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

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
  // DSGVO: IP nie im Klartext speichern. SHA-256 ist irreversibel — Base64
  // (vorher) wäre dekodierbar gewesen.
  const ipHash = ip.length > 0 ? await hashIp(ip) : null;
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

  // Tages-Special für heute (Europe/Berlin). Erste Zeile reicht — wir zeigen
  // nur eine Pill mit dem Item-Namen.
  const todayBerlin = berlinYmd(new Date());
  const { data: pushRows } = await supabase
    .from("daily_push")
    .select("item_name, item_emoji")
    .eq("restaurant_id", restaurant.id)
    .eq("active_date", todayBerlin)
    .order("created_at", { ascending: true })
    .limit(1);
  const first = pushRows?.[0] as { item_name?: string; item_emoji?: string | null } | undefined;
  const todaySpecial =
    first && typeof first.item_name === "string" && first.item_name.trim().length > 0
      ? { name: first.item_name, emoji: first.item_emoji ?? null }
      : null;

  return <SplashScreen restaurant={restaurant} todaySpecial={todaySpecial} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await loadRestaurantPublicBySlug(slug);
  const name = restaurant?.name;
  const title = name ?? "Qrave – Digitale Speisekarte";
  const description = name
    ? `Entdecke die digitale Speisekarte von ${name} auf qrave.menu`
    : "Digitale Speisekarten auf qrave.menu";
  const url = `https://qrave.menu/${slug}`;
  // Splash-Foto als og:image. Priorität:
  //   1) splash_media_url (nur wenn media_type === "image" — Videos
  //      taugen nicht als OG-Asset).
  //   2) splash_image_url (Legacy-Feld vor Media-Upload-Migration).
  //   3) Statisches /og-image.jpg als Fallback.
  const splashMedia = restaurant?.splash_media_url?.trim();
  const splashLegacy = restaurant?.splash_image_url?.trim();
  const mediaIsImage = restaurant?.splash_media_type !== "video";
  const ogImage =
    (mediaIsImage && splashMedia && splashMedia.length > 0
      ? splashMedia
      : splashLegacy && splashLegacy.length > 0
        ? splashLegacy
        : "https://qrave.menu/og-image.jpg");
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
