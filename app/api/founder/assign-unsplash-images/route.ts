import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Für Unsplash-Suche wenig hilfreiche Wörter (Kleinbuchstaben). */
const STOP_WORDS = new Set([
  "vom",
  "von",
  "der",
  "die",
  "das",
  "mit",
  "an",
  "auf",
  "in",
  "und",
  "am",
  "beim",
  "zum",
  "zur",
  "des",
  "dem",
  "den",
  "ein",
  "eine",
  "einem",
  "einer",
]);

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
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { restaurant_id?: unknown };
  try {
    body = (await req.json()) as { restaurant_id?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const restaurantId = typeof body.restaurant_id === "string" ? body.restaurant_id.trim() : "";
  if (!restaurantId || !isUuid(restaurantId)) {
    return NextResponse.json({ error: "restaurant_id ungültig" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const isFounder = Boolean(process.env.FOUNDER_USER_ID && user.id === process.env.FOUNDER_USER_ID);

  if (!isFounder) {
    const { data: owned, error: ownErr } = await supabase
      .from("restaurants")
      .select("id")
      .eq("id", restaurantId)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (ownErr) {
      console.error("assign-unsplash-images ownership:", ownErr);
      return NextResponse.json({ error: ownErr.message }, { status: 500 });
    }
    if (!owned) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const { data: exists, error: exErr } = await supabase
      .from("restaurants")
      .select("id")
      .eq("id", restaurantId)
      .maybeSingle();
    if (exErr) {
      console.error("assign-unsplash-images founder lookup:", exErr);
      return NextResponse.json({ error: exErr.message }, { status: 500 });
    }
    if (!exists) {
      return NextResponse.json({ error: "Restaurant nicht gefunden" }, { status: 404 });
    }
  }

  if (!process.env.UNSPLASH_ACCESS_KEY?.trim()) {
    return NextResponse.json({ error: "UNSPLASH_ACCESS_KEY nicht konfiguriert" }, { status: 500 });
  }

  const { data: items, error: selectError } = await supabase
    .from("menu_items")
    .select("id, name, kategorie")
    .eq("restaurant_id", restaurantId)
    .eq("aktiv", true);

  if (selectError) {
    console.error("assign-unsplash-images select:", selectError);
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  if (!items?.length) {
    return NextResponse.json({ updated: 0 });
  }

  let updated = 0;

  const accessKey = process.env.UNSPLASH_ACCESS_KEY!;

  for (const item of items) {
    try {
      const name = (item.name ?? "").trim();
      const kategorie = (item.kategorie ?? "").trim() || "Speisen";

      const meaningfulWords = name
        .split(/\s+/)
        .map((w: string) => w.replace(/^[.,;:!?'"«»()\-–—]+|[.,;:!?'"«»()\-–—]+$/g, "").trim())
        .filter((w: string) => w.length > 3 && !STOP_WORDS.has(w.toLowerCase()))
        .slice(0, 2);

      const firstWord = name.split(/\s+/).filter(Boolean)[0] ?? "";

      const searchQueries = [
        ...(meaningfulWords.length > 0 ? [`${meaningfulWords.join(" ")} food`] : []),
        ...(firstWord ? [`${firstWord} food`] : []),
        `${kategorie} food dish`,
        "restaurant food dish",
      ];

      const uniqueQueries = [
        ...new Set(searchQueries.map((q) => q.trim()).filter((q) => q.length > 0)),
      ];

      let imageUrl: string | null | undefined;

      for (const query of uniqueQueries) {
        const res = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=squarish`,
          { headers: { Authorization: `Client-ID ${accessKey}` } },
        );
        const data = (await res.json()) as {
          results?: { urls?: { regular?: string } }[];
        };
        imageUrl = data.results?.[0]?.urls?.regular;
        if (imageUrl) break;
      }

      if (imageUrl) {
        const { error: upErr } = await supabase
          .from("menu_items")
          .update({ bild_url: imageUrl })
          .eq("id", item.id);
        if (!upErr) updated++;
      }

      await new Promise((r) => setTimeout(r, 1200));
    } catch (e) {
      console.error("Unsplash error for", item.name, e);
    }
  }

  return NextResponse.json({ updated });
}
