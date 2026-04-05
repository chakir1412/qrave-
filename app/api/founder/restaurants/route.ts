import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";

const RESTAURANT_STATUSES = new Set(["in_einrichtung", "live", "offline"]);

type Body = {
  name?: string;
  stadt?: string;
  adresse?: string;
  telefon?: string;
  slug?: string;
  ansprechpartner?: string;
  status?: string;
  naechster_besuch?: string;
  notiz?: string;
};

function parseBody(raw: string | null): Body {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Body;
  } catch {
    return {};
  }
}

/**
 * Legt ein Restaurant an (nur Founder). Insert über Service Role, da RLS für `restaurants`
 * typischerweise kein INSERT für die Founder-Session erlaubt.
 */
export async function POST(req: Request) {
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

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user || user.id !== process.env.FOUNDER_USER_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = parseBody(await req.text().catch(() => null));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const stadt = typeof body.stadt === "string" ? body.stadt.trim() : "";
  const slugRaw = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const adresse = typeof body.adresse === "string" && body.adresse.trim() ? body.adresse.trim() : null;
  const telefon = typeof body.telefon === "string" && body.telefon.trim() ? body.telefon.trim() : null;
  const ansprechpartner =
    typeof body.ansprechpartner === "string" && body.ansprechpartner.trim()
      ? body.ansprechpartner.trim()
      : null;
  const statusRaw = typeof body.status === "string" ? body.status.trim() : "in_einrichtung";
  const status = RESTAURANT_STATUSES.has(statusRaw) ? statusRaw : "in_einrichtung";
  const naechsterBesuchRaw =
    typeof body.naechster_besuch === "string" && body.naechster_besuch.trim()
      ? body.naechster_besuch.trim()
      : "";
  const naechster_besuch = naechsterBesuchRaw ? naechsterBesuchRaw.slice(0, 10) : null;
  const notiz = typeof body.notiz === "string" && body.notiz.trim() ? body.notiz.trim() : null;

  if (!name) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }
  if (!stadt) {
    return NextResponse.json({ error: "Stadt ist erforderlich" }, { status: 400 });
  }
  if (!slugRaw) {
    return NextResponse.json({ error: "Slug ist erforderlich" }, { status: 400 });
  }

  let srv;
  try {
    srv = createServiceRoleClient();
  } catch {
    return NextResponse.json({ error: "Server-Konfiguration unvollständig" }, { status: 500 });
  }

  const { data: existing, error: exErr } = await srv.from("restaurants").select("id").eq("slug", slugRaw).maybeSingle();
  if (exErr) {
    return NextResponse.json({ error: exErr.message }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json(
      { error: `Der Slug „${slugRaw}“ ist bereits vergeben. Bitte einen anderen Slug wählen.` },
      { status: 409 },
    );
  }

  const { data: row, error: insErr } = await srv
    .from("restaurants")
    .insert({
      name,
      slug: slugRaw,
      stadt,
      adresse,
      telefon,
      ansprechpartner,
      status,
      naechster_besuch,
      notiz,
      aktiv: status === "live",
    })
    .select()
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json(
        { error: `Der Slug „${slugRaw}“ ist bereits vergeben. Bitte einen anderen Slug wählen.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ restaurant: row });
}
