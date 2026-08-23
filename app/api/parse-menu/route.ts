import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseMenuJsonFromModel, type ParsedMenuItemDto } from "@/lib/parse-menu";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

/** Vercel Serverless Timeout: bis zu 300s (Pro-Plan / Fluid Compute).
 *  Reicht auch für dichte Karten: PDF geht als Ganzes an Claude
 *  (native PDF-Unterstützung via anthropic-beta), Text-Fallback chunked
 *  parallel. */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Auth: Wirt ODER Founder. Bearer-Token bevorzugt (Wirt-Client lebt
 *  in localStorage, Cookie ist ggf. eine parallele Founder-Session), Cookie
 *  als Fallback für OAuth-Wirte. Anthropic-Rate-Limit läuft weiter pro IP. */
async function assertUserOrUnauthorized(req: Request): Promise<NextResponse | null> {
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

  const bearer = req.headers.get("authorization") ?? "";
  const token = bearer.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : "";
  if (token) {
    const { data } = await supabaseAuth.auth.getUser(token);
    if (data.user) return null;
  }
  const { data } = await supabaseAuth.auth.getUser();
  if (data.user) return null;

  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}

const MODEL = "claude-sonnet-4-6";
/** Kleines/günstiges Modell für die Legend-Pre-Extraction — reine
 *  Text-Klassifikation, Haiku reicht. */
const LEGEND_MODEL = "claude-haiku-4-5-20251001";
/** Ausgabetokens pro Seiten-Call — großzügig, damit dichte Karten
 *  (~50 Items pro Seite) nicht mittendrin abgeschnitten werden. */
const PAGE_MAX_TOKENS = 16000;
/** Fallback nach stop_reason=max_tokens: einmalig auf das Doppelte hoch.
 *  Sonnet 4.6 kann bis 64k output — 32k ist sicherer Cap. */
const PAGE_MAX_TOKENS_RETRY = 32000;
/** Obergrenze für PDF-Seitenzahl pro Request. 40 × ~15s sequenziell
 *  ≈ 600s → maxDuration=300 würde reißen; realistisch: 30 Seiten. */
const MAX_PAGES_PER_REQUEST = 40;
/** Hartes Limit pro einzelnem Seitentext — schützt vor Request-Body-Bloat
 *  und Prompt-Token-Explosion. */
const MAX_PAGE_TEXT_CHARS = 200_000;
/** Ab dieser Zeichenzahl gilt der Client-seitig extrahierte Text als „genug",
 *  darunter greift der Vision-Fallback (Seite als Bild an Claude). Passt zu
 *  dem Client-Fallback-Threshold in KarteTab.tsx. */
const MIN_PAGE_TEXT_CHARS_FOR_TEXT_PATH = 100;
/** Grober Schutz vor Riesen-PNG-Payloads pro Seite (base64 im JSON-Body).
 *  ~3,5 MB base64 ≈ 2,6 MB Bild — nötig damit die 2000-px-Renderings vom
 *  Client (nötig für kleine Allergen-/Zusatzstoff-Codes) durchkommen und
 *  nicht stillschweigend verworfen werden. */
const MAX_PAGE_IMAGE_BYTES = 3_500_000;
/** Größen-Guard für den optionalen pdf-doc-Fallback (rohes PDF base64 im
 *  JSON-Body). Vercel Request-Limit liegt bei ~4,5 MB — 5,5 MB base64 sind
 *  ~4 MB rohe PDF, das passt zusammen mit Text/Bild-Payload. */
const MAX_PDF_DOC_BASE64_BYTES = 5_500_000;
/** Die 14 LMIV-Allergen-Schlüssel (synchron zu ALLOWED_ALLERGENS in
 *  lib/parse-menu.ts). Für die Legenden-Pre-Extraction und als enum
 *  im Menu-Items-Structured-Output-Schema. */
const LMIV_ALLERGEN_KEYS = [
  "gluten",
  "krebstiere",
  "eier",
  "fisch",
  "erdnuesse",
  "soja",
  "milch",
  "schalenfruechte",
  "sellerie",
  "senf",
  "sesam",
  "sulfite",
  "lupinen",
  "weichtiere",
] as const;

/** Diät-Tags-Enum für das Structured-Output-Schema (synchron zu
 *  ALLOWED_TAGS in lib/parse-menu.ts). */
const DIET_TAGS = ["vegan", "vegetarisch", "glutenfrei", "scharf"] as const;

/** JSON-Schema für Structured Outputs (output_config.format). Bildet
 *  ParsedMenuItemDto ab. `enum` auf allergens + tags erzwingt API-seitig
 *  die zulässigen Werte — Post-Parse-Normalizer bleibt trotzdem als
 *  Safety-Net (Trim, Casing, Deduplication). Anthropic-Schema-Limits:
 *  additionalProperties: false PFLICHT auf allen Objekten; kein
 *  minimum/maximum/minLength — numerische Constraints (preis >= 0,
 *  category_confidence 0..1) macht der Normalizer weiter.
 *  main_tab: bleibt plain string, kein enum — Prompt und Post-Parse
 *  arbeiten mit zwei parallelen Konventionen (FOOD/DRINKS im Prompt
 *  vs. speisen/getraenke/snacks im Normalizer), fixen wäre Scope-Creep. */
const MENU_ITEMS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "preis", "kategorie"],
        properties: {
          name: { type: "string" },
          beschreibung: { type: "string" },
          preis: { type: "number" },
          kategorie: { type: "string" },
          main_tab: { type: "string" },
          emoji: { type: "string" },
          allergens: {
            type: "array",
            items: { type: "string", enum: [...LMIV_ALLERGEN_KEYS] },
          },
          additives_text: { type: "string" },
          tags: {
            type: "array",
            items: { type: "string", enum: [...DIET_TAGS] },
          },
          needs_review: { type: "boolean" },
          needs_review_reason: { type: "string" },
          category_confidence: { type: "number" },
        },
      },
    },
  },
} as const;

type LegendEntry = {
  /** Klartext aus der Karte, z. B. "Milch & Laktose" oder "Stabilisator". */
  label: string;
  /** Wenn der Eintrag einem LMIV-Allergen entspricht: der Schlüssel;
   *  sonst null (dann ist es ein reiner Zusatzstoff). */
  lmiv_allergen_key: (typeof LMIV_ALLERGEN_KEYS)[number] | null;
};

