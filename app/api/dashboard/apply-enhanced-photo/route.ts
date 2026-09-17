import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import { isUuid } from "@/lib/rate-limit";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BUCKET = "restaurant-assets";
const MENU_ITEM_SELECT =
  "id, restaurant_id, name, beschreibung, preis, kategorie, bild_url, aktiv, tags, emoji, main_tab, sort_order, allergens_text, allergens, additives_text";

function decodeDataUrl(dataUrl: string): Buffer | null {
  const m = /^data:image\/jpeg;base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  try {
    return Buffer.from(m[1], "base64");
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: { restaurantId?: unknown; menuItemId?: unknown; dataUrl?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId : "";
  const menuItemId = typeof body.menuItemId === "string" ? body.menuItemId : "";
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";

  if (!isUuid(restaurantId)) {
    return NextResponse.json(
      { success: false, error: "restaurantId fehlt oder ungültig." },
      { status: 400 },
    );
  }
  if (!isUuid(menuItemId)) {
    return NextResponse.json(
      { success: false, error: "menuItemId fehlt oder ungültig." },
      { status: 400 },
    );
  }
  const enhancedBuf = decodeDataUrl(dataUrl);
  if (!enhancedBuf) {
    return NextResponse.json(
      { success: false, error: "dataUrl fehlt oder ist kein JPEG." },
      { status: 400 },
    );
  }
  // 10 MB Obergrenze — Photoroom-Ergebnisse sind meist < 500 KB.
  if (enhancedBuf.length > 10 * 1024 * 1024) {
    return NextResponse.json(
      { success: false, error: "Bild zu groß." },
      { status: 413 },
    );
  }

  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
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
  let user = (await supabaseAuth.auth.getUser()).data.user;
  if (!user) {
    const bearer = req.headers.get("authorization") ?? "";
    const token = bearer.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : "";
    if (token) {
      const { data, error } = await supabaseAuth.auth.getUser(token);
      if (!error && data.user) user = data.user;
    }
  }
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const { data: restaurantRow, error: rErr } = await admin
    .from("restaurants")
    .select("id, auth_user_id, photo_credits_used_month")
    .eq("id", restaurantId)
    .maybeSingle();
  if (rErr || !restaurantRow) {
    return NextResponse.json(
      { success: false, error: "Restaurant nicht gefunden." },
      { status: 404 },
    );
  }
  const isOwner = restaurantRow.auth_user_id === user.id;
  const isFounder =
    (process.env.FOUNDER_USER_ID ?? "").length > 0 && user.id === process.env.FOUNDER_USER_ID;
  if (!isOwner && !isFounder) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { data: itemRow, error: iErr } = await admin
    .from("menu_items")
    .select("id, restaurant_id, bild_url")
    .eq("id", menuItemId)
    .maybeSingle();
  if (iErr || !itemRow) {
    return NextResponse.json(
      { success: false, error: "Gericht nicht gefunden." },
      { status: 404 },
    );
  }
  if (itemRow.restaurant_id !== restaurantId) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const folder = `menu-items/${restaurantId}`;
  const originalPath = `${folder}/${menuItemId}-original.jpg`;
  const targetPath = `${folder}/${menuItemId}.jpg`;

  // Original einmalig sichern — nur wenn -original.jpg noch nicht existiert
  // und ein bild_url zum Kopieren vorhanden ist.
  try {
    const { data: existingList } = await admin.storage
      .from(BUCKET)
      .list(folder, { search: `${menuItemId}-original` });
    const alreadyBackedUp = Array.isArray(existingList)
      && existingList.some((f) => f.name === `${menuItemId}-original.jpg`);
    if (!alreadyBackedUp && typeof itemRow.bild_url === "string" && itemRow.bild_url.length > 0) {
      const origRes = await fetch(itemRow.bild_url);
      if (origRes.ok) {
        const origBuf = Buffer.from(await origRes.arrayBuffer());
        const { error: origUploadErr } = await admin.storage
          .from(BUCKET)
          .upload(originalPath, origBuf, {
            cacheControl: "3600",
            upsert: false,
            contentType: "image/jpeg",
          });
        if (origUploadErr) {
          console.warn("[apply-enhanced-photo] Original-Backup fehlgeschlagen:", origUploadErr.message);
        }
      } else {
        console.warn("[apply-enhanced-photo] Original nicht ladbar:", origRes.status);
      }
    }
  } catch (e) {
    // Original-Sicherung ist best-effort — Feature bleibt funktional auch wenn's fehlschlägt.
    console.warn("[apply-enhanced-photo] Original-Sicherung Exception:", e);
  }

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(targetPath, enhancedBuf, {
      cacheControl: "3600",
      upsert: true,
      contentType: "image/jpeg",
    });
  if (uploadErr) {
    console.error("[apply-enhanced-photo] Upload fehlgeschlagen:", uploadErr);
    return NextResponse.json(
      { success: false, error: `Upload fehlgeschlagen: ${uploadErr.message}` },
      { status: 500 },
    );
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(targetPath);
  const newBildUrl = pub.publicUrl ? `${pub.publicUrl}?t=${Date.now()}` : null;

  const { data: updatedItem, error: updateErr } = await admin
    .from("menu_items")
    .update({ bild_url: newBildUrl })
    .eq("id", menuItemId)
    .select(MENU_ITEM_SELECT)
    .single();
  if (updateErr || !updatedItem) {
    return NextResponse.json(
      { success: false, error: updateErr?.message ?? "Update fehlgeschlagen." },
      { status: 500 },
    );
  }

  const currentUsed = Number(restaurantRow.photo_credits_used_month ?? 0);
  const nextUsed = Number.isFinite(currentUsed) && currentUsed >= 0 ? currentUsed + 1 : 1;
  const { error: creditErr } = await admin
    .from("restaurants")
    .update({ photo_credits_used_month: nextUsed })
    .eq("id", restaurantId);
  if (creditErr) {
    console.error("[apply-enhanced-photo] Credit-Update fehlgeschlagen:", creditErr);
    // Bild ist gespeichert — Fehler nur loggen, nicht rollbacken.
  }

  return NextResponse.json({
    success: true,
    item: updatedItem,
    creditsUsed: nextUsed,
  });
}
