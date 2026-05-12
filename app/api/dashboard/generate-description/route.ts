import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import { checkRateLimit, rateLimitHeaders, isUuid } from "@/lib/rate-limit";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_LENGTH = 100;

const SYSTEM_PROMPT =
  "Du schreibst kurze, appetitliche Beschreibungen für Restaurant-Gerichte auf Deutsch. " +
  "Maximal 100 Zeichen, in einem ganzen Satz, ohne Anführungszeichen, ohne Aufzählungen, ohne den Namen des Gerichts zu wiederholen. " +
  "Sinnliche Sprache, konkrete Zutaten oder Zubereitungs-Hinweise, keine Floskeln wie 'leckere Mahlzeit'.";

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
};

export async function POST(req: Request) {
  let body: { restaurantId?: unknown; name?: unknown; kategorie?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const kategorie = typeof body.kategorie === "string" ? body.kategorie.trim() : "";

  if (!isUuid(restaurantId)) {
    return NextResponse.json(
      { success: false, error: "restaurantId fehlt oder ungültig." },
      { status: 400 },
    );
  }
  if (name.length === 0) {
    return NextResponse.json({ success: false, error: "Name fehlt." }, { status: 400 });
  }
  if (name.length > 200) {
    return NextResponse.json({ success: false, error: "Name zu lang." }, { status: 400 });
  }

  // Auth: User muss eingeloggt + Owner des Restaurants (oder Founder) sein.
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
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const { data: restaurantRow, error: rErr } = await admin
    .from("restaurants")
    .select("id, auth_user_id")
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

  // Rate-Limit pro Restaurant: 20/h.
  const rl = await checkRateLimit("generate-description", restaurantId, 20, "1 h");
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Rate Limit überschritten — bitte später erneut versuchen." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "ANTHROPIC_API_KEY ist nicht konfiguriert." },
      { status: 500 },
    );
  }

  const userPrompt = kategorie.length > 0
    ? `Gericht: ${name}\nKategorie: ${kategorie}\n\nGenerate eine Beschreibung.`
    : `Gericht: ${name}\n\nGenerate eine Beschreibung.`;

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 120,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
  } catch (e) {
    console.error("[generate-description] fetch failed:", e);
    return NextResponse.json(
      { success: false, error: "KI-Aufruf fehlgeschlagen." },
      { status: 502 },
    );
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "");
    console.error("[generate-description] anthropic error:", anthropicRes.status, errText.slice(0, 200));
    return NextResponse.json(
      { success: false, error: `Claude ${anthropicRes.status}` },
      { status: 502 },
    );
  }

  const json = (await anthropicRes.json().catch(() => null)) as AnthropicResponse | null;
  const rawText = json?.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (rawText.length === 0) {
    return NextResponse.json(
      { success: false, error: "Leere Antwort vom Modell." },
      { status: 502 },
    );
  }

  // Sicherheits-Trim: Falls das Modell länger geantwortet hat, hart auf 100 Zeichen kürzen.
  const cleaned = rawText.replace(/^["„]/, "").replace(/["“]$/, "").trim();
  const description = cleaned.length <= MAX_LENGTH ? cleaned : `${cleaned.slice(0, MAX_LENGTH - 1).trimEnd()}…`;

  return NextResponse.json({ success: true, description });
}
