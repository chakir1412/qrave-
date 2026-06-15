import type { Metadata } from "next";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UploadImagesClient, type UploadImagesItem } from "./UploadImagesClient";

export const metadata: Metadata = {
  title: "Bild-Upload · Founder",
  robots: { index: false, follow: false },
};

export default async function FounderUploadImagesPage() {
  // Default-Restaurant per ENV — fällt zurück auf Frankfurter Wirtshaus solange
  // das Tool ein single-restaurant-Editor ist. Sobald Multi-Restaurant nötig
  // wird: per Query-Param oder Dropdown wählen lassen.
  const defaultRestaurantId =
    process.env.FOUNDER_UPLOAD_RESTAURANT_ID?.trim() ||
    "9a333508-fa4a-4586-9ed2-e79e4a79ba95";
  // Identische Auth wie /founder: Server-side getUser() gegen FOUNDER_USER_ID.
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/founder/login");
  if (user.id !== process.env.FOUNDER_USER_ID) {
    redirect("/founder/login");
  }

  const { data } = await supabase
    .from("menu_items")
    .select("id, name, kategorie, preis, bild_url, restaurant_id")
    .eq("restaurant_id", defaultRestaurantId)
    .order("kategorie", { ascending: true })
    .order("name", { ascending: true });

  return <UploadImagesClient initialItems={(data ?? []) as UploadImagesItem[]} />;
}
