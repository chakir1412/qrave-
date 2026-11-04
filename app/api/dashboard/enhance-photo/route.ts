import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import { checkRateLimit, rateLimitHeaders, isUuid } from "@/lib/rate-limit";

export const maxDuration = 90;
export const dynamic = "force-dynamic";

const PHOTO_QUOTA_TOTAL = 5;
const SCENE_PROMPT =
  "Keep the food or drink item and its plate, glass or container exactly as shown in the original photo — all textures, colors, ingredients, composition and container preserved precisely, unchanged. Do not regenerate or alter the plate/glass itself. Do not add any props, cutlery, napkins, beverages, garnish, or decorative items not present in the original image. Background: seamless dark charcoal-slate studio backdrop with a soft vertical gradient from medium slate grey at the top to deep charcoal at the bottom, fine matte paper grain, no pattern, no marble, no wood, no stone, no visible props, no visible equipment, no restaurant scene, no location context. Lighting: soft directional daylight from the upper left, a clearly visible soft shadow cast by the item toward the lower right, gentle natural highlights. Boost saturation and richness of the item's natural colors, high contrast, punchy commercial food photography look.";
const SCENE_NEGATIVE_PROMPT =
  "watermark, text, low quality, pixelated, marble, wood texture, cutlery, napkin, extra props";

type ClaidError = {
  status: number;
  code: "auth" | "quota" | "rate_limit" | "invalid_input" | "upstream";
  message: string;
};

