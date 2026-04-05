import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";

type JsonRecord = Record<string, unknown>;

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
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

function getService() {
  try {
    return createServiceRoleClient();
  } catch {
    return null;
  }
}

async function handleToggleStatus(
  srv: NonNullable<ReturnType<typeof getService>>,
  rec: JsonRecord,
): Promise<Response> {
  const tischIdFromTisch = typeof rec.tischId === "string" ? rec.tischId.trim() : "";
  const tischIdFromTable = typeof rec.tableId === "string" ? rec.tableId.trim() : "";
  const tischId = tischIdFromTisch || tischIdFromTable;
  const field = rec.field;
  if (!tischId) {
    return NextResponse.json({ error: "tischId fehlt" }, { status: 400 });
  }
  if (field !== "nfc_installiert" && field !== "sticker_installiert") {
    return NextResponse.json({ error: "field muss nfc_installiert oder sticker_installiert sein" }, { status: 400 });
  }

  const { data: cur, error: gErr } = await srv
    .from("restaurant_tables")
    .select("id, nfc_installiert, sticker_installiert")
    .eq("id", tischId)
    .maybeSingle();
  if (gErr) {
    return NextResponse.json({ error: gErr.message }, { status: 500 });
  }
  if (!cur) {
    return NextResponse.json({ error: "Tisch nicht gefunden" }, { status: 404 });
  }

  const row = cur as { id: string; nfc_installiert: boolean | null; sticker_installiert: boolean | null };
  const patch =
    field === "nfc_installiert"
      ? { nfc_installiert: !Boolean(row.nfc_installiert) }
      : { sticker_installiert: !Boolean(row.sticker_installiert) };

  const { data: updated, error: uErr } = await srv
    .from("restaurant_tables")
    .update(patch)
    .eq("id", tischId)
    .select()
    .maybeSingle();
  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }
  return NextResponse.json({ table: updated });
}

async function handleCreate(
  srv: NonNullable<ReturnType<typeof getService>>,
  restaurantId: string,
  bereich: string | null,
  count: number,
) {
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
 * PATCH: `{ action: "toggleStatus", tischId, field: "nfc_installiert" | "sticker_installiert" }`
 */
export async function PATCH(req: Request) {
  const denied = await assertFounder();
  if (denied) return denied;

  const srv = getService();
  if (!srv) {
    return NextResponse.json({ error: "Server-Konfiguration unvollständig" }, { status: 500 });
  }

  const parsed = parseJson(await req.text().catch(() => null));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }
  const body = parsed as JsonRecord;
  if (body.action !== "toggleStatus") {
    return NextResponse.json({ error: "Nur action: toggleStatus" }, { status: 400 });
  }
  return handleToggleStatus(srv, body);
}

/**
 * POST:
 * - Legacy / create: `{ restaurantId, bereich, count }` oder `{ action: "create", ... }`
 * - `{ action: "toggleStatus", tischId, field }` (wie PATCH)
 * - `{ action: "deleteMany", tableIds: string[] }`
 * - `{ action: "move", tableId, bereich }` (bereich `null` = ohne Bereich)
 * - `{ action: "renameArea", restaurantId, newBereich, oldBereichIsNull?, oldBereich? }`
 */
export async function POST(req: Request) {
  const denied = await assertFounder();
  if (denied) return denied;

  const parsed = parseJson(await req.text().catch(() => null));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }
  const body = parsed as JsonRecord;
  const action = typeof body.action === "string" ? body.action : null;

  const srv = getService();
  if (!srv) {
    return NextResponse.json({ error: "Server-Konfiguration unvollständig" }, { status: 500 });
  }

  if (action === "toggleStatus") {
    return handleToggleStatus(srv, body);
  }

  if (action === "deleteMany") {
    const rawIds = body.tableIds;
    if (!Array.isArray(rawIds)) {
      return NextResponse.json({ error: "tableIds muss ein Array sein" }, { status: 400 });
    }
    const tableIds = [...new Set(rawIds.filter((x): x is string => typeof x === "string" && x.length > 0))].slice(
      0,
      250,
    );
    if (tableIds.length === 0) {
      return NextResponse.json({ error: "Keine gültigen Tisch-IDs" }, { status: 400 });
    }
    const { error } = await srv.from("restaurant_tables").delete().in("id", tableIds);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, deleted: tableIds.length });
  }

  if (action === "move") {
    const tableId = typeof body.tableId === "string" ? body.tableId.trim() : "";
    if (!tableId) {
      return NextResponse.json({ error: "tableId fehlt" }, { status: 400 });
    }
    const bereichVal = body.bereich;
    const bereich =
      bereichVal === null || bereichVal === undefined
        ? null
        : typeof bereichVal === "string"
          ? bereichVal.trim() || null
          : null;
    const { data: row, error: uErr } = await srv
      .from("restaurant_tables")
      .update({ bereich })
      .eq("id", tableId)
      .select()
      .maybeSingle();
    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "Tisch nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ table: row });
  }

  if (action === "renameArea") {
    const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId.trim() : "";
    const newBereich = typeof body.newBereich === "string" ? body.newBereich.trim() : "";
    const oldBereichIsNull = body.oldBereichIsNull === true;
    const oldBereich = typeof body.oldBereich === "string" ? body.oldBereich.trim() : "";
    if (!restaurantId) {
      return NextResponse.json({ error: "restaurantId fehlt" }, { status: 400 });
    }
    if (!newBereich) {
      return NextResponse.json({ error: "Neuer Bereichsname fehlt" }, { status: 400 });
    }
    let q = srv.from("restaurant_tables").update({ bereich: newBereich }).eq("restaurant_id", restaurantId);
    if (oldBereichIsNull) {
      q = q.is("bereich", null);
    } else {
      if (!oldBereich) {
        return NextResponse.json({ error: "Alter Bereichsname fehlt" }, { status: 400 });
      }
      q = q.eq("bereich", oldBereich);
    }
    const { error: rErr } = await q;
    if (rErr) {
      return NextResponse.json({ error: rErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId.trim() : "";
  const bereichRaw = typeof body.bereich === "string" ? body.bereich.trim() : "";
  const bereichNull = body.bereichNull === true;
  const bereichForInsert: string | null = bereichNull ? null : bereichRaw;
  const count = typeof body.count === "number" && Number.isFinite(body.count) ? Math.floor(body.count) : 0;

  if (!restaurantId) {
    return NextResponse.json({ error: "restaurantId fehlt" }, { status: 400 });
  }
  if (!bereichNull && !bereichRaw) {
    return NextResponse.json({ error: "Bereichsname fehlt" }, { status: 400 });
  }
  if (count < 1 || count > 120) {
    return NextResponse.json({ error: "Anzahl Tische muss zwischen 1 und 120 liegen" }, { status: 400 });
  }

  if (action != null && action !== "create") {
    return NextResponse.json({ error: "Unbekannte action" }, { status: 400 });
  }

  return handleCreate(srv, restaurantId, bereichForInsert, count);
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

  const srv = getService();
  if (!srv) {
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
