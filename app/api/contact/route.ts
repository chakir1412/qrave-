import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";

const MAX_LEN = {
  name: 200,
  restaurant_name: 200,
  telefon: 80,
  nachricht: 5000,
} as const;

function readTrimmedString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function readOptionalTrimmed(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0) return null;
  return t.length > max ? t.slice(0, max) : t;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const rec = body as Record<string, unknown>;
  const name = readTrimmedString(rec.name, MAX_LEN.name);
  const restaurantName = readTrimmedString(rec.restaurant_name, MAX_LEN.restaurant_name);
  const telefon = readOptionalTrimmed(rec.telefon, MAX_LEN.telefon);
  const nachricht = readOptionalTrimmed(rec.nachricht, MAX_LEN.nachricht);

  if (!name || !restaurantName) {
    return NextResponse.json(
      { error: "Name und Restaurant-Name sind Pflichtfelder." },
      { status: 400 },
    );
  }

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("kontakt_anfragen").insert({
      name,
      restaurant_name: restaurantName,
      telefon,
      nachricht,
    });

    if (error) {
      console.error("[contact]", error.message);
      return NextResponse.json({ error: "Speichern fehlgeschlagen. Bitte später erneut versuchen." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[contact]", e);
    return NextResponse.json(
      { error: "Server nicht konfiguriert oder nicht erreichbar." },
      { status: 503 },
    );
  }
}