async function callClaid(url: string, apiKey: string, payload: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function callClaidWithRetry(
  url: string,
  apiKey: string,
  payload: unknown,
): Promise<Response> {
  let res = await callClaid(url, apiKey, payload);
  if (res.status !== 429) return res;
  await new Promise((r) => setTimeout(r, 1500));
  res = await callClaid(url, apiKey, payload);
  return res;
}

function classifyClaidError(status: number, bodyText: string): ClaidError {
  if (status === 401) return { status: 502, code: "auth", message: "Claid-Auth fehlgeschlagen — API-Key prüfen." };
  if (status === 402) return { status: 402, code: "quota", message: "Claid-Kontingent aufgebraucht." };
  if (status === 422) return { status: 502, code: "invalid_input", message: `Claid lehnt Bild ab: ${bodyText.slice(0, 200)}` };
  if (status === 429) return { status: 429, code: "rate_limit", message: "Claid Rate-Limit — bitte gleich nochmal." };
  return { status: 502, code: "upstream", message: `Claid ${status}: ${bodyText.slice(0, 200)}` };
}

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
    .select("id, auth_user_id, photo_credits_used_total")
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

  const used = Number(restaurantRow.photo_credits_used_total ?? 0);
  if (Number.isFinite(used) && used >= PHOTO_QUOTA_TOTAL) {
    return NextResponse.json(
      {
        success: false,
        error: "quota_reached",
        message: "Kontingent aufgebraucht — schreib uns.",
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

  const apiKey = process.env.CLAID_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "CLAID_API_KEY ist nicht konfiguriert." },
      { status: 500 },
    );
  }

  // Schritt 1: Background Removal via /v1/image/edit → freigestelltes PNG mit Alpha.
  let cutoutUrl: string;
  try {
    const editRes = await callClaidWithRetry(
      "https://api.claid.ai/v1/image/edit",
      apiKey,
      {
        input: imageUrl,
        operations: { background: { remove: true, color: "transparent" } },
        output: { format: "png" },
      },
    );
    if (!editRes.ok) {
      const errText = await editRes.text().catch(() => "");
      console.error("[enhance-photo] claid edit error:", editRes.status, errText.slice(0, 400));
      const cls = classifyClaidError(editRes.status, errText);
      return NextResponse.json(
        { success: false, error: cls.code === "quota" ? "quota_reached" : cls.message },
        { status: cls.status },
      );
    }
    const editJson = (await editRes.json().catch(() => null)) as
      | { data?: { output?: { tmp_url?: string; width?: number; height?: number } }; errors?: unknown; warnings?: unknown }
      | null;
    const tmp = editJson?.data?.output?.tmp_url;
    if (typeof tmp !== "string" || tmp.length === 0) {
      console.error("[enhance-photo] claid edit missing tmp_url:", editJson);
      return NextResponse.json(
        { success: false, error: "Claid Background Removal lieferte keine URL." },
        { status: 502 },
      );
    }
    console.log(
      "[enhance-photo] claid edit ok:",
      JSON.stringify({
        output: editJson?.data?.output,
        errors: editJson?.errors,
        warnings: editJson?.warnings,
      }),
    );
    cutoutUrl = tmp;
  } catch (e) {
    console.error("[enhance-photo] claid edit fetch failed:", e);
    return NextResponse.json(
      { success: false, error: "Claid /image/edit fehlgeschlagen." },
      { status: 502 },
    );
  }

  // Schritt 2: Background Generation via /v1/scene/create mit dem freigestellten PNG.
  let sceneUrl: string;
  try {
    const sceneRes = await callClaidWithRetry(
      "https://api.claid.ai/v1/scene/create",
      apiKey,
      {
        object: {
          image_url: cutoutUrl,
          placement_type: "original",
        },
        scene: {
          model: "v2",
          prompt: SCENE_PROMPT,
          negative_prompt: SCENE_NEGATIVE_PROMPT,
        },
        output: {
          number_of_images: 1,
          format: "jpeg",
        },
      },
    );
    if (!sceneRes.ok) {
      const errText = await sceneRes.text().catch(() => "");
      console.error("[enhance-photo] claid scene error:", sceneRes.status, errText.slice(0, 400));
      const cls = classifyClaidError(sceneRes.status, errText);
      return NextResponse.json(
        { success: false, error: cls.code === "quota" ? "quota_reached" : cls.message },
        { status: cls.status },
      );
    }
    const sceneJson = (await sceneRes.json().catch(() => null)) as
      | {
          data?: {
            output?: Array<{ tmp_url?: string; width?: number; height?: number; format?: string }>;
          };
          errors?: unknown;
          warnings?: unknown;
        }
      | null;
    const outArr = sceneJson?.data?.output;
    const tmp = Array.isArray(outArr) && outArr.length > 0 ? outArr[0]?.tmp_url : undefined;
    if (typeof tmp !== "string" || tmp.length === 0) {
      console.error("[enhance-photo] claid scene missing tmp_url:", sceneJson);
      return NextResponse.json(
        { success: false, error: "Claid Scene Generation lieferte keine URL." },
        { status: 502 },
      );
    }
    if (tmp === cutoutUrl) {
      console.error("[enhance-photo] claid scene returned same URL as cutout:", tmp);
      return NextResponse.json(
        { success: false, error: "Claid Scene lieferte nur den Cutout (keine Backdrop-Generierung)." },
        { status: 502 },
      );
    }
    console.log(
      "[enhance-photo] claid scene ok:",
      JSON.stringify({
        output: outArr,
        errors: sceneJson?.errors,
        warnings: sceneJson?.warnings,
      }),
    );
    sceneUrl = tmp;
  } catch (e) {
    console.error("[enhance-photo] claid scene fetch failed:", e);
    return NextResponse.json(
      { success: false, error: "Claid /scene/create fehlgeschlagen." },
      { status: 502 },
    );
  }

  // Schritt 3: Bild sofort holen (tmp_url ist nur 24h gültig) und als Data-URL an den Client.
  let dataUrl: string;
  try {
    const finalRes = await fetch(sceneUrl);
    if (!finalRes.ok) {
      console.error("[enhance-photo] scene tmp_url fetch failed:", finalRes.status);
      return NextResponse.json(
        { success: false, error: "Ergebnisbild nicht ladbar." },
        { status: 502 },
      );
    }
    const buf = Buffer.from(await finalRes.arrayBuffer());
    console.log("[enhance-photo] final image bytes:", buf.length);
    dataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch (e) {
    console.error("[enhance-photo] scene download failed:", e);
    return NextResponse.json(
      { success: false, error: "Ergebnisbild-Download fehlgeschlagen." },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, dataUrl });
}
