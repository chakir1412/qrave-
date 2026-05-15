import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import { ensureUniqueSlug } from "@/lib/onboarding-slug";
import { sendRegistrationNotification } from "@/lib/email";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { sortOrderIndexForKategorie } from "@/lib/category-sort-order";

/** Subset von ParsedMenuItemDto, das für den Onboarding-Insert reicht. */
type OnboardingItem = {
  name: string;
  beschreibung: string | null;
  preis: number;
  kategorie: string;
  main_tab: string;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LOGO_BYTES = 2_000_000; // 2 MB

const ALLOWED_RESTAURANT_TYPES = new Set([
  "restaurant",
  "bar",
  "cafe",
  "bistro",
  "imbiss",
]);

function isHex(s: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(s.trim());
}
function normalizeHex(s: string): string {
  const t = s.trim();
  return t.startsWith("#") ? t : `#${t}`;
}

function readItems(raw: unknown): OnboardingItem[] {
  if (!Array.isArray(raw)) return [];
  const out: OnboardingItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    const preis = typeof o.preis === "number" ? o.preis : Number.parseFloat(String(o.preis ?? "0"));
    if (!Number.isFinite(preis)) continue;
    const kategorie = typeof o.kategorie === "string" ? o.kategorie.trim() : "Sonstiges";
    const main_tab = typeof o.main_tab === "string" ? o.main_tab.trim() : "speisen";
    out.push({
      name,
      beschreibung: typeof o.beschreibung === "string" ? o.beschreibung : null,
      preis,
      kategorie: kategorie || "Sonstiges",
      main_tab,
    });
  }
  return out;
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit("onboarding-register", ip, 3, "1 h");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Zu viele Registrierungs-Versuche. Bitte später erneut versuchen." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const adminSecret = process.env.ADMIN_SECRET?.trim();
  if (!adminSecret) {
    return NextResponse.json({ error: "Server nicht konfiguriert (ADMIN_SECRET fehlt)" }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Anfrage-Body konnte nicht gelesen werden." }, { status: 400 });
  }

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const email = ((formData.get("email") as string | null) ?? "").trim().toLowerCase();
  const password = (formData.get("password") as string | null) ?? "";
  const restaurantTyp = ((formData.get("restaurant_typ") as string | null) ?? "").trim().toLowerCase();
  const adresse = ((formData.get("adresse") as string | null) ?? "").trim() || null;
  const telefon = ((formData.get("telefon") as string | null) ?? "").trim() || null;
  const accentColorRaw = ((formData.get("accent_color") as string | null) ?? "").trim();
  const itemsJson = (formData.get("items") as string | null) ?? "[]";
  const logoFile = formData.get("logo");

  if (!name) return NextResponse.json({ error: "Restaurantname fehlt" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen haben" }, { status: 400 });
  }
  if (!ALLOWED_RESTAURANT_TYPES.has(restaurantTyp)) {
    return NextResponse.json({ error: "Ungültiger Betriebstyp" }, { status: 400 });
  }
  // Logo ist optional — Wirt kann es im Dashboard nachreichen.
  const hasLogo = logoFile instanceof File && logoFile.size > 0;
  if (hasLogo && logoFile.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: `Logo zu groß (max. ${Math.round(MAX_LOGO_BYTES / 1_000_000)} MB)` }, { status: 400 });
  }
  const accentColor = accentColorRaw && isHex(accentColorRaw) ? normalizeHex(accentColorRaw) : null;

  let parsedItems: OnboardingItem[] = [];
  try {
    parsedItems = readItems(JSON.parse(itemsJson));
  } catch {
    parsedItems = [];
  }

  const supabase = createServiceRoleClient();

  // 1. Slug eindeutig erzeugen
  let slug: string;
  try {
    slug = await ensureUniqueSlug(supabase, name);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Slug-Generierung fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // 2. Auth-User anlegen (auto-confirm, sodass der Wirt sich direkt einloggen kann)
  const createUserRes = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { restaurant_name: name },
  });
  if (createUserRes.error || !createUserRes.data.user) {
    const msg = createUserRes.error?.message ?? "Auth-User konnte nicht angelegt werden";
    const status = msg.toLowerCase().includes("already") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
  const userId = createUserRes.data.user.id;

  // 3. Logo in Storage hochladen — nur wenn ein File mitgesendet wurde.
  let logoUrl: string | null = null;
  if (hasLogo) {
    const ext = (() => {
      const lower = (logoFile.name || "").toLowerCase();
      if (lower.endsWith(".svg")) return "svg";
      if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
      return "png";
    })();
    const logoPath = `${userId}/logo.${ext}`;
    try {
      const logoBuf = Buffer.from(await logoFile.arrayBuffer());
      const { error: upErr } = await supabase.storage
        .from("restaurant-assets")
        .upload(logoPath, logoBuf, {
          upsert: true,
          contentType: logoFile.type || (ext === "svg" ? "image/svg+xml" : "image/png"),
        });
      if (!upErr) {
        const { data: pub } = supabase.storage.from("restaurant-assets").getPublicUrl(logoPath);
        logoUrl = pub.publicUrl ?? null;
      } else {
        console.error("[onboarding/register] logo upload:", upErr);
      }
    } catch (e) {
      console.error("[onboarding/register] logo:", e);
    }
  }

  // 4. Restaurant-Eintrag (published=false → wartet auf Admin-Freischaltung)
  const { data: restaurantRow, error: insErr } = await supabase
    .from("restaurants")
    .insert({
      slug,
      name,
      email,
      adresse,
      telefon,
      restaurant_typ: restaurantTyp,
      aktiv: true,
      published: false,
      auth_user_id: userId,
      logo_url: logoUrl,
      accent_color: accentColor,
      status: "in_einrichtung",
    })
    .select("id, slug, name")
    .single();

  if (insErr || !restaurantRow) {
    // Rollback: Auth-User wieder löschen, damit der Wirt es erneut versuchen kann
    await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json(
      { error: insErr?.message ?? "Restaurant konnte nicht angelegt werden" },
      { status: 500 },
    );
  }

  // 5. Menu-Items (best effort — Fehler kippen nicht die Registrierung)
  if (parsedItems.length > 0) {
    const rows = parsedItems.slice(0, 500).map((it) => ({
      restaurant_id: restaurantRow.id,
      name: it.name.slice(0, 200),
      beschreibung: it.beschreibung ? it.beschreibung.slice(0, 1000) : null,
      preis: Math.max(0, Math.round(it.preis * 100) / 100),
      kategorie: (it.kategorie || "Sonstiges").slice(0, 80),
      main_tab: it.main_tab || "speisen",
      aktiv: true,
      sort_order: sortOrderIndexForKategorie(it.kategorie ?? "Sonstiges"),
    }));
    const { error: itemsErr } = await supabase.from("menu_items").insert(rows);
    if (itemsErr) {
      console.error("[onboarding/register] menu_items insert:", itemsErr);
    }
  }

  // 6. Notification-Mail an Admin
  const origin =
    req.headers.get("origin") ??
    `https://${req.headers.get("host") ?? "qrave.menu"}`;
  const publishUrl = `${origin}/api/admin/publish-restaurant?id=${restaurantRow.id}&token=${encodeURIComponent(adminSecret)}`;
  await sendRegistrationNotification({
    restaurantId: restaurantRow.id,
    restaurantName: restaurantRow.name,
    slug: restaurantRow.slug,
    ownerEmail: email,
    adresse,
    telefon,
    restaurantTyp,
    publishUrl,
  });

  return NextResponse.json({
    ok: true,
    restaurant: { id: restaurantRow.id, slug: restaurantRow.slug, name: restaurantRow.name },
  });
}