type MenuLegend = {
  found: boolean;
  /** Key = Code wie er auf der Karte steht (z. B. "1", "14", "A"). */
  entries: Record<string, LegendEntry>;
};

/** Nimmt den kompletten (konkatenierten) Menü-Text und lässt Haiku die
 *  Deklarations-Legende extrahieren + jeden Eintrag als LMIV-Allergen oder
 *  reinen Zusatzstoff klassifizieren. Wenn keine Legende erkennbar ist:
 *  found=false, dann greift im Prompt der "needs_review"-Pfad. */
async function extractMenuLegend(
  fullText: string,
  apiKey: string,
): Promise<MenuLegend> {
  const empty: MenuLegend = { found: false, entries: {} };
  const text = fullText.trim();
  if (text.length < 200) return empty;

  const prompt = `Du analysierst den vollständigen Text einer Restaurant-Speisekarte und suchst NUR nach der Deklarations-Legende (die nummerierte oder alphabetische Liste, die Codes wie 1., 2., ... oder A, B, ... auf Klartext-Bezeichnungen wie "Farbstoff", "Milch & Laktose", "Gluten" abbildet).

Typische Überschriften: "Zusatzstoffe und Allergene", "Deklarationspflichtige Zusatzstoffe", "Allergen-Kennzeichnung", "Legende", oft am Ende der Karte.

Für jeden Legende-Eintrag klassifiziere, ob er einem der 14 LMIV-Allergene entspricht:
- gluten (auch: Weizen, Roggen, Gerste, Hafer, Dinkel, Kamut, glutenhaltiges Getreide)
- krebstiere (Crustaceans)
- eier (Ei, Eiweiß)
- fisch
- erdnuesse (Peanuts — NICHT Schalenfrüchte)
- soja
- milch (auch: Laktose, Milcheiweiß, Käse — aber "Milcheiweiß" allein als Zusatzstoff-Angabe ohne "Milch"-Kontext bleibt Zusatzstoff)
- schalenfruechte (Nüsse, Mandeln, Haselnüsse, Walnüsse, Cashews, Pistazien, Pekan, Paranüsse, Macadamia, Pinienkerne)
- sellerie
- senf
- sesam (Sesamsamen)
- sulfite (auch: Schwefeldioxid, Sulfide, geschwefelt)
- lupinen
- weichtiere (Muscheln, Tintenfisch, Austern, Schnecken)

Alles andere (Farbstoff, Konservierungsstoff, Antioxidationsmittel, Süßstoff, Aromaverstärker, Geliermittel, Nitrit, Chinin, Koffein, Stabilisator, Emulgator, alkoholhaltig, gewachst, Milcheiweiß, …) → lmiv_allergen_key: null (reiner Zusatzstoff / Hinweis).

Antworte NUR mit JSON, ohne Markdown, ohne Erklärung:
{"found": true, "entries": {"1": {"label": "Farbstoff", "lmiv_allergen_key": null}, "14": {"label": "Gluten", "lmiv_allergen_key": "gluten"}, ...}}

Falls du keine Deklarations-Legende auf der Karte findest:
{"found": false, "entries": {}}

Speisekarte-Text:
${text.slice(0, 40000)}`;

  try {
    const res = await anthropicFetchWithRetry(
      {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      JSON.stringify({
        model: LEGEND_MODEL,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    );
    const raw = await res.text();
    if (!res.ok) {
      console.error(`[legend] HTTP ${res.status}: ${raw.slice(0, 400)}`);
      return empty;
    }
    const body = JSON.parse(raw) as AnthropicMessageResponse;
    let text = body.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    }
    if (!text) return empty;
    const parsed = JSON.parse(text) as { found?: unknown; entries?: unknown };
    if (parsed.found !== true || typeof parsed.entries !== "object" || parsed.entries === null) {
      return empty;
    }
    const entries: Record<string, LegendEntry> = {};
    for (const [k, v] of Object.entries(parsed.entries as Record<string, unknown>)) {
      if (typeof v !== "object" || v === null) continue;
      const vo = v as Record<string, unknown>;
      const label = typeof vo.label === "string" ? vo.label.trim() : "";
      if (!label) continue;
      const rawKey = typeof vo.lmiv_allergen_key === "string" ? vo.lmiv_allergen_key.trim().toLowerCase() : null;
      const lmiv_allergen_key =
        rawKey && (LMIV_ALLERGEN_KEYS as readonly string[]).includes(rawKey)
          ? (rawKey as (typeof LMIV_ALLERGEN_KEYS)[number])
          : null;
      entries[k.trim()] = { label, lmiv_allergen_key };
    }
    const found = Object.keys(entries).length > 0;
    console.error(
      `[legend] found=${found} entries=${Object.keys(entries).length}`,
    );
    return { found, entries };
  } catch (err) {
    console.error("[legend] threw:", err);
    return empty;
  }
}

/** Formatiert die Legende als lesbaren Prompt-Block für Sonnet. */
function formatLegendForPrompt(legend: MenuLegend): string {
  if (!legend.found || Object.keys(legend.entries).length === 0) {
    return `DIESE KARTE HAT KEINE AUFLÖSBARE DEKLARATIONS-LEGENDE.

Für JEDES Item, das Codes am Namen hat (Ziffern oder Buchstaben, klein/hochgestellt/in Klammern hinter dem Item-Namen):
- "allergens": []
- "additives_text": ""
- "needs_review": true
Wenn das Item KEINE Codes hat:
- "allergens": []
- "additives_text": ""
- "needs_review": false
NICHT raten. NICHT aus Zutaten oder Item-Namen ableiten. Der Wirt trägt manuell nach.`;
  }
  // Codes numerisch aufsteigend sortieren, dann alphanumerisch.
  const codes = Object.keys(legend.entries).sort((a, b) => {
    const na = Number.parseInt(a, 10);
    const nb = Number.parseInt(b, 10);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });
  const lines = codes.map((c) => {
    const e = legend.entries[c];
    const tag = e.lmiv_allergen_key
      ? `LMIV-Allergen "${e.lmiv_allergen_key}"`
      : "Zusatzstoff / Hinweis";
    return `- Code "${c}" = "${e.label}" (${tag})`;
  });
  return `DIESE KARTE HAT DIE FOLGENDE LEGENDE (vom Wirt vorgegeben — GEHT VOR JEDER STANDARD-KONVENTION wie A-R/1-14):

${lines.join("\n")}

REGEL:
- Für JEDES Item: sammle die Codes, die direkt am Item stehen (klein, hochgestellt oder in Komma-Liste hinter dem Namen).
- Für jeden Code am Item: schlage in der Legende nach.
  - Wenn Eintrag ein LMIV-Allergen ist → Schlüssel (gluten, krebstiere, eier, fisch, erdnuesse, soja, milch, schalenfruechte, sellerie, senf, sesam, sulfite, lupinen, weichtiere) in "allergens" hinzufügen.
  - Wenn Eintrag ein Zusatzstoff / Hinweis ist → Klartext-Label in "additives_text" komma-getrennt hinzufügen, mit "enthält " Präfix (z. B. "enthält Stabilisator, Farbstoff").
- Wenn ein Code NICHT in der Legende auftaucht: weglassen und "needs_review": true setzen.
- Wenn ein Item GAR KEINE Codes hat: allergens: [], additives_text: "", needs_review: false.
- NIEMALS aus Zutaten oder Item-Namen ableiten. NIEMALS Codes erfinden.`;
}

const PDF_IMPORT_PROMPT_BASE = `Du bist ein Experte für Restaurantspeisekarten. Extrahiere alle Menüpunkte aus der Speisekarte.

Die Struktur der Antwort (Feldnamen, Typen, zulässige Werte für allergens/tags) wird durch das output_config-Schema erzwungen — konzentriere dich auf den Inhalt.

DIÄT-TAGS:

Für jedes Item: prüfe ob es vegan, vegetarisch, glutenfrei oder scharf ist und gib zutreffende Werte als Array in "tags" zurück (Subset aus ["vegan","vegetarisch","glutenfrei","scharf"]). Wenn nichts zutrifft: leeres Array [].

Regeln:
- "vegan": KEIN Fleisch, KEIN Fisch, KEINE Milch/Käse/Sahne/Butter, KEINE Eier, KEIN Honig. Beispiele: Mineralwasser, Limo, Schwarzer Kaffee/Tee, Apfelsaft, Bier, Wein, Gin, Vodka, vegane Bowls, Pommes ohne Mayo.
- "vegetarisch": KEIN Fleisch, KEIN Fisch — Milch/Käse/Eier/Honig sind erlaubt. Alle veganen Items zusätzlich auch als "vegetarisch" markieren. Beispiele: Käsespätzle, Latte Macchiato, Käsebrot, Salat ohne Fleisch.
- "glutenfrei": keine glutenhaltigen Zutaten — kein Weizen-/Roggen-/Gersten-Mehl, kein Brot/Brötchen, keine Panade/Paniermehl, keine Pasta, kein Bier (außer ausdrücklich glutenfrei), keine Sojasauce. Reine Pommes, Salzkartoffeln, Wein, Spirituosen ohne Beimischung sind glutenfrei.
- "scharf": enthält Chili, Jalapeños, Pfeffer in größerer Menge, Sambal, Sriracha, Harissa, "spicy", "hot" — oder das Item wird in der Beschreibung explizit als scharf, feurig, oder pikant beschrieben.

Wenn unklar (z. B. Soße könnte Sahne enthalten oder nicht): lieber kein Tag setzen als einen falschen.
KATEGORIEN:

Burger, Sandwiches, Wraps -> "Burger"
Pizza -> "Pizza"
Pasta -> "Pasta"
Hauptgerichte, Fleisch, Fisch -> "Hauptgerichte"
Vorspeisen, Antipasti -> "Vorspeisen"
Salate -> "Salads"
Suppen -> "Suppen"
Beilagen, Sides -> "Sides"
Extras, Zusätze, Toppings -> "Extras"
Desserts -> "Desserts"
Frühstück -> "Frühstück"
Bowls -> "Bowls"
Sushi, Nigiri, Maki -> "Sushi"
Softdrinks, Cola, Limo, Schorle, Wasser, Säfte, Eistee, Spezi, Energy -> "Drinks" + main_tab: "DRINKS"
Bier, Radler, Weizen, Craft Beer -> "Bier" + main_tab: "DRINKS"
Wein, Prosecco, Champagner, Sekt -> "Weine" + main_tab: "DRINKS"
Cocktails, Longdrinks, Shots, Spirituosen -> "Cocktails" + main_tab: "DRINKS"
Kaffee, Espresso, Cappuccino, Latte, Flat White -> "Kaffee" + main_tab: "DRINKS"
Tee, Matcha, Chai -> "Tee" + main_tab: "DRINKS"

NAMEN:

Kurz und klar - keine Variantenbeschreibungen im Namen
"Fritz-Kola Original | Super Zero" -> name: "Fritz-Kola", beschreibung: "Original | Super Zero, 0,33l"
Allergen- und Zusatzstoff-Kennzeichnungen (Codes wie A, B, C oder 1, 2, 3, 18, 19 direkt am Item-Namen) NICHT in der Beschreibung lassen — auflösen und STRIKT GETRENNT in "allergens" (Array) bzw. "additives_text" (Freitext) ablegen. Die genauen Klassifikationsregeln stehen im Legenden-Block unter dem Prompt.

ALLERGENS (Array der 14 LMIV-Schlüssel) — NUR diese Werte erlaubt:
gluten, krebstiere, eier, fisch, erdnuesse, soja, milch, schalenfruechte, sellerie, senf, sesam, sulfite, lupinen, weichtiere.

ADDITIVES_TEXT: Freitext mit "enthält " Präfix, komma-getrennt (z. B. "enthält Stabilisator, Farbstoff"). Leer wenn keine Zusatzstoffe.

WICHTIG: Die Zuordnung Code → Allergen vs. Zusatzstoff wird NICHT über die Standard-Konvention (A-R Allergen, 1-14 Zusatzstoff) angenommen — sie folgt IMMER der karteneigenen Legende, die in einem Block direkt unter diesem Prompt steht. Wenn dort keine Legende steht: setze needs_review=true für alle Items mit Codes und lasse allergens/additives_text leer.

VARIANTEN:

"Fresh Salad mit Avocado 13.90, mit Ziegenkäse 13.90" -> zwei separate Items

PREISE:

Dezimalzahl: 10.90 nicht "10,90 EUR"
Kein Preis vorhanden -> 0

EMOJIS:

Burger->🍔 Pizza->🍕 Pasta->🍝 Salat->🥗 Suppe->🍲
Bier->🍺 Wein->🍷 Cocktail->🍸 Kaffee->☕ Wasser->💧
Softdrinks->🥤 Tee->🍵 Dessert->🍰 Fleisch->🥩 Vegetarisch->🌱

main_tab:

Alle Getränke -> "DRINKS"
Alles andere -> "FOOD"`;

/** Setzt Base-Prompt + Legenden-Block zusammen. Alle Sonnet-Calls (Text,
 *  Vision, pdf-doc) laufen darüber, damit die Klassifikationsregel überall
 *  identisch bleibt. */
function buildPdfImportPrompt(legend: MenuLegend): string {
  return `${PDF_IMPORT_PROMPT_BASE}

=== KARTEN-SPEZIFISCHE LEGENDE ===
${formatLegendForPrompt(legend)}`;
}

type AnthropicContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: "image/jpeg" | "image/png";
        data: string;
      };
    }
  | {
      type: "document";
      source: {
        type: "base64";
        media_type: "application/pdf";
        data: string;
      };
    };

