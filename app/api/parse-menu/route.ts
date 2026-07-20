import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseMenuJsonFromModel, type ParsedMenuItemDto } from "@/lib/parse-menu";
import { enrichItemsWithDescriptions } from "@/lib/auto-describe";
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
/** Ausgabetokens pro Seiten-Call — großzügig, damit dichte Karten
 *  (~50 Items pro Seite) nicht mittendrin abgeschnitten werden. */
const PAGE_MAX_TOKENS = 16000;
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
 *  ~2 MB base64 ≈ 1,5 MB Bild — ausreichend für DIN-A4 bei 150 dpi. */
const MAX_PAGE_IMAGE_BYTES = 2_500_000;
/** Größen-Guard für den optionalen pdf-doc-Fallback (rohes PDF base64 im
 *  JSON-Body). Vercel Request-Limit liegt bei ~4,5 MB — 5,5 MB base64 sind
 *  ~4 MB rohe PDF, das passt zusammen mit Text/Bild-Payload. */
const MAX_PDF_DOC_BASE64_BYTES = 5_500_000;
const PDF_IMPORT_PROMPT = `Du bist ein Experte für Restaurantspeisekarten. Extrahiere alle Menüpunkte aus der Speisekarte.
Antworte NUR mit einem JSON Array, ohne Markdown, ohne Erklärung, ohne Codeblöcke:
[{"name":"...","beschreibung":"...","allergens":["gluten","milch"],"additives_text":"","tags":["vegan","vegetarisch","glutenfrei","scharf"],"preis":12.90,"kategorie":"...","emoji":"...","main_tab":"FOOD oder DRINKS"}]

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
Allergen- und Zusatzstoff-Kennzeichnungen (Buchstaben wie A, B, C oder Ziffern wie 1, 2, 3) NICHT in der Beschreibung lassen — auflösen und STRIKT GETRENNT in "allergens" (Array) bzw. "additives_text" (Freitext) ablegen.
Mengenangaben (0,33l) in die beschreibung

WICHTIG — deutsche Kennzeichnungs-Konvention:
- BUCHSTABEN (A, B, C, D, E, F, G, H, ... oder A1, A2 auf einigen Karten) → ALLERGENE → in "allergens" als LMIV-Schlüssel.
- ZIFFERN (1, 2, 3, ..., 14) → ZUSATZSTOFFE → in "additives_text" als deutscher Klartext. NICHT als Allergen interpretieren!

ALLERGENS (Array der 14 LMIV-Allergene):

NUR diese 14 Schlüssel sind erlaubt (Werte in "allergens" müssen exakt so geschrieben sein):
- gluten (enthält auch Weizen/Roggen/Gerste/Hafer/Dinkel/Kamut)
- krebstiere (Garnelen, Krabben, Hummer)
- eier (Ei, Eiweiß, Eigelb)
- fisch (auch Fischsauce, Anchovis, Kaviar)
- erdnuesse (Peanuts — nicht Schalenfrüchte)
- soja (Sojasauce, Tofu, Edamame)
- milch (auch Laktose, Käse, Butter, Sahne)
- schalenfruechte (Mandeln, Haselnüsse, Walnüsse, Cashews, Pistazien, Pekan, Paranüsse, Macadamia)
- sellerie
- senf
- sesam
- sulfite (Schwefeldioxid, meist in Wein, Trockenobst)
- lupinen
- weichtiere (Muscheln, Tintenfisch, Austern, Schnecken)

Einzige zulässige Quelle für "allergens":
- Buchstaben-Codes, die AUSDRÜCKLICH am Item auf der Karte stehen (Restaurant-Legenden variieren, aber A=Gluten, B=Krebstiere, C=Eier, D=Fisch, E=Erdnüsse, F=Soja, G=Milch, H=Schalenfrüchte, L=Sellerie, M=Senf, N=Sesam, O=Sulfite, P=Lupinen, R=Weichtiere sind häufig — wenn eine Legende auf der Karte steht, nach dieser vorgehen).

NIEMALS Allergene aus Zutaten oder Item-Namen ableiten oder schlussfolgern:
- "Brötchen" NICHT → gluten (nur wenn A auf der Karte steht)
- "Camembert" NICHT → milch (nur wenn G auf der Karte steht)
- "Krabbencocktail" NICHT → krebstiere (nur wenn B auf der Karte steht)
- Auch nicht bei "enthält Gluten" im Beschreibungstext — nur die Buchstaben-Kennzeichnung zählt.

NIEMALS Ziffern 1-14 als Allergene interpretieren — das sind Zusatzstoffe (siehe unten).
Wenn keine Buchstaben-Kennzeichnung am Item vorhanden: leeres Array [].

ADDITIVES_TEXT (Zusatzstoffe — NICHT Allergene):

Zusatzstoffe sind rechtlich getrennt von Allergenen und werden auf deutschen Karten meist mit Ziffern 1-14 kennzeichnet. Löse Ziffern nach dieser Standard-Legende auf und schreibe die Klartext-Bezeichnungen komma-getrennt in "additives_text":
- 1 = mit Milcheiweiß
- 2 = mit Geschmacksverstärker
- 3 = mit Konservierungsstoff
- 4 = mit Antioxidationsmittel
- 5 = mit Farbstoff
- 6 = mit Säuerungsmittel
- 7 = mit Säureregulator
- 8 = mit Stabilisator
- 9 = mit Süßstoff Aspartam (enthält Phenylalaninquelle)
- 10 = mit Emulgator
- 11 = mit Süßungsmittel
- 12 = mit Nitritpökelsalz
- 13 = coffeinhaltig
- 14 = chininhaltig

Format: mit "enthält " starten und die Klartext-Bezeichnungen komma-getrennt anhängen, z. B. "enthält Geschmacksverstärker, Konservierungsstoff, Farbstoff".
Auch explizite deutsche Nennungen ("mit Konservierungsstoff", "phosphathaltig", "geschwefelt", "geschwärzt", "koffeinhaltig", "chininhaltig") → hier ablegen.
Wenn keine Zusatzstoff-Hinweise erkennbar: leerer String "".

STRIKTE TRENNUNG:
- Buchstaben → allergens[]
- Ziffern 1-14 → additives_text
Setze NIE eine Ziffer als Allergen und NIE ein LMIV-Allergen in additives_text.

BEISPIEL — Wiener Schnitzel mit Kennzeichnung (A, C, G, 2, 3):
Ausgabe: "allergens": ["gluten", "eier", "milch"], "additives_text": "enthält Geschmacksverstärker, Konservierungsstoff"

BEISPIEL — Cola (11, 13):
Ausgabe: "allergens": [], "additives_text": "enthält Süßungsmittel, coffeinhaltig"

BEISPIEL — Camembert paniert (A, G):
Ausgabe: "allergens": ["gluten", "milch"], "additives_text": ""

BEISPIEL — "Crostini 2,3,4,5" (keine Buchstaben-Kennzeichnung):
Ausgabe: "allergens": [], "additives_text": "enthält Geschmacksverstärker, Konservierungsstoff, Antioxidationsmittel, Farbstoff"
(Nicht "gluten" ergänzen — auch wenn Brot Gluten enthält. Ohne Buchstaben-Kennzeichnung bleibt allergens leer.)

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
 *  (stop_reason, output_tokens, text_len). */
async function callAnthropicForPageContent(
  userContent: AnthropicContentPart[],
  apiKey: string,
  tag: string,
): Promise<PageParseResult> {
  const empty: PageParseResult = { items: [], stopReason: "empty", outputTokens: 0 };
  try {
    const res = await anthropicFetchWithRetry(
      {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      JSON.stringify({
        model: MODEL,
        max_tokens: PAGE_MAX_TOKENS,
        messages: [{ role: "user", content: userContent }],
      }),
    );
    const raw = await res.text();
    if (!res.ok) {
      console.error(`${tag} anthropic HTTP ${res.status}: ${raw.slice(0, 500)}`);
      return empty;
    }
    let body: AnthropicMessageResponse;
    try {
      body = JSON.parse(raw) as AnthropicMessageResponse;
    } catch {
      console.error(`${tag} anthropic body not JSON. Preview: ${raw.slice(0, 500)}`);
      return empty;
    }
    const modelText = body.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
    const stopReason = body.stop_reason ?? "unknown";
    const outputTokens = body.usage?.output_tokens ?? 0;
    console.error(
      `${tag} stop_reason=${stopReason} output_tokens=${outputTokens} text_len=${modelText.length}`,
    );
    if (!modelText) {
      console.error(`${tag} EMPTY text block. Full body: ${raw.slice(0, 1500)}`);
      return { items: [], stopReason, outputTokens };
    }
    const items = extractItemsFromModelText(modelText, tag);
    console.error(`${tag} extracted ${items.length} items`);
    return { items, stopReason, outputTokens };
  } catch (err) {
    console.error(`${tag} threw:`, err);
    return empty;
  }
}

/** Text-Pfad einer PDF-Seite (Client hat via pdfjs Text extrahiert). */
async function parsePageText(
  pageText: string,
  apiKey: string,
  pageIndex: number,
  totalPages: number,
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
      text: `${PDF_IMPORT_PROMPT}

