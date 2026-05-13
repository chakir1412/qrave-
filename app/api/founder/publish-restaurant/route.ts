import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import { sendPublishConfirmation } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Founder-only Endpoint zum Freischalten eines Restaurants direkt aus
 *  dem Founder-Dashboard. Setzt `published=true` und `status='live'`,
 *  schickt die Bestätigungs-Mail an den Wirt. Idempotent. */
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

  let body: { restaurantId?: unknown };
  try {
    body = (await req.json()) as { restaurantId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = typeof body.restaurantId === "string" ? body.restaurantId.trim() : "";
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Ungültige Restaurant-ID" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: before, error: getErr } = await supabase
    .from("restaurants")
    .select("id, slug, name, email, published")
    .eq("id", id)
    .maybeSingle();
  if (getErr) {
    return NextResponse.json({ error: getErr.message }, { status: 500 });
  }
  if (!before) {
    return NextResponse.json({ error: "Restaurant nicht gefunden" }, { status: 404 });
  }

  if (before.published === true) {
    return NextResponse.json({ ok: true, alreadyPublished: true, slug: before.slug });
  }

  const { error: updErr } = await supabase
    .from("restaurants")
    .update({ published: true, status: "live" })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  if (before.email) {
    try {
      await sendPublishConfirmation({
        ownerEmail: before.email,
        restaurantName: before.name,
        slug: before.slug,
      });
    } catch (e) {
      // Mail-Fehler nicht kritisch — Restaurant ist freigeschaltet
      console.error("[founder/publish-restaurant] mail:", e);
    }
  }

  return NextResponse.json({ ok: true, slug: before.slug });
}
