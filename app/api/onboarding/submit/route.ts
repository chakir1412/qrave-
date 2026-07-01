import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { sendOnboardingNotification } from "@/lib/email";
import { CUISINE_TYPES } from "@/lib/onboarding-cuisines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10_000_000; // 10 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const CUISINE_SET = new Set(CUISINE_TYPES);

function extForMime(mime: string, fallback: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return fallback;
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit("onboarding-submit", ip, 5, "1 h");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Zu viele Onboarding-Versuche. Bitte später erneut versuchen." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  // Auth: Cookie ODER Authorization: Bearer.
  // Der Browser-Client (lib/supabase.ts) persistiert nur in localStorage —
  // ohne Bearer würde Server-side kein User erkannt werden.
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

  let user = (await supabase.auth.getUser()).data.user;
  if (!user) {
    const bearer = req.headers.get("authorization") ?? "";
    const token = bearer.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : "";
    if (token) {
      const { data } = await supabase.auth.getUser(token);
      if (data.user) user = data.user;
    }
  }
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Anfrage-Body konnte nicht gelesen werden." }, { status: 400 });
  }

  const name = ((formData.get("name") as string | null) ?? "").trim();
  const cuisineType = ((formData.get("cuisine_type") as string | null) ?? "").trim();
  const stadt = ((formData.get("stadt") as string | null) ?? "").trim();
  const telefon = ((formData.get("telefon") as string | null) ?? "").trim();
  const linkRaw = ((formData.get("link") as string | null) ?? "").trim();
  const fileField = formData.get("file");
  const hasFile = fileField instanceof File && fileField.size > 0;

  if (name.length < 2) {
    return NextResponse.json({ error: "Restaurantname fehlt" }, { status: 400 });
  }
  if (!CUISINE_SET.has(cuisineType)) {
    return NextResponse.json({ error: "Ungültige Art des Restaurants" }, { status: 400 });
  }
  if (stadt.length < 2) {
    return NextResponse.json({ error: "Stadt fehlt" }, { status: 400 });
  }
  if (telefon.length < 4) {
    return NextResponse.json({ error: "Telefonnummer fehlt" }, { status: 400 });
  }
  if (!hasFile && !linkRaw) {
    return NextResponse.json(
      { error: "Bitte Speisekarte hochladen oder Link angeben." },
      { status: 400 },
    );
  }
  if (linkRaw && !isHttpUrl(linkRaw)) {
    return NextResponse.json({ error: "Link ist keine gültige URL" }, { status: 400 });
  }
  if (hasFile) {
    if (fileField.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `Datei zu groß (max. ${Math.round(MAX_FILE_BYTES / 1_000_000)} MB)` },
        { status: 400 },
      );
    }
    if (!ALLOWED_MIME.has(fileField.type)) {
      return NextResponse.json(
        { error: "Nur PDF, PNG, JPG oder WebP erlaubt." },
        { status: 400 },
      );
    }
  }

  const srv = createServiceRoleClient();

  // Aktuelles Restaurant für diesen Auth-User laden
  const { data: existing, error: loadErr } = await srv
    .from("restaurants")
    .select("id, slug, name, email")
    .eq("auth_user_id", user.id)
    .single();

  if (loadErr || !existing) {
    return NextResponse.json(
      { error: "Kein Restaurant für deinen Account gefunden." },
      { status: 404 },
    );
  }

  // Datei hochladen (falls vorhanden)
  let fileUrl: string | null = null;
  if (hasFile) {
    const ext = extForMime(fileField.type, "bin");
    const stamp = Date.now();
    const path = `onboarding/${user.id}/${stamp}-speisekarte.${ext}`;
    const buf = Buffer.from(await fileField.arrayBuffer());
    const { error: upErr } = await srv.storage
      .from("restaurant-assets")
      .upload(path, buf, {
        upsert: true,
        contentType: fileField.type,
      });
    if (upErr) {
      console.error("[onboarding/submit] file upload:", upErr);
      return NextResponse.json({ error: "Datei-Upload fehlgeschlagen" }, { status: 500 });
    }
    const { data: pub } = srv.storage.from("restaurant-assets").getPublicUrl(path);
    fileUrl = pub.publicUrl ?? null;
  }

  const link = linkRaw || null;

  const { error: updErr } = await srv
    .from("restaurants")
    .update({
      name,
      cuisine_type: cuisineType,
      stadt,
      telefon,
      onboarding_file_url: fileUrl,
      onboarding_link: link,
      onboarding_completed: true,
    })
    .eq("id", existing.id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  try {
    await sendOnboardingNotification({
      restaurantId: existing.id,
      restaurantName: name,
      slug: existing.slug,
      cuisineType,
      stadt,
      telefon,
      ownerEmail: existing.email ?? user.email ?? "—",
      fileUrl,
      link,
    });
  } catch (mailErr) {
    console.error("[onboarding/submit] sendOnboardingNotification:", mailErr);
  }

  return NextResponse.json({ ok: true });
}
