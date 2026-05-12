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
>;

const RESTAURANT_PUBLIC_SELECT =
  "id, slug, name, template, accent_color, primary_color, logo_url, splash_image_url, guest_note, adresse, stadt, stadtbezirk, telefon, email, whatsapp, instagram, maps_url, website, oeffnungszeiten";

/** Lädt das Restaurant für Splash + Kontakt-Seite — ohne Menu-Items.
 *  Anon-key + Public-SELECT-Policy reicht. */
export async function loadRestaurantPublicBySlug(slug: string): Promise<PublicRestaurant | null> {
  const { data, error } = await supabase
    .from("restaurants")
    .select(RESTAURANT_PUBLIC_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as PublicRestaurant;
}
