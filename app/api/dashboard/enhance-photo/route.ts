import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import { checkRateLimit, rateLimitHeaders, isUuid } from "@/lib/rate-limit";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const PHOTO_QUOTA_MONTHLY = 5;
const BACKGROUND_PROMPT =
  "warm rustic table setting, soft natural daylight, neutral marble or wood surface, minimal professional food photography styling, no people, no hands, no added props";

export async function POST(req: Request) {
  let body: { restaurantId?: unknown; imageUrl?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId : "";
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";

  if (!isUuid(restaurantId)) {
    return NextResponse.json(
      { success: false, error: "restaurantId fehlt oder ungültig." },
      { status: 400 },
    );
  }
  if (imageUrl.length === 0 || !/^https?:\/\//i.test(imageUrl)) {
    return NextResponse.json(
      { success: false, error: "Bild-URL fehlt oder ungültig." },
      { status: 400 },
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

  const used = Number(restaurantRow.photo_credits_used_month ?? 0);
  if (Number.isFinite(used) && used >= PHOTO_QUOTA_MONTHLY) {
    return NextResponse.json(
      {
        success: false,
        error: "quota_reached",
        message: "Kontingent für diesen Monat erreicht — schreib uns.",
        whatsapp: "https://wa.me/491738996449",
      },
      { status: 402 },
    );
  }

  const rl = await checkRateLimit("enhance-photo", restaurantId, 10, "1 h");
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Rate Limit überschritten — bitte später erneut versuchen." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const apiKey = process.env.PHOTOROOM_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "PHOTOROOM_API_KEY ist nicht konfiguriert." },
      { status: 500 },
    );
  }

  const params = new URLSearchParams();
  params.set("imageUrl", imageUrl);
  params.set("background.prompt", BACKGROUND_PROMPT);
  params.set("export.format", "jpeg");
  const photoroomUrl = `https://image-api.photoroom.com/v2/edit?${params.toString()}`;

  let photoroomRes: Response;
  try {
    photoroomRes = await fetch(photoroomUrl, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        Accept: "image/jpeg",
      },
    });
  } catch (e) {
    console.error("[enhance-photo] fetch failed:", e);
    return NextResponse.json(
      { success: false, error: "Photoroom-Aufruf fehlgeschlagen." },
      { status: 502 },
    );
  }

  if (!photoroomRes.ok) {
    const errText = await photoroomRes.text().catch(() => "");
    console.error("[enhance-photo] photoroom error:", photoroomRes.status, errText.slice(0, 400));
    return NextResponse.json(
      { success: false, error: `Photoroom ${photoroomRes.status}` },
      { status: 502 },
    );
  }

  const arrayBuf = await photoroomRes.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString("base64");
  const dataUrl = `data:image/jpeg;base64,${base64}`;

  return NextResponse.json({ success: true, dataUrl });
}