type AnthropicMessageResponse = {
  content: Array<{ type: string; text?: string }>;
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

type AnthropicErrorBody = {
  error?: { type?: string; message?: string };
};

/** HTTP-Status, bei denen ein Retry gegen Anthropic sinnvoll ist:
 *  429 = Rate-Limit, 503 = Service Unavailable, 529 = Overloaded. */
const ANTHROPIC_RETRY_STATUSES = new Set([429, 503, 529]);
/** Exponential Backoff zwischen Retries: 1s → 2s → 4s. */
const ANTHROPIC_RETRY_BACKOFFS_MS = [1000, 2000, 4000];
const ANTHROPIC_MAX_ATTEMPTS = 3;

/** POST an Anthropic mit Retry bei 429/503/529. Andere Fehler werden sofort
 *  zurückgegeben — der Caller entscheidet wie damit umgegangen wird. */
async function anthropicFetchWithRetry(
  headers: Record<string, string>,
  body: string,
): Promise<Response> {
  let res!: Response;
  for (let attempt = 0; attempt < ANTHROPIC_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      const delay = ANTHROPIC_RETRY_BACKOFFS_MS[attempt - 1] ?? 4000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body,
    });
    if (res.ok || !ANTHROPIC_RETRY_STATUSES.has(res.status)) {
      return res;
    }
    console.warn(
      `anthropic ${res.status} — Retry-Versuch ${attempt + 1}/${ANTHROPIC_MAX_ATTEMPTS}`,
    );
  }
  return res;
}

