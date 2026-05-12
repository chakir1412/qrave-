import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import { SUPPORTED_LOCALES, DEEPL_TARGET_BY_LOCALE, type SupportedLocale } from "@/lib/menu-i18n";
import { checkRateLimit, getClientIp, rateLimitHeaders, isUuid } from "@/lib/rate-limit";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const DEEPL_ENDPOINT_FREE = "https://api-free.deepl.com/v2/translate";
const DEEPL_ENDPOINT_PRO = "https://api.deepl.com/v2/translate";

type TranslatableLocale = Exclude<SupportedLocale, "de">;

type MenuItemRow = {
  id: string;
  name: string | null;
  beschreibung: string | null;
} & { [K in `name_${TranslatableLocale}`]?: string | null } & {
  [K in `beschreibung_${TranslatableLocale}`]?: string | null;
};

/** Eine Übersetzungseinheit: welches Item, welches Feld, welcher Text. */
type Job = {
  itemId: string;
  field: `name_${TranslatableLocale}` | `beschreibung_${TranslatableLocale}`;
  text: string;
};

/** DeepL erlaubt bis zu 50 text-Parameter pro Call. Wir bleiben mit 40 sicher unter dem Limit. */
const DEEPL_BATCH_SIZE = 40;

function isTranslatableLocale(code: string): code is TranslatableLocale {
  return code !== "de" && (SUPPORTED_LOCALES as readonly string[]).includes(code);
}

async function deeplTranslate(
  texts: string[],
  target: string,
  apiKey: string,
): Promise<string[]> {
  // Free-Keys enden auf `:fx`. Wenn das nicht stimmt, nehmen wir den Pro-Endpoint.
  const endpoint = apiKey.endsWith(":fx") ? DEEPL_ENDPOINT_FREE : DEEPL_ENDPOINT_PRO;
  const params = new URLSearchParams();
  params.set("source_lang", "DE");
  params.set("target_lang", target);
  params.set("preserve_formatting", "1");
  for (const t of texts) params.append("text", t);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`DeepL ${res.status}: ${errText.slice(0, 200)}`);
  }
  const json = (await res.json()) as { translations?: { text: string }[] };
  const translations = json.translations ?? [];
  if (translations.length !== texts.length) {
    throw new Error(`DeepL: ${translations.length} Übersetzungen für ${texts.length} Texte`);
  }
  return translations.map((t) => t.text);
}

export async function POST(req: Request) {
  // Rate-Limit: 10/h pro IP (graceful Fallback ohne Upstash).
  const ip = getClientIp(req);
  const rl = await checkRateLimit("translate-menu", ip, 10, "1 h");
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Rate Limit überschritten." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let body: { restaurantId?: unknown };
  try {
    body = (await req.json()) as { restaurantId?: unknown };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId : "";
  if (!isUuid(restaurantId)) {
    return NextResponse.json(
      { success: false, error: "restaurantId fehlt oder ungültig." },
      { status: 400 },
    );
  }

  // Auth: User muss eingeloggt + Owner des Restaurants sein.
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

  // Owner-Check: Founder darf alle, Restaurant-Owner nur sein eigenes.
  const founderId = process.env.FOUNDER_USER_ID ?? "";
  const { data: restaurantRow, error: rErr } = await admin
    .from("restaurants")
    .select("id, auth_user_id, active_languages")
    .eq("id", restaurantId)
    .maybeSingle();
  if (rErr || !restaurantRow) {
    return NextResponse.json({ success: false, error: "Restaurant nicht gefunden." }, { status: 404 });
  }
  const isOwner = restaurantRow.auth_user_id === user.id;
  const isFounder = founderId.length > 0 && user.id === founderId;
  if (!isOwner && !isFounder) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const activeLanguages = Array.isArray(restaurantRow.active_languages)
    ? (restaurantRow.active_languages as string[]).filter(isTranslatableLocale)
    : [];
  if (activeLanguages.length === 0) {
    return NextResponse.json({
      success: true,
      translatedFields: 0,
      message: "Keine weiteren Sprachen aktiviert.",
    });
  }

  const apiKey = process.env.DEEPL_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "DEEPL_API_KEY ist nicht konfiguriert." },
      { status: 500 },
    );
  }

  // Items des Restaurants mit allen Übersetzungs-Spalten laden.
  const selectCols = [
    "id",
    "name",
    "beschreibung",
    ...activeLanguages.flatMap((l) => [`name_${l}`, `beschreibung_${l}`]),
  ].join(", ");

  const { data: items, error: iErr } = await admin
    .from("menu_items")
    .select(selectCols)
    .eq("restaurant_id", restaurantId);
  if (iErr || !items) {
    return NextResponse.json(
      { success: false, error: iErr?.message ?? "Items konnten nicht geladen werden." },
      { status: 500 },
    );
  }

  // Pro Sprache: Jobs für NULL-Felder sammeln (nur wenn das Quellfeld nicht leer ist).
  const jobsByLocale = new Map<TranslatableLocale, Job[]>();
  for (const raw of items as unknown as MenuItemRow[]) {
    const sourceName = (raw.name ?? "").trim();
    const sourceDesc = (raw.beschreibung ?? "").trim();
    for (const locale of activeLanguages) {
      const list = jobsByLocale.get(locale) ?? [];
      const nameKey = `name_${locale}` as const;
      const descKey = `beschreibung_${locale}` as const;
      if (sourceName.length > 0 && (raw[nameKey] ?? null) === null) {
        list.push({ itemId: raw.id, field: nameKey, text: sourceName });
      }
      if (sourceDesc.length > 0 && (raw[descKey] ?? null) === null) {
        list.push({ itemId: raw.id, field: descKey, text: sourceDesc });
      }
      jobsByLocale.set(locale, list);
    }
  }

  // Übersetzen + Updates sammeln (ein Update pro Item mit allen neuen Feldern).
  const updatesByItem = new Map<string, Record<string, string>>();
  let translatedFields = 0;
  for (const [locale, jobs] of jobsByLocale.entries()) {
    if (jobs.length === 0) continue;
    const target = DEEPL_TARGET_BY_LOCALE[locale];
    for (let i = 0; i < jobs.length; i += DEEPL_BATCH_SIZE) {
      const batch = jobs.slice(i, i + DEEPL_BATCH_SIZE);
      const texts = batch.map((j) => j.text);
      let translated: string[];
      try {
        translated = await deeplTranslate(texts, target, apiKey);
      } catch (e) {
        console.error("[translate-menu] DeepL batch failed:", e);
        return NextResponse.json(
          {
            success: false,
            error: e instanceof Error ? e.message : "DeepL-Fehler",
            translatedFields,
          },
          { status: 502 },
        );
      }
      batch.forEach((job, idx) => {
        const patch = updatesByItem.get(job.itemId) ?? {};
        patch[job.field] = translated[idx];
        updatesByItem.set(job.itemId, patch);
        translatedFields += 1;
      });
    }
  }

  // Updates ausführen (service-role bypasst RLS, sodass auch Founder-Trigger durchlaufen).
  for (const [itemId, patch] of updatesByItem.entries()) {
    const { error: uErr } = await admin
      .from("menu_items")
      .update(patch)
      .eq("id", itemId);
    if (uErr) {
      console.error("[translate-menu] update failed:", itemId, uErr);
    }
  }

  return NextResponse.json({
    success: true,
    translatedFields,
    languages: activeLanguages,
    itemsTouched: updatesByItem.size,
  });
}
