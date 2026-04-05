import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";

type CreateBody = {
  restaurantId?: string;
  bereich?: string;
  count?: number;
};

function parseBody(raw: string | null): CreateBody {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as CreateBody;
  } catch {
    return {};
  }
}

async function assertFounder(): Promise<Response | null> {
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
  return null;
}

/**
 * Legt pro Restaurant eine Serie neuer Tische mit fortlaufender `tisch_nummer` und `bereich` an.
 */
export async function POST(req: Request) {
  const denied = await assertFounder();
  if (denied) return denied;

  const body = parseBody(await req.text().catch(() => null));
  const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId.trim() : "";
  const bereich = typeof body.bereich === "string" ? body.bereich.trim() : "";
  const count = typeof body.count === "number" && Number.isFinite(body.count) ? Math.floor(body.count) : 0;

  if (!restaurantId) {
    return NextResponse.json({ error: "restaurantId fehlt" }, { status: 400 });
  }
  if (!bereich) {
    return NextResponse.json({ error: "Bereichsname fehlt" }, { status: 400 });
  }
  if (count < 1 || count > 120) {
    return NextResponse.json({ error: "Anzahl Tische muss zwischen 1 und 120 liegen" }, { status: 400 });
  }

  let srv;
  try {
    srv = createServiceRoleClient();
  } catch {
    return NextResponse.json({ error: "Server-Konfiguration unvollständig" }, { status: 500 });
  }

  const { data: nums, error: selErr } = await srv
    .from("restaurant_tables")
    .select("tisch_nummer")
    .eq("restaurant_id", restaurantId);
  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  const existing = (nums ?? []) as { tisch_nummer: number }[];
  const maxNum = existing.reduce((m, r) => Math.max(m, r.tisch_nummer), 0);
  const rows = Array.from({ length: count }, (_, i) => ({
    restaurant_id: restaurantId,
    tisch_nummer: maxNum + i + 1,
    bereich,
  }));

  const { data: inserted, error: insErr } = await srv.from("restaurant_tables").insert(rows).select();
  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json(
        { error: "Tisch-Nummern kollidieren — bitte erneut versuchen oder bestehende Tische prüfen." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ tables: inserted ?? [] });
}

/**
 * Query: `tableId` = einzelner Tisch, oder `restaurantId` + `bereich` = alle Tische des Bereichs.
 */
export async function DELETE(req: Request) {
  const denied = await assertFounder();
  if (denied) return denied;

  const url = new URL(req.url);
  const tableId = url.searchParams.get("tableId")?.trim() ?? "";
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const bereich = url.searchParams.get("bereich")?.trim() ?? "";
  const emptyBereich = url.searchParams.get("emptyBereich") === "1";

  let srv;
  try {
    srv = createServiceRoleClient();
  } catch {
    return NextResponse.json({ error: "Server-Konfiguration unvollständig" }, { status: 500 });
  }

  if (tableId) {
    const { error } = await srv.from("restaurant_tables").delete().eq("id", tableId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (restaurantId && emptyBereich) {
    const { error } = await srv
      .from("restaurant_tables")
      .delete()
      .eq("restaurant_id", restaurantId)
      .is("bereich", null);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (restaurantId && bereich) {
    const { error } = await srv
      .from("restaurant_tables")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("bereich", bereich);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "tableId oder restaurantId+bereich erforderlich" }, { status: 400 });
}