function normalizeModelJsonText(input: string): string {
  let t = input.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  return t.trim();
}

/** Versucht abgeschnittenes Modell-JSON zu schließen (z. B. mitten im letzten Item). */
function repairJson(text: string): string {
  let t = text.replace(/,\s*([}\]])/g, "$1");

  if (!t.includes('"items"')) {
    return t;
  }

  const itemsKeyIdx = t.indexOf('"items"');
  const itemsBracketIdx = t.indexOf("[", itemsKeyIdx);
  if (itemsBracketIdx === -1) {
    return t;
  }

  const arrayContent = t.slice(itemsBracketIdx + 1);

  const lastPairComma = arrayContent.lastIndexOf("},");
  const lastCompleteObjEnd = lastPairComma === -1 ? -1 : lastPairComma + 1;

  const lastOpen = arrayContent.lastIndexOf("{");
  const lastClose = arrayContent.lastIndexOf("}");
  let cleanArray = arrayContent;
  if (lastOpen > lastClose) {
    cleanArray = arrayContent.slice(0, lastOpen).trimEnd();
    if (cleanArray.endsWith(",")) {
      cleanArray = cleanArray.slice(0, -1).trimEnd();
    }
  }

  if (lastCompleteObjEnd === -1 && cleanArray.trim() === "") {
    const attempt = `${t.slice(0, itemsBracketIdx)}[]}`;
    try {
      JSON.parse(attempt);
      return attempt;
    } catch {
      return '{"items":[]}';
    }
  }

  let middle = cleanArray.trim();
  if (middle.endsWith(",")) {
    middle = middle.slice(0, -1).trimEnd();
  }

  let depth = 0;
  for (const ch of middle) {
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
  }
  let closeObjs = "";
  while (depth > 0) {
    closeObjs += "}";
    depth -= 1;
  }

  const prefix = t.slice(0, itemsBracketIdx + 1);
  const rebuilt = `${prefix}${middle}${closeObjs}]}`;
  const withRoot = rebuilt.trimEnd().endsWith("}") ? rebuilt : `${rebuilt}\n}`;

  try {
    JSON.parse(withRoot);
    return withRoot;
  } catch {
    return '{"items":[]}';
  }
}

type PageParseResult = {
  items: ParsedMenuItemDto[];
  stopReason: string;
  outputTokens: number;
};

/** Robuste JSON-Extraktion aus Claude-Antworten mit Repair-Fallbacks. */
function extractItemsFromModelText(
  text: string,
  tag: string,
): ParsedMenuItemDto[] {
  const tryParseToItems = (rawJson: string): ParsedMenuItemDto[] | null => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson) as unknown;
    } catch {
      return null;
    }
    try {
      if (Array.isArray(parsed)) {
        return parseMenuJsonFromModel(JSON.stringify({ items: parsed }));
      }
      const asObj = parsed as { items?: unknown };
      if (Array.isArray(asObj?.items)) {
        return parseMenuJsonFromModel(JSON.stringify({ items: asObj.items }));
      }
    } catch {
      return null;
    }
    return null;
  };

  try {
    return parseMenuJsonFromModel(text);
  } catch {
    const cleaned = normalizeModelJsonText(text);
    const repaired = repairJson(cleaned);
    try {
      return parseMenuJsonFromModel(repaired);
    } catch {
      const fromRepaired = tryParseToItems(repaired);
      if (fromRepaired) return fromRepaired;
      const fromClean = tryParseToItems(cleaned);
      if (fromClean) return fromClean;
      console.error(`${tag} ALL parse paths failed. RAW first 1500: ${text.slice(0, 1500)}`);
      console.error(`${tag} RAW last 500: ${text.slice(-500)}`);
      console.error(`${tag} CLEANED first 1500: ${cleaned.slice(0, 1500)}`);
      console.error(`${tag} CLEANED last 500: ${cleaned.slice(-500)}`);
      console.error(`${tag} REPAIRED first 1500: ${repaired.slice(0, 1500)}`);
      console.error(`${tag} REPAIRED last 500: ${repaired.slice(-500)}`);
      return [];
    }
  }
}

