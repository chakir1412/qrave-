import { supabase } from "@/lib/supabase";
import type { Restaurant } from "@/lib/supabase";

/** Schmaler Restaurant-Type, der nur die für Splash + Kontakt relevanten
 *  Felder enthält. So muss der Loader nicht den vollen Restaurant-Type
 *  zurückgeben (der hat viele Founder-only-Spalten). */
export type PublicRestaurant = Pick<
  Restaurant,
  | "id"
  | "slug"
  | "name"
  | "template"
  | "accent_color"
  | "primary_color"
  | "logo_url"
  | "splash_image_url"
  | "splash_media_url"
  | "splash_media_type"
  | "active_languages"
  | "tisch_bereiche"
  | "guest_note"
  | "adresse"
  | "stadt"
  | "stadtbezirk"
  | "telefon"
  | "email"
  | "whatsapp"
  | "instagram"
  | "maps_url"
  | "website"
  | "oeffnungszeiten"
  | "aktiv"
  | "published"
>;

const RESTAURANT_PUBLIC_SELECT =
  "id, slug, name, template, accent_color, primary_color, logo_url, splash_image_url, splash_media_url, splash_media_type, active_languages, tisch_bereiche, guest_note, adresse, stadt, stadtbezirk, telefon, email, whatsapp, instagram, maps_url, website, oeffnungszeiten, aktiv, published";

/** Lädt das Restaurant für Splash + Kontakt-Seite — ohne Menu-Items.
 *  Anon-key + Public-SELECT-Policy reicht.
 *  Liefert null wenn slug nicht existiert ODER wenn published=false /
 *  aktiv=false — Gäste-Seiten sollen dann 404 zeigen. */
export async function loadRestaurantPublicBySlug(slug: string): Promise<PublicRestaurant | null> {
  const { data, error } = await supabase
    .from("restaurants")
    .select(RESTAURANT_PUBLIC_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as unknown as PublicRestaurant;
  if (r.published === false || r.aktiv === false) return null;
  return r;
}