Text von Seite ${pageIndex} von ${totalPages} der Speisekarte:
${trimmed}`,
    },
  ];
  return callAnthropicForPageContent(content, apiKey, tag);
}

/** Vision-Pfad einer PDF-Seite (Client hat die Seite via canvas als PNG
 *  gerendert und als base64 geschickt). Wird genutzt wenn pdfjs-Text
 *  leer/zu kurz war — typisch für gescannte PDFs. */
async function parsePageImage(
  pageImageBase64: string,
  apiKey: string,
  pageIndex: number,
  totalPages: number,
): Promise<PageParseResult> {
  const tag = `[parse-menu page ${pageIndex}/${totalPages} vision]`;
  const content: AnthropicContentPart[] = [
    {
      type: "image",
      source: { type: "base64", media_type: "image/png", data: pageImageBase64 },
    },
    {
      type: "text",
      text: `${PDF_IMPORT_PROMPT}

Das obige Bild ist Seite ${pageIndex} von ${totalPages} der Speisekarte. Extrahiere alle Items der Seite.`,
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

/** Ein Anthropic messages-Call mit Bild oder PDF-Dokument → strukturierte Menü-Items. */
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

  const anthropicRes = await anthropicFetchWithRetry(
    headers,
    JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
  );

  const rawText = await anthropicRes.text();
  if (!anthropicRes.ok) {
    let msg = `Anthropic API (${anthropicRes.status})`;
    try {
      const errJson = JSON.parse(rawText) as AnthropicErrorBody;
      if (errJson.error?.message) msg = errJson.error.message;
    } catch {
      if (rawText) msg = rawText.slice(0, 200);
    }
    console.error(`${tag} anthropic HTTP ${anthropicRes.status}: ${rawText.slice(0, 500)}`);
    throw new Error(msg);
  }

  let anthropicBody: AnthropicMessageResponse;
  try {
    anthropicBody = JSON.parse(rawText) as AnthropicMessageResponse;
  } catch {
    console.error(`${tag} anthropic body not JSON. Preview: ${rawText.slice(0, 500)}`);
    throw new Error("Ungültige Antwort der KI.");
  }

  const textBlock = anthropicBody.content?.find((c) => c.type === "text");
  const text = textBlock?.text?.trim() ?? "";
  const stopReason = anthropicBody.stop_reason ?? "unknown";
  const outputTokens = anthropicBody.usage?.output_tokens ?? 0;

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

        const collected: ParsedMenuItemDto[] = [];
        let maxOutputTokensUsed = 0;

        for (let i = 0; i < pageTexts.length; i++) {
          const current = i + 1;
          // Frühes Progress-Event, damit UI sofort "Seite X von N" zeigen kann.
          emit({ type: "page", current, total: totalPages });

          const text = pageTexts[i] ?? "";
          const image = pageImages[i] ?? null;
          const useVision = text.trim().length < MIN_PAGE_TEXT_CHARS_FOR_TEXT_PATH && image !== null;

          const result = useVision
            ? await parsePageImage(image!, apiKey, current, totalPages)
            : await parsePageText(text, apiKey, current, totalPages);

          if (result.outputTokens > maxOutputTokensUsed) {
            maxOutputTokensUsed = result.outputTokens;
          }
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
              { type: "text", text: PDF_IMPORT_PROMPT },
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
          const errorMessage = fallbackErrorMessage
            ? `PDF-Ganzanalyse (Fallback) fehlgeschlagen: ${fallbackErrorMessage}`
            : fallbackAttempted
              ? "Keine Gerichte erkannt — auch der PDF-Ganzanalyse-Fallback lieferte keine Items. Bitte Speisekarte als JPG/PNG hochladen."
              : "Keine Gerichte erkannt. Gescannte PDFs oft ohne Text: Speisekarte als JPG/PNG hochladen oder Text-PDF verwenden.";
          emit({ type: "error", error: errorMessage });
          controller.close();
          return;
        }

        await enrichItemsWithDescriptions(merged, apiKey);
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
        { type: "text", text: PDF_IMPORT_PROMPT },
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
        { type: "text", text: PDF_IMPORT_PROMPT },
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
      await enrichItemsWithDescriptions(imgItems, apiKey);
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