/** Ein Anthropic-Call mit vorbereitetem User-Content. Zentraler Response-
 *  Parser für parsePageText + parsePageImage — gleicher Logging-Prefix
 *  (stop_reason, output_tokens, text_len). Nutzt Structured Outputs
 *  (output_config.format) mit MENU_ITEMS_SCHEMA — Antworten sind
 *  schema-konformes JSON. Bei stop_reason=max_tokens einmalig Retry
 *  mit PAGE_MAX_TOKENS_RETRY. extractItemsFromModelText bleibt als
 *  Sicherheitsnetz falls Grammar mit ausgehendem max_tokens doch mal
 *  eine unvollständige Antwort produziert. */
async function callAnthropicForPageContent(
  userContent: AnthropicContentPart[],
  apiKey: string,
  tag: string,
): Promise<PageParseResult> {
  const empty: PageParseResult = { items: [], stopReason: "empty", outputTokens: 0 };

  const sendOnce = async (
    maxTokens: number,
  ): Promise<{ body: AnthropicMessageResponse; rawText: string } | null> => {
    try {
      const res = await anthropicFetchWithRetry(
        {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: userContent }],
          output_config: {
            format: { type: "json_schema", schema: MENU_ITEMS_SCHEMA },
          },
        }),
      );
      const raw = await res.text();
      if (!res.ok) {
        console.error(`${tag} anthropic HTTP ${res.status}: ${raw.slice(0, 500)}`);
        return null;
      }
      try {
        return { body: JSON.parse(raw) as AnthropicMessageResponse, rawText: raw };
      } catch {
        console.error(`${tag} anthropic body not JSON. Preview: ${raw.slice(0, 500)}`);
        return null;
      }
    } catch (err) {
      console.error(`${tag} threw:`, err);
      return null;
    }
  };

  let sent = await sendOnce(PAGE_MAX_TOKENS);
  if (!sent) return empty;

  // stop_reason=max_tokens: einmaliger Retry mit höherer Grenze. Grammar-
  // gebundenes Decoding kann bei dichten Karten mitten in einem Item die
  // Token-Grenze reißen — dann ist der JSON-Output evtl. abgeschnitten
  // (repair-Kette fängt Restschäden). 32k statt 16k gibt genug Puffer.
  if (sent.body.stop_reason === "max_tokens") {
    console.warn(
      `${tag} stop_reason=max_tokens bei ${PAGE_MAX_TOKENS} → Retry mit ${PAGE_MAX_TOKENS_RETRY}`,
    );
    const retry = await sendOnce(PAGE_MAX_TOKENS_RETRY);
    if (retry) sent = retry;
  }

  const { body, rawText } = sent;
  const stopReason = body.stop_reason ?? "unknown";
  const outputTokens = body.usage?.output_tokens ?? 0;

  // stop_reason=refusal: klar durchreichen. Caller (Streaming-Handler)
  // kann bei 0 Total-Items eine spezifische Fehlermeldung emitten statt
  // dem generischen "Keine Gerichte erkannt".
  if (stopReason === "refusal") {
    console.error(`${tag} REFUSAL. Body: ${rawText.slice(0, 500)}`);
    return { items: [], stopReason: "refusal", outputTokens };
  }

  const modelText = body.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  console.error(
    `${tag} stop_reason=${stopReason} output_tokens=${outputTokens} text_len=${modelText.length}`,
  );
  if (!modelText) {
    console.error(`${tag} EMPTY text block. Full body: ${rawText.slice(0, 1500)}`);
    return { items: [], stopReason, outputTokens };
  }
  const items = extractItemsFromModelText(modelText, tag);
  console.error(`${tag} extracted ${items.length} items`);
  return { items, stopReason, outputTokens };
}

/** Text-Pfad einer PDF-Seite (Client hat via pdfjs Text extrahiert).
 *  `legend` ist die vorab extrahierte karteneigene Legende — der Prompt
 *  konsultiert ausschließlich diese für die Code-Klassifikation. */
async function parsePageText(
  pageText: string,
  apiKey: string,
  pageIndex: number,
  totalPages: number,
  legend: MenuLegend,
): Promise<PageParseResult> {
  const tag = `[parse-menu page ${pageIndex}/${totalPages} text]`;
  const trimmed = pageText.trim();
  if (!trimmed) {
    console.error(`${tag} skipped — no text on page`);
    return { items: [], stopReason: "empty", outputTokens: 0 };
  }
  const content: AnthropicContentPart[] = [
    {
      type: "text",
      text: `${buildPdfImportPrompt(legend)}

Text von Seite ${pageIndex} von ${totalPages} der Speisekarte:
${trimmed}`,
    },
  ];
  return callAnthropicForPageContent(content, apiKey, tag);
}

/** Vision-Pfad einer PDF-Seite (Client hat die Seite via canvas als PNG
 *  gerendert und als base64 geschickt). Wird genutzt wenn pdfjs-Text
 *  leer/zu kurz war — typisch für gescannte PDFs. `legend` ist die vorab
 *  extrahierte karteneigene Legende (aus text-extrahierbaren Seiten oder
 *  {found:false} falls die ganze PDF gescannt ist). */
async function parsePageImage(
  pageImageBase64: string,
  apiKey: string,
  pageIndex: number,
  totalPages: number,
  legend: MenuLegend,
): Promise<PageParseResult> {
  const tag = `[parse-menu page ${pageIndex}/${totalPages} vision]`;
  const content: AnthropicContentPart[] = [
    {
      type: "image",
      source: { type: "base64", media_type: "image/png", data: pageImageBase64 },
    },
    {
      type: "text",
      text: `${buildPdfImportPrompt(legend)}

Das obige Bild ist Seite ${pageIndex} von ${totalPages} einer gescannten Speisekarte. Extrahiere alle Items der Seite. Die Zuordnung Code → Allergen/Zusatzstoff folgt EXKLUSIV der Legende oben — bei fehlender Legende needs_review=true statt zu raten.`,
    },
  ];
  return callAnthropicForPageContent(content, apiKey, tag);
}

function dedupeItems(items: ParsedMenuItemDto[]): ParsedMenuItemDto[] {
  const seen = new Set<string>();
  const out: ParsedMenuItemDto[] = [];
  for (const item of items) {
    const key = `${item.name.trim().toLowerCase()}::${item.preis}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Ein Anthropic messages-Call mit Bild oder PDF-Dokument → strukturierte
 *  Menü-Items. Nutzt Structured Outputs (output_config.format) mit
 *  MENU_ITEMS_SCHEMA. Bei stop_reason=max_tokens einmalig Retry mit
 *  PAGE_MAX_TOKENS_RETRY. Bei stop_reason=refusal wird ein klarer Fehler
 *  geworfen statt der generischen "Analyse fehlgeschlagen"-Meldung. */
async function anthropicExtractMenuItems(
  userContent: AnthropicContentPart[],
  apiKey: string,
  options: { usePdfBeta: boolean; maxTokens: number; label?: string },
): Promise<ParsedMenuItemDto[]> {
  const { usePdfBeta, maxTokens, label } = options;
  const tag = label ? `[parse-menu ${label}]` : "[parse-menu]";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
  if (usePdfBeta) {
    headers["anthropic-beta"] = "pdfs-2024-09-25";
  }

  const sendOnce = async (
    tokens: number,
  ): Promise<{ body: AnthropicMessageResponse; rawText: string }> => {
    const res = await anthropicFetchWithRetry(
      headers,
      JSON.stringify({
        model: MODEL,
        max_tokens: tokens,
        messages: [{ role: "user", content: userContent }],
        output_config: {
          format: { type: "json_schema", schema: MENU_ITEMS_SCHEMA },
        },
      }),
    );
    const raw = await res.text();
    if (!res.ok) {
      let msg = `Anthropic API (${res.status})`;
      try {
        const errJson = JSON.parse(raw) as AnthropicErrorBody;
        if (errJson.error?.message) msg = errJson.error.message;
      } catch {
        if (raw) msg = raw.slice(0, 200);
      }
      console.error(`${tag} anthropic HTTP ${res.status}: ${raw.slice(0, 500)}`);
      throw new Error(msg);
    }
    try {
      return { body: JSON.parse(raw) as AnthropicMessageResponse, rawText: raw };
    } catch {
      console.error(`${tag} anthropic body not JSON. Preview: ${raw.slice(0, 500)}`);
      throw new Error("Ungültige Antwort der KI.");
    }
  };

  let sent = await sendOnce(maxTokens);

  // stop_reason=max_tokens: einmaliger Retry mit höherer Grenze (analog
  // zum per-page Pfad). Nur wenn wir nicht bereits die höhere Grenze
  // genutzt haben — sonst Endlos-Retry-Risiko.
  if (sent.body.stop_reason === "max_tokens" && maxTokens < PAGE_MAX_TOKENS_RETRY) {
    console.warn(
      `${tag} stop_reason=max_tokens bei ${maxTokens} → Retry mit ${PAGE_MAX_TOKENS_RETRY}`,
    );
    sent = await sendOnce(PAGE_MAX_TOKENS_RETRY);
  }

  const { body: anthropicBody, rawText } = sent;
  const stopReason = anthropicBody.stop_reason ?? "unknown";
  const outputTokens = anthropicBody.usage?.output_tokens ?? 0;

  // stop_reason=refusal: klare, spezifische Fehlermeldung. Der Streaming-
  // Handler zeigt sie 1:1 dem Nutzer.
  if (stopReason === "refusal") {
    console.error(`${tag} REFUSAL. Body: ${rawText.slice(0, 500)}`);
    throw new Error(
      "Die KI hat die Analyse dieser Speisekarte abgelehnt. Bitte manuell nachtragen oder ein anderes Format (JPG/PNG) versuchen.",
    );
  }

  const textBlock = anthropicBody.content?.find((c) => c.type === "text");
  const text = textBlock?.text?.trim() ?? "";

  console.error(
    `${tag} stop_reason=${stopReason} output_tokens=${outputTokens} text_len=${text.length}`,
  );

  if (!text) {
    console.error(`${tag} EMPTY text block. Full body: ${rawText.slice(0, 1500)}`);
    throw new Error("Kein Text in der KI-Antwort.");
  }

  const cleanedResponse = normalizeModelJsonText(text);
  try {
    const parsed = JSON.parse(cleanedResponse) as unknown;
    if (Array.isArray(parsed)) {
      return parseMenuJsonFromModel(JSON.stringify({ items: parsed }));
    }
    const asObj = parsed as { items?: unknown };
    if (Array.isArray(asObj?.items)) {
      return parseMenuJsonFromModel(JSON.stringify({ items: asObj.items }));
    }
    return parseMenuJsonFromModel(cleanedResponse);
  } catch {
    // Truncation-Fallback: bei abgeschnittenem JSON (z. B. weil max_tokens
    // dennoch nicht reicht) versuche über repairJson mind. die vollständig
    // geparsten Items zu retten. Analog zu parseChunkOnce.
    const repaired = repairJson(cleanedResponse);
    try {
      return parseMenuJsonFromModel(repaired);
    } catch {
      try {
        const parsed = JSON.parse(repaired) as unknown;
        if (Array.isArray(parsed)) {
          return parseMenuJsonFromModel(JSON.stringify({ items: parsed }));
        }
        const asObj = parsed as { items?: unknown };
        if (Array.isArray(asObj?.items)) {
          return parseMenuJsonFromModel(JSON.stringify({ items: asObj.items }));
        }
      } catch {
        // fällt in den finalen throw
      }
      // Umfangreiches Logging für Diagnose in Vercel-Logs.
      // Wir loggen die rohe Text-Antwort (Start + Ende), das normalisierte JSON
      // (Start + Ende) sowie das repair-Ergebnis (Start + Ende), damit klar wird
      // ob Truncation, Prompt-Deviation oder Repair-Bug die Ursache ist.
      console.error(`${tag} repair failed. RAW text_len=${text.length}, first 1500: ${text.slice(0, 1500)}`);
      console.error(`${tag} RAW text last 500: ${text.slice(-500)}`);
      console.error(`${tag} CLEANED first 1500: ${cleanedResponse.slice(0, 1500)}`);
      console.error(`${tag} CLEANED last 500: ${cleanedResponse.slice(-500)}`);
      console.error(`${tag} REPAIRED first 1500: ${repaired.slice(0, 1500)}`);
      console.error(`${tag} REPAIRED last 500: ${repaired.slice(-500)}`);
      throw new Error("KI-Antwort konnte nicht verarbeitet werden. Bitte erneut versuchen.");
    }
  }
}

/** Streaming-Handler für den neuen per-page PDF-Pfad. NDJSON: jede Zeile ist
 *  ein JSON-Event. Sequenzielle Claude-Calls pro Seite (max_tokens=16000).
 *  Nach jedem Call werden stop_reason + output_tokens geloggt. Am Ende ein
 *  done-Event mit dem finalen Item-Array. */
async function handlePageTextsStream(req: Request, apiKey: string): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Ungültiger JSON-Body." },
      { status: 400 },
    );
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ success: false, error: "Ungültiger Body." }, { status: 400 });
  }
  const o = body as Record<string, unknown>;

  if (typeof o.restaurantId !== "string" || !o.restaurantId.trim()) {
    return NextResponse.json({ success: false, error: "restaurantId fehlt." }, { status: 400 });
  }
  if (!Array.isArray(o.pageTexts)) {
    return NextResponse.json({ success: false, error: "pageTexts fehlt." }, { status: 400 });
  }
  const rawPages = o.pageTexts.filter((p): p is string => typeof p === "string");
  if (rawPages.length === 0) {
    return NextResponse.json(
      { success: false, error: "Keine Seiten-Texte übermittelt." },
      { status: 400 },
    );
  }
  if (rawPages.length > MAX_PAGES_PER_REQUEST) {
    return NextResponse.json(
      {
        success: false,
        error: `PDF hat zu viele Seiten (max. ${MAX_PAGES_PER_REQUEST}). Bitte teilen.`,
      },
      { status: 413 },
    );
  }
  const pageTexts = rawPages.map((p) => (p.length > MAX_PAGE_TEXT_CHARS ? p.slice(0, MAX_PAGE_TEXT_CHARS) : p));
  const totalPages = pageTexts.length;

  // Optionaler Vision-Fallback pro Seite: Client rendert die Seite via
  // pdfjs+canvas als PNG-base64 wenn der extrahierte Text < 100 Zeichen
  // ist (typisch für gescannte PDFs). Länge muss zu pageTexts passen —
  // Elemente können null/leer sein wenn Text ausreicht.
  const rawImages = Array.isArray(o.pageImages) ? o.pageImages : [];
  const pageImages: (string | null)[] = pageTexts.map((_t, idx) => {
    const raw = rawImages[idx];
    if (typeof raw !== "string" || raw.length === 0) return null;
    if (raw.length > MAX_PAGE_IMAGE_BYTES) {
      console.error(
        `[parse-menu] page ${idx + 1} image payload ${raw.length} > ${MAX_PAGE_IMAGE_BYTES} — dropping`,
      );
      return null;
    }
    return raw;
  });

  // Optionaler pdf-doc-Fallback: rohe PDF als base64. Wird nur genutzt wenn
  // der per-page-Pfad 0 Items liefert — sonst wandert Server-Traffic +
  // Anthropic-Cost sinnlos hoch.
  const pdfBase64Raw = typeof o.pdfBase64 === "string" ? o.pdfBase64 : null;
  const pdfBase64: string | null =
    pdfBase64Raw && pdfBase64Raw.length > 0 && pdfBase64Raw.length <= MAX_PDF_DOC_BASE64_BYTES
      ? pdfBase64Raw
      : null;
  if (pdfBase64Raw && !pdfBase64) {
    console.error(
      `[parse-menu] pdfBase64 payload ${pdfBase64Raw.length} exceeds ${MAX_PDF_DOC_BASE64_BYTES} — fallback disabled for this request`,
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        emit({ type: "start", totalPages });

        // Vorab: karteneigene Legende aus dem konkatenierten Text ziehen.
        // Wenn found=true, wird sie in jeden per-page-Prompt injiziert;
        // wenn found=false, greift der needs_review-Pfad.
        const fullText = pageTexts.filter((t) => t.trim().length > 0).join("\n\n");
        const legend = await extractMenuLegend(fullText, apiKey);
        console.error(
          `[parse-menu] legend.found=${legend.found} entries=${Object.keys(legend.entries).length}`,
        );

        const collected: ParsedMenuItemDto[] = [];
        let maxOutputTokensUsed = 0;
        let refusalSeen = false;

        for (let i = 0; i < pageTexts.length; i++) {
          const current = i + 1;
          // Frühes Progress-Event, damit UI sofort "Seite X von N" zeigen kann.
          emit({ type: "page", current, total: totalPages });

          const text = pageTexts[i] ?? "";
          const image = pageImages[i] ?? null;
          const useVision = text.trim().length < MIN_PAGE_TEXT_CHARS_FOR_TEXT_PATH && image !== null;

          const result = useVision
            ? await parsePageImage(image!, apiKey, current, totalPages, legend)
            : await parsePageText(text, apiKey, current, totalPages, legend);

          if (result.outputTokens > maxOutputTokensUsed) {
            maxOutputTokensUsed = result.outputTokens;
          }
          if (result.stopReason === "refusal") refusalSeen = true;
          if (result.items.length > 0) collected.push(...result.items);
        }

        let merged = dedupeItems(collected);
        console.error(
          `[parse-menu done] total_items=${merged.length} total_pages=${totalPages} max_output_tokens_used=${maxOutputTokensUsed}`,
        );

        // pdf-doc-Fallback: wenn per-page-Loop nichts liefert und die rohe
        // PDF mitgeschickt wurde, schicken wir die ganze PDF nochmal an
        // Claude via anthropic-beta pdfs-2024-09-25. Historisch war das der
        // zuverlässigste Pfad für Text-PDFs.
        let fallbackAttempted = false;
        let fallbackErrorMessage: string | null = null;
        if (merged.length === 0 && pdfBase64) {
          fallbackAttempted = true;
          console.error("[parse-menu pdf-doc fallback] starting");
          emit({ type: "page", current: totalPages, total: totalPages });
          try {
            const docContent: AnthropicContentPart[] = [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBase64,
                },
              },
              { type: "text", text: buildPdfImportPrompt(legend) },
            ];
            const items = await anthropicExtractMenuItems(docContent, apiKey, {
              usePdfBeta: true,
              maxTokens: PAGE_MAX_TOKENS,
              label: "pdf-doc fallback",
            });
            merged = dedupeItems(items);
            console.error(
              `[parse-menu pdf-doc fallback] total_items=${merged.length}`,
            );
          } catch (err) {
            console.error("[parse-menu pdf-doc fallback] threw:", err);
            fallbackErrorMessage =
              err instanceof Error ? err.message : "PDF-Ganzanalyse fehlgeschlagen.";
          }
        }

        if (merged.length === 0) {
          const errorMessage = refusalSeen
            ? "Die KI hat die Analyse dieser Speisekarte abgelehnt. Bitte manuell nachtragen oder ein anderes Format (JPG/PNG) versuchen."
            : fallbackErrorMessage
              ? `PDF-Ganzanalyse (Fallback) fehlgeschlagen: ${fallbackErrorMessage}`
              : fallbackAttempted
                ? "Keine Gerichte erkannt — auch der PDF-Ganzanalyse-Fallback lieferte keine Items. Bitte Speisekarte als JPG/PNG hochladen."
                : "Keine Gerichte erkannt. Gescannte PDFs oft ohne Text: Speisekarte als JPG/PNG hochladen oder Text-PDF verwenden.";
          emit({ type: "error", error: errorMessage });
          controller.close();
          return;
        }

        // Enrichment (Haiku-Batch für Items ohne beschreibung) läuft NICHT
        // mehr im Sync-Pfad — bei dichten Karten (200+ Items) reißt es das
        // 300s-maxDuration-Limit von Vercel. Wirt sieht Items ohne
        // beschreibung im Review-Screen markiert und triggert dort pro Item
        // "✨ Beschreibung generieren" bei Bedarf.
        emit({ type: "done", items: merged });
        controller.close();
      } catch (err) {
        console.error("[parse-menu stream] threw:", err);
        emit({
          type: "error",
          error: err instanceof Error ? err.message : "Analyse fehlgeschlagen.",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: Request) {
  // Rate-Limit vor Founder-Auth: schützt vor Brute-Force gegen Auth-Cookie
  // und vor accidental flood (z. B. UI-Bug der mehrfach feuert). Anthropic
  // kostet pro Call — 10/h pro IP ist großzügig für legitime Founder-Nutzung.
  const ip = getClientIp(req);
  const rl = await checkRateLimit("parse-menu", ip, 10, "1 h");
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Rate Limit überschritten." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const denied = await assertUserOrUnauthorized(req);
  if (denied) return denied;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { success: false, error: "ANTHROPIC_API_KEY nicht gesetzt" },
      { status: 500 },
    );
  }

  // JSON-Body: neuer per-page Streaming-Pfad für PDFs.
  //   Body: { restaurantId: string, pageTexts: string[] }
  //   Response: NDJSON-Stream — je Zeile ein Event
  //     { type: "start", totalPages }
  //     { type: "page",  current, total }
  //     { type: "done",  items }
  //     { type: "error", error }
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("application/json")) {
    return handlePageTextsStream(req, apiKey);
  }

  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (err) {
      console.error("parse-menu: formData failed", err);
      return NextResponse.json(
        {
          success: false,
          error:
            "Anfrage-Body konnte nicht gelesen werden (evtl. zu groß für das Server-Limit).",
        },
        { status: 400 },
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Keine Datei übermittelt." },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length === 0) {
      return NextResponse.json({ success: false, error: "Leere Datei." }, { status: 400 });
    }
    if (buf.length > 32 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Datei zu groß (max. 32 MB)." },
        { status: 400 },
      );
    }

    const base64 = buf.toString("base64");
    const declaredMime = (file.type || "").toLowerCase();
    const nameLower = file.name.toLowerCase();

    const isPdf =
      declaredMime === "application/pdf" || nameLower.endsWith(".pdf");
    const isPng = declaredMime === "image/png" || nameLower.endsWith(".png");
    const isJpeg =
      declaredMime === "image/jpeg" ||
      declaredMime === "image/jpg" ||
      nameLower.endsWith(".jpg") ||
      nameLower.endsWith(".jpeg");

    if (isPdf) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PDF-Anfrage ungültig: verwenden Sie pdfDocument (Datei ≤ ca. 2,5 MB) oder pdfTextOnly mit extrahiertem Text.",
        },
        { status: 400 },
      );
    }

    let userContent: AnthropicContentPart[];

    // Single-Image-Upload: keine Text-Basis für Legenden-Vorab-Extraktion
    // vorhanden. Wir übergeben eine leere Legende — dann greift automatisch
    // der needs_review-Pfad für alle Items mit Codes, der Wirt kann's im
    // Review korrigieren. (Alternative: eigener Vision-Legend-Call; unnötig
    // teuer bei Einzelbild-Import.)
    const emptyLegend: MenuLegend = { found: false, entries: {} };
    const imagePrompt = buildPdfImportPrompt(emptyLegend);

    if (isPng) {
      userContent = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: base64,
          },
        },
        { type: "text", text: imagePrompt },
      ];
    } else if (isJpeg) {
      userContent = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: base64,
          },
        },
        { type: "text", text: imagePrompt },
      ];
    } else {
      return NextResponse.json(
        { success: false, error: "Nur PDF oder JPG/PNG erlaubt." },
        { status: 400 },
      );
    }

    try {
      const imgItems = await anthropicExtractMenuItems(userContent, apiKey, {
        usePdfBeta: false,
        maxTokens: PAGE_MAX_TOKENS,
      });
      if (imgItems.length === 0) {
        return NextResponse.json(
          { success: false, error: "Keine Gerichte erkannt." },
          { status: 422 },
        );
      }
      // Enrichment weggelassen (siehe Streaming-Pfad) — Wirt füllt Beschreibungen
      // pro Item im Review-Screen via "✨ Beschreibung generieren" nach.
      return NextResponse.json({ success: true, items: imgItems });
    } catch (err) {
      console.error("parse-menu image:", err);
      return NextResponse.json(
        {
          success: false,
          error: err instanceof Error ? err.message : "Analyse fehlgeschlagen",
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error("PDF Import Error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
